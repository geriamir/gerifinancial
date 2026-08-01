// The global setup replaces this module with a stub so no other test can spend
// money. This is the one file that wants the real thing.
jest.unmock('../aiBudget');

// A minimal Redis that keeps counters in a Map. Only the four commands the
// budget uses are implemented; anything else should fail loudly rather than
// quietly return undefined and make a broken test look green.
// The `mock` prefix is what lets jest's factory hoisting reference these.
const mockStore = new Map();
const mockExpiries = new Map();
const mockRedisState = { connectShouldFail: false };

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(async () => {
      if (mockRedisState.connectShouldFail) throw new Error('Redis unreachable');
    }),
    get: jest.fn(async (key) => (mockStore.has(key) ? String(mockStore.get(key)) : null)),
    incrby: jest.fn(async (key, by) => {
      const next = (mockStore.get(key) || 0) + by;
      mockStore.set(key, next);
      return next;
    }),
    expire: jest.fn(async (key, seconds) => {
      mockExpiries.set(key, seconds);
      return 1;
    }),
    del: jest.fn(async (key) => {
      mockStore.delete(key);
      mockExpiries.delete(key);
      return 1;
    }),
    quit: jest.fn(async () => 'OK')
  }));
});

describe('aiBudget', () => {
  let aiBudget;
  let config;
  let AiBudgetExceededError;
  const userId = 'user-1';

  beforeEach(() => {
    mockStore.clear();
    mockExpiries.clear();
    mockRedisState.connectShouldFail = false;

    // Both requires have to happen after the reset and from the same registry,
    // or the budget would read a different config object than the one set here.
    jest.resetModules();
    config = require('../../../config');
    aiBudget = require('../aiBudget');
    AiBudgetExceededError = aiBudget.AiBudgetExceededError;

    config.ai.dailyTokenBudget = 1000;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('assertWithinBudget', () => {
    it('allows a user who has spent nothing', async () => {
      await expect(aiBudget.assertWithinBudget(userId)).resolves.toEqual({
        used: 0,
        limit: 1000,
        remaining: 1000
      });
    });

    it('allows a user who is under the limit', async () => {
      await aiBudget.record(userId, 999);
      const result = await aiBudget.assertWithinBudget(userId);
      expect(result).toEqual({ used: 999, limit: 1000, remaining: 1 });
    });

    it('rejects once the limit is reached', async () => {
      await aiBudget.record(userId, 1000);
      await expect(aiBudget.assertWithinBudget(userId)).rejects.toThrow(AiBudgetExceededError);
    });

    it('carries the numbers on the error so a caller can explain itself', async () => {
      await aiBudget.record(userId, 1500);
      const error = await aiBudget.assertWithinBudget(userId).catch((e) => e);
      expect(error.code).toBe('AI_BUDGET_EXCEEDED');
      expect(error.used).toBe(1500);
      expect(error.limit).toBe(1000);
      expect(error.userId).toBe(userId);
    });

    it('budgets each user separately, so one user cannot exhaust another', async () => {
      await aiBudget.record('heavy-user', 5000);
      await expect(aiBudget.assertWithinBudget('heavy-user')).rejects.toThrow(AiBudgetExceededError);
      await expect(aiBudget.assertWithinBudget('light-user')).resolves.toMatchObject({ used: 0 });
    });

    it('treats a budget of zero as unmetered', async () => {
      config.ai.dailyTokenBudget = 0;
      await aiBudget.record(userId, 999999);
      await expect(aiBudget.assertWithinBudget(userId)).resolves.toMatchObject({ remaining: Infinity });
    });

    // The deliberate choice: an outage in the component that enforces the
    // ceiling must not silently remove the ceiling.
    it('fails closed when Redis cannot be reached', async () => {
      mockRedisState.connectShouldFail = true;
      await expect(aiBudget.assertWithinBudget(userId)).rejects.toThrow('Redis unreachable');
    });
  });

  describe('record', () => {
    it('accumulates across calls', async () => {
      await aiBudget.record(userId, 100);
      await aiBudget.record(userId, 250);
      expect(await aiBudget.getUsage(userId)).toBe(350);
    });

    it('sets an expiry when the counter is created but does not slide it forward', async () => {
      await aiBudget.record(userId, 100);
      const key = aiBudget.keyFor(userId);
      const afterFirst = mockExpiries.get(key);
      expect(afterFirst).toBeGreaterThan(0);

      mockExpiries.delete(key);
      await aiBudget.record(userId, 100);
      // Re-arming the TTL on every write would mean an active user's counter
      // never expires and their budget never resets.
      expect(mockExpiries.has(key)).toBe(false);
    });

    it('ignores non-positive token counts', async () => {
      await aiBudget.record(userId, 0);
      await aiBudget.record(userId, -50);
      expect(await aiBudget.getUsage(userId)).toBe(0);
    });

    // The request has already been paid for by the time this runs, so a failure
    // to write the counter must not also destroy the caller's result.
    it('never throws when Redis is down', async () => {
      mockRedisState.connectShouldFail = true;
      await expect(aiBudget.record(userId, 100)).resolves.toBeUndefined();
    });
  });

  describe('keyFor', () => {
    it('buckets by UTC day', () => {
      const key = aiBudget.keyFor(userId, new Date('2026-03-01T23:30:00Z'));
      expect(key).toBe('ai:budget:user-1:2026-03-01');
    });

    it('rolls over to a new bucket on the next UTC day', () => {
      const before = aiBudget.keyFor(userId, new Date('2026-03-01T23:59:59Z'));
      const after = aiBudget.keyFor(userId, new Date('2026-03-02T00:00:01Z'));
      expect(before).not.toBe(after);
    });
  });
});
