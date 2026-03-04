/**
 * Mock queuedDataSyncService for testing
 * Simulates queue behavior without requiring Redis
 */

class MockQueuedDataSyncService {
  constructor() {
    this.isInitialized = true;
  }

  async initialize() {
    this.isInitialized = true;
  }

  async queueBankAccountSync(bankAccountId, options = {}) {
    const { BankAccount } = require('../../banking/models');
    const bankAccount = await BankAccount.findById(bankAccountId);
    
    if (!bankAccount) {
      throw new Error(`Bank account not found: ${bankAccountId}`);
    }

    const strategies = ['checking-accounts', 'investment-portfolios', 'foreign-currency', 'mercury-checking'];
    const jobIds = strategies.map((strategyName, index) => ({
      jobId: `mock-job-${bankAccountId}-${strategyName}-${Date.now()}-${index}`,
      strategyName,
      priority: options.priority || 'normal'
    }));

    return {
      bankAccountId,
      accountName: bankAccount.name,
      queuedJobs: jobIds,
      totalJobs: jobIds.length,
      priority: options.priority || 'normal'
    };
  }

  async queueMultipleAccountsSync(accountFilters = {}, options = {}) {
    const { BankAccount } = require('../../banking/models');
    
    const filters = {
      status: 'active',
      ...accountFilters
    };

    const bankAccounts = await BankAccount.find(filters);
    
    if (bankAccounts.length === 0) {
      return {
        totalAccounts: 0,
        successfulAccounts: 0,
        failedAccounts: 0,
        queuedAccounts: [],
        totalJobs: 0
      };
    }

    const results = [];
    let totalJobs = 0;

    for (const bankAccount of bankAccounts) {
      try {
        const result = await this.queueBankAccountSync(bankAccount._id, options);
        results.push(result);
        totalJobs += result.totalJobs;
      } catch (error) {
        results.push({
          bankAccountId: bankAccount._id,
          accountName: bankAccount.name,
          error: error.message,
          queuedJobs: [],
          totalJobs: 0
        });
      }
    }

    const successfulAccounts = results.filter(r => !r.error);
    const failedAccounts = results.filter(r => r.error);

    return {
      totalAccounts: bankAccounts.length,
      successfulAccounts: successfulAccounts.length,
      failedAccounts: failedAccounts.length,
      queuedAccounts: results,
      totalJobs
    };
  }

  async queueStrategySync(bankAccountId, strategyName, options = {}) {
    const { BankAccount } = require('../../banking/models');
    const bankAccount = await BankAccount.findById(bankAccountId);
    
    if (!bankAccount) {
      throw new Error(`Bank account not found: ${bankAccountId}`);
    }

    const validStrategies = ['checking-accounts', 'investment-portfolios', 'foreign-currency', 'mercury-checking'];
    if (!validStrategies.includes(strategyName)) {
      throw new Error(`Invalid strategy: ${strategyName}`);
    }

    const jobId = `mock-job-${bankAccountId}-${strategyName}-${Date.now()}`;

    return {
      jobId,
      bankAccountId,
      accountName: bankAccount.name,
      strategyName,
      priority: options.priority || 'normal'
    };
  }

  async getQueueStats() {
    return {
      'scraping-high': { waiting: 0, active: 0, completed: 0, failed: 0 },
      'scraping-normal': { waiting: 0, active: 0, completed: 0, failed: 0 },
      'scraping-low': { waiting: 0, active: 0, completed: 0, failed: 0 }
    };
  }

  async getHealthStatus() {
    return { status: 'healthy', message: 'Mock queue service' };
  }

  async pauseQueues() {}
  async resumeQueues() {}
  async clearQueues() {}
  async shutdown() {}
}

module.exports = new MockQueuedDataSyncService();
