require('dotenv').config();

// Managed Redis services (Azure Cache for Redis, Elasticache in-transit encryption, ...)
// disable the plaintext port, so TLS has to be opt-in-able via configuration.
const redisTls = process.env.REDIS_TLS === 'true';
const redisHost = process.env.REDIS_HOST || 'localhost';

const config = {
  port: process.env.PORT || 3001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27777/gerifinancial',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  env: process.env.NODE_ENV || 'development',
  redis: {
    host: redisHost,
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB) || 0,
    ...(redisTls ? { tls: { servername: redisHost } } : {})
  },
  // Envelope encryption for bank credentials. Each user gets their own data
  // encryption key (DEK), wrapped by a key encryption key (KEK). When a vault
  // URL is configured the KEK lives in Azure Key Vault and never leaves it;
  // otherwise the KEK is derived locally from ENCRYPTION_KEY.
  keyVault: {
    url: process.env.AZURE_KEY_VAULT_URL || undefined,
    keyName: process.env.AZURE_KEY_VAULT_KEY_NAME || 'credential-kek',
    // Unwrapping a DEK costs a Key Vault round trip, so unwrapped DEKs are
    // cached in memory for this long.
    dekCacheTtlMs: Number(process.env.DEK_CACHE_TTL_MS) || 15 * 60 * 1000
  },
  encryptionKey: process.env.ENCRYPTION_KEY || undefined
};

// Outside production a locally derived key keeps development and tests running
// without an Azure Key Vault. In production the key must be supplied.
if (!config.encryptionKey && config.env !== 'production') {
  config.encryptionKey = 'development-only-encryption-key-do-not-use-in-production';
}

// Override configuration for test/e2e environments
if (process.env.NODE_ENV === 'test') {
  // Use in-memory database for unit tests
  config.mongodbUri = 'mongodb://localhost:27777/gerifinancial-test';
  config.jwtSecret = 'test-secret';
  config.jwtExpiration = '1h';
} else if (process.env.NODE_ENV === 'e2e') {
  // Use real database with e2e suffix for end-to-end tests
  config.mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gerifinancial-e2e';
  config.jwtSecret = 'e2e-secret';
  config.jwtExpiration = '1h';
}

module.exports = config;
