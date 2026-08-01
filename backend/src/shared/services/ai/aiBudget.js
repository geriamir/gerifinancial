const Redis = require('ioredis');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * Raised when a user has spent their daily token allowance.
 *
 * Distinct from a generic failure so callers can degrade deliberately - fall
 * back to the rule-based classifier, tell the user their assistant is resting
 * until tomorrow - rather than surfacing it as an error.
 */
class AiBudgetExceededError extends Error {
  constructor(userId, used, limit) {
    super(`Daily AI token budget exhausted (${used}/${limit})`);
    this.name = 'AiBudgetExceededError';
    this.code = 'AI_BUDGET_EXCEEDED';
    this.userId = String(userId);
    this.used = used;
    this.limit = limit;
  }
}

// Counters are kept a little beyond the day they describe so that clock skew or
// a late-arriving usage record cannot resurrect an expired key with no TTL.
const COUNTER_TTL_SECONDS = 48 * 60 * 60;

/**
 * Per-user daily token budget, counted in Redis.
 *
 * This is a spend control, not a fairness control: every other limit in this app
 * protects a bank or a database, but this one protects a bill. The paths that
 * call a model are loops - a scrape categorising hundreds of transactions, a
 * chat turn fanning out over a user's history - so an unbounded retry is the
 * expected failure here, not an exotic one.
 *
 * Counting is per user rather than global. A shared pool would let one runaway
 * account deny the feature to everyone else, and would make the limit useless as
 * a signal of which account misbehaved.
 */
class AiBudgetService {
  constructor() {
    this.redis = null;
  }

  async initialize() {
    if (this.redis) return;

    this.redis = new Redis({
      ...config.redis,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true
    });

    await this.redis.connect();
    logger.info('AI budget service initialized');
  }

  // UTC rather than local time: the counter has to agree across restarts and any
  // future replica, and "the user's day" is not worth the ambiguity here.
  keyFor(userId, now = new Date()) {
    return `ai:budget:${userId}:${now.toISOString().slice(0, 10)}`;
  }

  async getUsage(userId) {
    await this.initialize();
    const used = await this.redis.get(this.keyFor(userId));
    return Number(used) || 0;
  }

  /**
   * Throws if the user has nothing left to spend today.
   *
   * Checked before a request rather than after, because the cost of a request is
   * only known once it has already been paid for. A request that starts just
   * under the line is allowed to finish, so the effective ceiling is the budget
   * plus one request - bounded, and far simpler than reserving an estimate up
   * front and reconciling it afterwards.
   */
  async assertWithinBudget(userId) {
    const limit = config.ai.dailyTokenBudget;
    if (!limit || limit <= 0) return { used: 0, limit: 0, remaining: Infinity };

    // Redis being unreachable fails the request closed. Failing open would mean
    // an outage in the one component enforcing the ceiling silently removes the
    // ceiling, which is the wrong way round for something that spends money. AI
    // features are enhancements, so refusing them for the duration of a Redis
    // outage is a cheap trade.
    const used = await this.getUsage(userId);
    if (used >= limit) {
      throw new AiBudgetExceededError(userId, used, limit);
    }
    return { used, limit, remaining: limit - used };
  }

  /**
   * Records tokens actually consumed. Never throws: the request has already been
   * billed by the time this runs, so losing the record must not also lose the
   * caller's result.
   */
  async record(userId, tokens) {
    if (!tokens || tokens <= 0) return;

    try {
      await this.initialize();
      const key = this.keyFor(userId);
      const total = await this.redis.incrby(key, tokens);
      // Only set the expiry when the key is new. Re-setting it on every call
      // would slide the window forward and never let the counter reset.
      if (total === tokens) {
        await this.redis.expire(key, COUNTER_TTL_SECONDS);
      }
    } catch (error) {
      logger.error('Failed to record AI token usage:', error);
    }
  }

  async reset(userId) {
    await this.initialize();
    await this.redis.del(this.keyFor(userId));
  }

  async close() {
    if (!this.redis) return;
    await this.redis.quit();
    this.redis = null;
  }
}

module.exports = new AiBudgetService();
module.exports.AiBudgetExceededError = AiBudgetExceededError;
