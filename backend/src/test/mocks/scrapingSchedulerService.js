// Mock implementation of scrapingSchedulerService for tests
class MockScrapingSchedulerService {
  constructor() {
    this.jobs = new Map();
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    // Don't actually initialize anything in tests
    return Promise.resolve();
  }

  scheduleAccount(account) {
    // Mock scheduling - don't actually create cron jobs
    this.jobs.set(account._id.toString(), { mock: true });
  }

  stopAccount(accountId) {
    this.jobs.delete(accountId.toString());
  }

  stopAll() {
    this.jobs.clear();
  }
}

module.exports = new MockScrapingSchedulerService();
