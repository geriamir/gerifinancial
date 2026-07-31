const { DefaultAzureCredential } = require('@azure/identity');
const { KeyClient, CryptographyClient, KnownEncryptionAlgorithms } = require('@azure/keyvault-keys');

// Azure Key Vault (non-Managed-HSM) only supports RSA and EC keys, so the KEK
// is an RSA key and DEKs are wrapped with RSA-OAEP-256.
const WRAP_ALGORITHM = KnownEncryptionAlgorithms.RSAOaep256;

// The current key version is looked up rather than hardcoded, so rotating the
// KEK in Key Vault is picked up without a redeploy. Cached briefly because
// wrapping only happens once per user.
const CURRENT_KEY_TTL_MS = 60 * 60 * 1000;

/**
 * Key-encryption-key provider backed by Azure Key Vault.
 *
 * The KEK never leaves the vault: wrap and unwrap are performed by the service,
 * so a database dump alone is not enough to recover any user's credentials.
 */
class AzureKeyVaultKekProvider {
  constructor({ vaultUrl, keyName, credential } = {}) {
    if (!vaultUrl) {
      throw new Error('AZURE_KEY_VAULT_URL is required for the Azure Key Vault KEK provider');
    }
    this.vaultUrl = vaultUrl;
    this.keyName = keyName;
    this.credential = credential || new DefaultAzureCredential({
      // Container Apps uses a user-assigned identity; DefaultAzureCredential
      // needs its client id to know which one to request a token for.
      managedIdentityClientId: process.env.AZURE_CLIENT_ID
    });
    this.keyClient = new KeyClient(this.vaultUrl, this.credential);
    this.cryptoClients = new Map();
    this.currentKey = null;
  }

  get name() {
    return 'azure-key-vault';
  }

  async getCurrentKeyId() {
    if (this.currentKey && this.currentKey.expiresAt > Date.now()) {
      return this.currentKey.id;
    }
    const key = await this.keyClient.getKey(this.keyName);
    if (!key || !key.id) {
      throw new Error(`Key "${this.keyName}" was not found in ${this.vaultUrl}`);
    }
    this.currentKey = { id: key.id, expiresAt: Date.now() + CURRENT_KEY_TTL_MS };
    return key.id;
  }

  // Keyed by the fully versioned key identifier so DEKs wrapped with an older
  // KEK version keep unwrapping correctly after a rotation.
  getCryptoClient(keyId) {
    let client = this.cryptoClients.get(keyId);
    if (!client) {
      client = new CryptographyClient(keyId, this.credential);
      this.cryptoClients.set(keyId, client);
    }
    return client;
  }

  async wrapKey(dek) {
    const keyId = await this.getCurrentKeyId();
    const result = await this.getCryptoClient(keyId).wrapKey(WRAP_ALGORITHM, dek);
    return {
      wrappedDek: Buffer.from(result.result).toString('base64'),
      kekId: keyId
    };
  }

  async unwrapKey(wrappedDek, kekId) {
    const keyId = kekId || await this.getCurrentKeyId();
    const result = await this.getCryptoClient(keyId).unwrapKey(
      WRAP_ALGORITHM,
      Buffer.from(wrappedDek, 'base64')
    );
    return Buffer.from(result.result);
  }
}

module.exports = AzureKeyVaultKekProvider;
