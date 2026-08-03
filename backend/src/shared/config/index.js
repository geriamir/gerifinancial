require('dotenv').config();

// Managed Redis services (Azure Cache for Redis, Elasticache in-transit encryption, ...)
// disable the plaintext port, so TLS has to be opt-in-able via configuration.
const redisTls = process.env.REDIS_TLS === 'true';
const redisHost = process.env.REDIS_HOST || 'localhost';

// Reads a number from the environment where 0 is a meaningful value. `||` would
// replace 0 with the default; a bare `??` would accept an empty or malformed
// variable as 0. Only something that actually parses as a number counts as set.
const numberFromEnv = (value, fallback) => {
  if (value === undefined || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
  },
  // Azure OpenAI. Authenticated with the same managed identity that reaches the
  // vaults: the account has local authentication disabled, so there is no key to
  // configure, leak or rotate. Left unset - which is the case for local
  // development and every test run - the AI features report themselves
  // unavailable instead of failing at the first call.
  ai: {
    endpoint: (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '') || undefined,
    // Deployment names rather than model names. Which model a deployment serves,
    // and at which version, is decided in infra/main.bicep.
    chatDeployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || undefined,
    embeddingDeployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || undefined,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
    requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS) || 30000,
    maxRetries: Number(process.env.AI_MAX_RETRIES) || 2,
    // A per-user daily ceiling on tokens. Unlike every other quota in this app,
    // exceeding this one costs real money, and the paths that will call the
    // model - categorising a scrape, answering questions about transactions -
    // are all loops that a bug could run away with. The cap is per user so one
    // account cannot spend everyone else's allowance. Read so that 0, which
    // switches the ceiling off, survives - but an empty or unparseable variable
    // falls back to the default rather than silently removing the cap.
    dailyTokenBudget: numberFromEnv(process.env.AI_DAILY_TOKEN_BUDGET, 200000),
    // How a transaction is matched against the user's own past corrections.
    // Exposed as settings rather than constants so the evaluation script can
    // sweep them without a code change.
    knn: {
      // Cosine similarity below which two descriptions are not considered
      // related at all.
      //
      // Measured against text-embedding-3-small on the fixture set rather than
      // guessed: the same Israeli merchant written two different ways scores
      // 0.42-0.53, while merchants belonging to different categories score
      // 0.17-0.28. This sits in the gap. It is deliberately nearer the noise
      // than the signal, because the vote below is what rejects a bad match -
      // this only decides what is allowed to vote at all.
      minSimilarity: Number(process.env.AI_KNN_MIN_SIMILARITY) || 0.35,
      // How many neighbours vote.
      neighbours: Number(process.env.AI_KNN_NEIGHBOURS) || 5,
      // Share of the vote the winner needs. Below this the neighbours disagree
      // too much to act on, and staying silent beats being confidently wrong -
      // a wrong category is worse than none, because the user has to notice it
      // before they can fix it.
      minConfidence: Number(process.env.AI_KNN_MIN_CONFIDENCE) || 0.6
    },
    // The last tier of categorisation: asking the model to pick from the user's
    // own categories. Everything ahead of it learns from corrections the user
    // has made, so all of it is silent on a first scrape - which is exactly when
    // the uncategorised list is longest.
    llm: {
      // Unlike the tiers above it, this one costs money per transaction. It
      // needs a chat deployment to exist at all, which is already a deliberate
      // choice, so it is on once that is configured - but it can be switched off
      // on its own without giving up the rest of the AI features.
      categorization: process.env.AI_LLM_CATEGORIZATION !== 'false',
      // How sure the model has to claim to be. Stated confidence is a weak
      // signal on its own, which is why the answer is also resolved against the
      // user's real categories - this only filters the cases where the model
      // itself is hedging.
      minConfidence: numberFromEnv(process.env.AI_LLM_MIN_CONFIDENCE, 0.7),
      // The reply is a single small JSON object. Capping it keeps a model that
      // decides to explain itself from being charged for the essay. This is the
      // allowance per transaction; a batched call is given it once per item,
      // because a truncated reply loses the whole batch rather than one answer.
      maxTokens: Number(process.env.AI_LLM_MAX_COMPLETION_TOKENS) || 300,
      // How many fall-through transactions to put in one request. The category
      // list is by far the largest part of the prompt and is identical for every
      // transaction in a group, so asking about ten at once sends it once
      // instead of ten times. Measured at ~730 input tokens per single call
      // against ~940 for a batch of ten. Set to 1 to go back to one call each.
      batchSize: Number(process.env.AI_LLM_BATCH_SIZE) || 10,
      // How many transactions the model never got to are pulled back in per
      // scrape, newest first.
      //
      // Sized against what a day's token budget can pay for rather than against
      // the backlog: anything enqueued beyond that allowance simply runs into
      // the same spent budget and is marked outstanding again, so a larger
      // number adds queue traffic without categorising anything more. A large
      // first import therefore converges over several days instead of in one
      // go, which is the intended trade.
      //
      // 0 is meaningful here - it is the off switch, honoured by `outstanding`.
      resumeLimit: numberFromEnv(process.env.AI_LLM_RESUME_LIMIT, 1000),
      // Drafting a project from a description. Deliberately its own switch
      // rather than riding on `categorization`: that one exists to stop paying
      // per transaction on every scrape, whereas this is one request a user
      // asked for by typing a description, so wanting one without the other is
      // the normal case in both directions.
      projectDrafting: process.env.AI_LLM_PROJECT_DRAFTING !== 'false'
    }
  }
};

// Every AI feature checks this rather than testing the individual settings, so
// a half-configured environment behaves the same as an unconfigured one.
config.ai.enabled = Boolean(config.ai.endpoint && config.ai.chatDeployment);

// Tracked separately because matching transactions needs only embeddings. A
// deployment serving chat is a different, more expensive thing to provision, and
// categorisation should not be switched off just because it is absent.
config.ai.embeddingsEnabled = Boolean(config.ai.endpoint && config.ai.embeddingDeployment);

// The session cookie has to reach the API from the frontend, which is served
// from a different origin in every deployed environment. SameSite=None is what
// allows that, and browsers *drop* a SameSite=None cookie that is not also
// Secure - so the two genuinely move together and cross-site is gated on it.
//
// Over plain http (local dev and e2e) the frontend and API differ only by
// port, which does not make them cross-site, so SameSite=Lax works there.
const cookieSecure =
  process.env.COOKIE_SECURE === 'true' || config.github.publicApiUrl.startsWith('https://');

const wantsCrossSite = (() => {
  const explicit = (process.env.COOKIE_CROSS_SITE || '').trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  try {
    return new URL(config.github.publicApiUrl).origin !== new URL(config.github.defaultReturnTo).origin;
  } catch (error) {
    return false;
  }
})();

config.session = {
  cookieName: 'gerifinancial_session',
  secure: cookieSecure,
  crossSite: cookieSecure && wantsCrossSite
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
// Exposed for tests: the rule for reading a setting where 0 is a real value and
// an empty variable is not.
module.exports._internals = { numberFromEnv };
