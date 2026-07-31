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
  encryptionKey: process.env.ENCRYPTION_KEY || undefined,
  // Sign-in is delegated to GitHub; this app issues its own session JWT once
  // GitHub has confirmed who the user is. Left unset, the OAuth routes report
  // that login is unconfigured rather than failing obscurely at the redirect.
  github: {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID || undefined,
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || undefined,
    // Where the browser reaches this API. GitHub redirects back here, so it
    // must match the callback URL registered on the OAuth app exactly.
    publicApiUrl: (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, ''),
    // Where to land after a successful login when no return_to was supplied.
    defaultReturnTo: (process.env.DEFAULT_RETURN_TO || 'http://localhost:3000').replace(/\/$/, ''),
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SEC) || 7 * 24 * 60 * 60
  }
};

// The session cookie has to survive the cross-site redirect back from GitHub,
// and the frontend is served from a different origin to the API in every
// deployed environment. SameSite=None is what allows that, and browsers only
// honour it on a Secure cookie, so the two settings move together.
config.session = {
  cookieName: 'gerifinancial_session',
  secure: process.env.COOKIE_SECURE === 'true' || config.github.publicApiUrl.startsWith('https://'),
  crossSite: (() => {
    const explicit = (process.env.COOKIE_CROSS_SITE || '').trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    try {
      return new URL(config.github.publicApiUrl).origin !== new URL(config.github.defaultReturnTo).origin;
    } catch (error) {
      return false;
    }
  })()
};

// No development fallback: a committed, well-known key would silently become
// the KEK for anyone running without configuration. ENCRYPTION_KEY (or a Key
// Vault URL) is required in every environment, and LocalKekProvider reports
// clearly when neither is set. Tests set ENCRYPTION_KEY in src/test/setup.js.

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
