const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');
const { getKekProvider } = require('./kek');

const DEK_LENGTH = 32; // AES-256
const IV_LENGTH = 12;  // GCM standard nonce length
const TAG_LENGTH = 16;

// Self-describing prefix so the format can evolve without guessing.
const CIPHERTEXT_VERSION = 'v2';

// Bound on how many unwrapped keys are held before expired entries are purged.
const MAX_CACHED_DEKS = 500;

/**
 * Per-user envelope encryption for bank credentials.
 *
 * Every user gets their own randomly generated data encryption key (DEK). The
 * DEK is stored only in wrapped form, encrypted by a key encryption key (KEK)
 * that lives in Azure Key Vault and never leaves it. Compromising the database
 * therefore yields neither credentials nor the keys to them, and a single
 * user's key can be destroyed without touching anyone else's data.
 */
class CredentialEncryptionService {
  constructor() {
    // Unwrapping costs a Key Vault round trip, so unwrapped DEKs are held in
    // memory for a bounded time rather than per operation.
    this.dekCache = new Map();
    // Collapses concurrent first-use requests for the same user into one
    // wrap/unwrap instead of racing to create competing DEKs.
    this.pending = new Map();
  }

  get cacheTtlMs() {
    return config.keyVault.dekCacheTtlMs;
  }

  static normalizeUserId(userId) {
    if (!userId) {
      throw new Error('A userId is required to encrypt or decrypt credentials');
    }
    return userId.toString();
  }

  cacheDek(userId, dek) {
    // Expired entries are only dropped when read, so sweep occasionally to
    // stop the cache growing without bound in a long-lived process.
    if (this.dekCache.size >= MAX_CACHED_DEKS) {
      this.sweepExpired();
    }
    this.dekCache.set(userId, { dek, expiresAt: Date.now() + this.cacheTtlMs });
    return dek;
  }

  sweepExpired() {
    const now = Date.now();
    for (const [userId, entry] of this.dekCache) {
      if (entry.expiresAt <= now) {
        this.dekCache.delete(userId);
      }
    }
  }

  getCachedDek(userId) {
    const entry = this.dekCache.get(userId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.dekCache.delete(userId);
      return null;
    }
    return entry.dek;
  }

  /**
   * Drops a user's key from the cache. Call after rotating or revoking a key so
   * the next operation is forced to go back to Key Vault.
   */
  evict(userId) {
    this.dekCache.delete(CredentialEncryptionService.normalizeUserId(userId));
  }

  clearCache() {
    this.dekCache.clear();
    this.pending.clear();
  }

  async getUserDek(rawUserId) {
    const userId = CredentialEncryptionService.normalizeUserId(rawUserId);

    const cached = this.getCachedDek(userId);
    if (cached) return cached;

    if (this.pending.has(userId)) return this.pending.get(userId);

    const inflight = this.loadOrCreateDek(userId)
      .finally(() => this.pending.delete(userId));
    this.pending.set(userId, inflight);
    return inflight;
  }

  async loadOrCreateDek(userId) {
    // Required lazily so the module graph stays acyclic: models pull in this
    // service, and requiring the model at load time would close the loop.
    const User = require('../../auth/models/User');

    const user = await User.findById(userId).select('+credentialKey').lean();
    if (!user) {
      throw new Error(`Cannot resolve an encryption key: user ${userId} was not found`);
    }

    const kek = getKekProvider();

    if (user.credentialKey && user.credentialKey.wrappedDek) {
      const dek = await kek.unwrapKey(user.credentialKey.wrappedDek, user.credentialKey.kekId);
      return this.cacheDek(userId, dek);
    }

    const dek = crypto.randomBytes(DEK_LENGTH);
    const { wrappedDek, kekId } = await kek.wrapKey(dek);

    // Conditional on the key still being absent, so two concurrent callers in
    // different processes cannot overwrite each other's DEK and orphan data.
    const result = await User.updateOne(
      { _id: userId, 'credentialKey.wrappedDek': { $exists: false } },
      { $set: { credentialKey: { wrappedDek, kekId, wrappedAt: new Date() } } }
    );

    if (result.modifiedCount === 0) {
      const fresh = await User.findById(userId).select('+credentialKey').lean();
      if (!fresh || !fresh.credentialKey || !fresh.credentialKey.wrappedDek) {
        throw new Error(`Failed to provision an encryption key for user ${userId}`);
      }
      const existing = await kek.unwrapKey(fresh.credentialKey.wrappedDek, fresh.credentialKey.kekId);
      return this.cacheDek(userId, existing);
    }

    logger.info(`Provisioned a credential encryption key for user ${userId}`);
    return this.cacheDek(userId, dek);
  }

  async encryptForUser(userId, plaintext) {
    if (plaintext === undefined || plaintext === null || plaintext === '') return plaintext;

    const dek = await this.getUserDek(userId);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      CIPHERTEXT_VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64')
    ].join(':');
  }

  async decryptForUser(userId, value) {
    if (value === undefined || value === null || value === '') return value;

    const parts = String(value).split(':');
    if (parts.length !== 4 || parts[0] !== CIPHERTEXT_VERSION) {
      throw new Error('Value is not in the expected encrypted format');
    }

    const [, ivB64, tagB64, ciphertextB64] = parts;
    const tag = Buffer.from(tagB64, 'base64');
    if (tag.length !== TAG_LENGTH) {
      throw new Error('Encrypted value has a malformed authentication tag');
    }

    const dek = await this.getUserDek(userId);
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(tag);

    // Throws if the ciphertext or tag was tampered with, which the previous
    // unauthenticated CBC scheme could not detect.
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final()
    ]).toString('utf8');
  }

  /**
   * Detects whether a value has already been encrypted by this service, so a
   * re-save does not encrypt the ciphertext a second time.
   */
  static isEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    const parts = value.split(':');
    if (parts.length !== 4 || parts[0] !== CIPHERTEXT_VERSION) return false;
    return parts.slice(1).every((part) => /^[A-Za-z0-9+/]+={0,2}$/.test(part));
  }
}

const credentialEncryption = new CredentialEncryptionService();

module.exports = credentialEncryption;
module.exports.CredentialEncryptionService = CredentialEncryptionService;
module.exports.isEncrypted = CredentialEncryptionService.isEncrypted;
