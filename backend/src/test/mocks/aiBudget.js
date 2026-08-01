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

// In-memory rather than Redis-backed: the suite has no Redis, and the behaviour
// under test is the accounting, not the storage.
let usage = new Map();
let limit = 200000;

module.exports = {
  initialize: jest.fn(async () => {}),

  keyFor: jest.fn((userId) => `ai:budget:${userId}`),

  getUsage: jest.fn(async (userId) => usage.get(String(userId)) || 0),

  assertWithinBudget: jest.fn(async (userId) => {
    if (!limit || limit <= 0) return { used: 0, limit: 0, remaining: Infinity };
    const used = usage.get(String(userId)) || 0;
    if (used >= limit) throw new AiBudgetExceededError(userId, used, limit);
    return { used, limit, remaining: limit - used };
  }),

  record: jest.fn(async (userId, tokens) => {
    if (!tokens || tokens <= 0) return;
    const key = String(userId);
    usage.set(key, (usage.get(key) || 0) + tokens);
  }),

  reset: jest.fn(async (userId) => { usage.delete(String(userId)); }),

  close: jest.fn(async () => {}),

  AiBudgetExceededError,

  // Test controls
  __setLimit: (value) => { limit = value; },
  __reset: () => { usage = new Map(); limit = 200000; }
};
