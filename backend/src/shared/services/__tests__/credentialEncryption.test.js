const credentialEncryption = require('../credentialEncryption');
const { getKekProvider, setKekProvider, LocalKekProvider } = require('../kek');

describe('credentialEncryption', () => {
  let user;
  let otherUser;

  beforeEach(async () => {
    credentialEncryption.clearCache();
    user = await global.createTestUser({ email: `enc-${Date.now()}@example.com` });
    otherUser = await global.createTestUser({ email: `enc-other-${Date.now()}@example.com` });
  });

  describe('round trip', () => {
    it('decrypts what it encrypted', async () => {
      const ciphertext = await credentialEncryption.encryptForUser(user._id, 'bank-secret-123');
      expect(await credentialEncryption.decryptForUser(user._id, ciphertext))
        .toBe('bank-secret-123');
    });

    it('does not leave the plaintext in the ciphertext', async () => {
      const ciphertext = await credentialEncryption.encryptForUser(user._id, 'bank-secret-123');
      expect(ciphertext).not.toContain('bank-secret-123');
      expect(ciphertext.startsWith('v2:')).toBe(true);
    });

    it('produces a different ciphertext each time for the same input', async () => {
      const first = await credentialEncryption.encryptForUser(user._id, 'same-value');
      const second = await credentialEncryption.encryptForUser(user._id, 'same-value');
      expect(first).not.toBe(second);
      expect(await credentialEncryption.decryptForUser(user._id, second)).toBe('same-value');
    });

    it('passes through empty values untouched', async () => {
      expect(await credentialEncryption.encryptForUser(user._id, '')).toBe('');
      expect(await credentialEncryption.encryptForUser(user._id, null)).toBeNull();
      expect(await credentialEncryption.decryptForUser(user._id, undefined)).toBeUndefined();
    });

    it('handles unicode credentials', async () => {
      const secret = 'סיסמה-סודית-🔐';
      const ciphertext = await credentialEncryption.encryptForUser(user._id, secret);
      expect(await credentialEncryption.decryptForUser(user._id, ciphertext)).toBe(secret);
    });
  });

  describe('per-user key isolation', () => {
    it('gives each user a distinct key', async () => {
      await credentialEncryption.encryptForUser(user._id, 'a');
      await credentialEncryption.encryptForUser(otherUser._id, 'b');

      const User = require('../../../auth/models/User');
      const [first, second] = await Promise.all([
        User.findById(user._id).select('+credentialKey').lean(),
        User.findById(otherUser._id).select('+credentialKey').lean()
      ]);

      expect(first.credentialKey.wrappedDek).toBeTruthy();
      expect(second.credentialKey.wrappedDek).toBeTruthy();
      expect(first.credentialKey.wrappedDek).not.toBe(second.credentialKey.wrappedDek);
    });

    it('cannot decrypt another user\'s credentials', async () => {
      const ciphertext = await credentialEncryption.encryptForUser(user._id, 'not-yours');
      await expect(credentialEncryption.decryptForUser(otherUser._id, ciphertext))
        .rejects.toThrow();
    });

    it('reuses a user\'s key across calls instead of generating a new one', async () => {
      const User = require('../../../auth/models/User');
      await credentialEncryption.encryptForUser(user._id, 'first');
      const afterFirst = await User.findById(user._id).select('+credentialKey').lean();

      credentialEncryption.clearCache();
      const ciphertext = await credentialEncryption.encryptForUser(user._id, 'second');
      const afterSecond = await User.findById(user._id).select('+credentialKey').lean();

      expect(afterSecond.credentialKey.wrappedDek).toBe(afterFirst.credentialKey.wrappedDek);
      expect(await credentialEncryption.decryptForUser(user._id, ciphertext)).toBe('second');
    });

    it('resolves concurrent first use to a single key', async () => {
      const User = require('../../../auth/models/User');
      const ciphertexts = await Promise.all(
        ['a', 'b', 'c', 'd'].map((v) => credentialEncryption.encryptForUser(user._id, v))
      );

      const stored = await User.findById(user._id).select('+credentialKey').lean();
      expect(stored.credentialKey.wrappedDek).toBeTruthy();

      const decrypted = await Promise.all(
        ciphertexts.map((c) => credentialEncryption.decryptForUser(user._id, c))
      );
      expect(decrypted).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('tamper detection', () => {
    it('rejects a modified ciphertext', async () => {
      const ciphertext = await credentialEncryption.encryptForUser(user._id, 'bank-secret-123');
      const [version, iv, tag, body] = ciphertext.split(':');
      const flipped = Buffer.from(body, 'base64');
      flipped[0] ^= 0xff;

      await expect(
        credentialEncryption.decryptForUser(
          user._id,
          [version, iv, tag, flipped.toString('base64')].join(':')
        )
      ).rejects.toThrow();
    });

    it('rejects a value that is not in the expected format', async () => {
      await expect(credentialEncryption.decryptForUser(user._id, 'plaintext'))
        .rejects.toThrow('not in the expected encrypted format');
    });
  });

  describe('key material handling', () => {
    it('never exposes the wrapped key through a default query', async () => {
      await credentialEncryption.encryptForUser(user._id, 'secret');
      const User = require('../../../auth/models/User');
      const fetched = await User.findById(user._id);
      expect(fetched.credentialKey).toBeUndefined();
      expect(JSON.stringify(fetched.toJSON())).not.toContain('wrappedDek');
    });

    it('records the key identifier used to wrap, so the key can be rotated', async () => {
      await credentialEncryption.encryptForUser(user._id, 'secret');
      const User = require('../../../auth/models/User');
      const stored = await User.findById(user._id).select('+credentialKey').lean();
      expect(stored.credentialKey.kekId).toBe(getKekProvider().keyId);
      expect(stored.credentialKey.wrappedAt).toBeInstanceOf(Date);
    });

    it('refuses to unwrap a key that a different KEK wrapped', async () => {
      await credentialEncryption.encryptForUser(user._id, 'secret');
      credentialEncryption.clearCache();

      const original = getKekProvider();
      try {
        setKekProvider(new LocalKekProvider({ secret: 'a-completely-different-secret-key' }));
        await expect(credentialEncryption.encryptForUser(user._id, 'secret')).rejects.toThrow();
      } finally {
        setKekProvider(original);
        credentialEncryption.clearCache();
      }
    });

    it('fails closed when the user does not exist', async () => {
      const mongoose = require('mongoose');
      await expect(
        credentialEncryption.encryptForUser(new mongoose.Types.ObjectId(), 'secret')
      ).rejects.toThrow('was not found');
    });

    it('requires a user id', async () => {
      await expect(credentialEncryption.encryptForUser(null, 'secret'))
        .rejects.toThrow('userId is required');
    });
  });

  describe('isEncrypted', () => {
    it('recognises its own output', async () => {
      const ciphertext = await credentialEncryption.encryptForUser(user._id, 'secret');
      expect(credentialEncryption.isEncrypted(ciphertext)).toBe(true);
    });

    it('rejects plaintext and the legacy format', () => {
      expect(credentialEncryption.isEncrypted('plaintext')).toBe(false);
      expect(credentialEncryption.isEncrypted('')).toBe(false);
      expect(credentialEncryption.isEncrypted(null)).toBe(false);
      // Legacy unauthenticated aes-256-cbc format: hex IV + ':' + hex body
      expect(credentialEncryption.isEncrypted('a'.repeat(32) + ':deadbeef')).toBe(false);
    });
  });
});
