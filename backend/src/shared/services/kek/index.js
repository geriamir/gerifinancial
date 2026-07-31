const config = require('../../config');
const logger = require('../../utils/logger');
const LocalKekProvider = require('./localKekProvider');
const AzureKeyVaultKekProvider = require('./azureKeyVaultKekProvider');

let provider = null;

/**
 * Returns the configured key-encryption-key provider.
 *
 * Azure Key Vault is used whenever a vault URL is configured; otherwise the KEK
 * is derived locally from ENCRYPTION_KEY so local development and the test
 * suite run without any cloud dependency.
 */
function getKekProvider() {
  if (provider) return provider;

  if (config.keyVault.url) {
    provider = new AzureKeyVaultKekProvider({
      vaultUrl: config.keyVault.url,
      keyName: config.keyVault.keyName
    });
    logger.info(`Envelope encryption using Azure Key Vault key "${config.keyVault.keyName}"`);
  } else {
    provider = new LocalKekProvider({
      // Read through to the environment so a suite that sets ENCRYPTION_KEY
      // after config was first required still gets the right key.
      secret: process.env.ENCRYPTION_KEY || config.encryptionKey
    });
    logger.warn('Envelope encryption using a locally derived key. Do not use this in production.');
  }

  return provider;
}

// Test seam: lets suites swap in a provider or force re-selection after
// changing configuration.
function setKekProvider(next) {
  provider = next;
}

module.exports = { getKekProvider, setKekProvider, LocalKekProvider, AzureKeyVaultKekProvider };
