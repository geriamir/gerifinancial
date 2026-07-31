const crypto = require('crypto');

/**
 * Local key-encryption-key provider, used when no Azure Key Vault is configured
 * (local development, unit tests, CI). The KEK is derived from ENCRYPTION_KEY
 * via HKDF so it is domain-separated from any other use of that variable.
 *
 * This keeps the exact same wrap/unwrap contract as the Key Vault provider, so
 * application code never branches on which one is active.
 */
class LocalKekProvider {
  constructor({ secret } = {}) {
    if (!secret) {
      throw new Error(
        'ENCRYPTION_KEY must be set to use local envelope encryption. ' +
        'Set AZURE_KEY_VAULT_URL instead to use Azure Key Vault.'
      );
    }
    this.secret = secret;
    // Version the id so a future change of derivation scheme is detectable on
    // stored keys, mirroring Key Vault's versioned key identifiers.
    this.keyId = 'local:hkdf-sha256:v1';
  }

  get name() {
    return 'local';
  }

  deriveWrappingKey() {
    return Buffer.from(crypto.hkdfSync(
      'sha256',
      Buffer.from(this.secret),
      Buffer.alloc(0),
      Buffer.from('gerifinancial/credential-kek/v1'),
      32
    ));
  }

  async wrapKey(dek) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.deriveWrappingKey(), iv);
    const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      wrappedDek: Buffer.concat([iv, tag, wrapped]).toString('base64'),
      kekId: this.keyId
    };
  }

  async unwrapKey(wrappedDek, kekId) {
    if (kekId && kekId !== this.keyId) {
      throw new Error(
        `Cannot unwrap a key that was wrapped by "${kekId}" using the local KEK provider. ` +
        'Configure AZURE_KEY_VAULT_URL to point at the vault that holds that key.'
      );
    }
    const raw = Buffer.from(wrappedDek, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.deriveWrappingKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}

module.exports = LocalKekProvider;
