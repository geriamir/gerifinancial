const Redis = require('ioredis');
const config = require('../config');

let client = null;

/**
 * Redis is only connected lazily, when a scrape is queued. That means a broken Redis
 * configuration stays invisible until the first scrape fails, so the health endpoint
 * keeps its own connection purely to report reachability.
 */
function getClient() {
  if (client) {
    return client;
  }

  client = new Redis({
    ...config.redis,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1
  });

  // ioredis emits 'error' on every failed reconnect attempt; without a listener those
  // become unhandled events and take the process down.
  client.on('error', () => {});

  return client;
}

async function checkRedis() {
  // The test suites run with --detectOpenHandles and have no Redis available, so an
  // endlessly reconnecting client would keep Jest from exiting.
  if (config.env === 'test' || config.env === 'e2e') {
    return 'skipped';
  }

  try {
    const redis = getClient();
    if (redis.status !== 'ready') {
      return 'disconnected';
    }
    await redis.ping();
    return 'connected';
  } catch (error) {
    return 'disconnected';
  }
}

module.exports = { checkRedis };
