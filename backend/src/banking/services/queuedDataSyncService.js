const scrapingQueue = require('../../shared/services/scrapingQueue');
const scrapingJobProcessors = require('./scrapingJobProcessors');
const { BankAccount } = require('../models');
const logger = require('../../shared/utils/logger');

/**
 * Queued Data Sync Service
 * Uses producer-consumer pattern with Bull queues for scalable scraping
 */
class QueuedDataSyncService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the queued sync service
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize the scraping queue
      await scrapingQueue.initialize();
      
      // Register job processors
      await scrapingJobProcessors.registerProcessors();
      
      // Start processing jobs
      await scrapingQueue.startProcessing();
      
      this.isInitialized = true;
      logger.info('Queued data sync service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize queued data sync service:', error);
      throw error;
    }
  }

  /**
   * Queue sync jobs for a bank account
   * Creates separate jobs for each strategy
   */
  async queueBankAccountSync(bankAccountId, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const bankAccount = await BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      throw new Error(`Bank account not found: ${bankAccountId}`);
    }

    logger.info(`Queueing sync jobs for bank account ${bankAccount.name} (${bankAccountId})`);

    const jobIds = [];
    const strategies = bankAccount.bankId === 'mercury'
      ? ['mercury-checking']
      : bankAccount.bankId === 'ibkr'
      ? ['ibkr-flex']
      : bankAccount.bankId === 'phoenix'
      ? [] // Phoenix requires OTP — sync via pension OTP flow, not queue
      : ['checking-accounts', 'investment-portfolios', 'foreign-currency'];
    
    // Determine job priority based on account or options
    const priority = this.determinePriority(bankAccount, options);

    try {
      // Queue each strategy as a separate job
      for (const strategyName of strategies) {
        const jobId = await scrapingQueue.addScrapingJob(
          'scrape-strategy',
          bankAccountId,
          strategyName,
          {
            options,
            accountName: bankAccount.name,
            userId: bankAccount.userId
          },
          {
            priority,
            attempts: options.attempts || 3,
            timeout: options.timeout || 300000, // 5 minutes
            delay: options.delay || 0
          }
        );

        jobIds.push({
          jobId,
          strategyName,
          priority
        });

        logger.info(`Queued ${strategyName} sync job ${jobId} for account ${bankAccountId}`);
      }

      logger.info(`Successfully queued ${jobIds.length} sync jobs for account ${bankAccountId}:`, 
        jobIds.map(j => `${j.strategyName}:${j.jobId}`));

      return {
        bankAccountId,
        accountName: bankAccount.name,
        queuedJobs: jobIds,
        totalJobs: jobIds.length,
        priority
      };

    } catch (error) {
      logger.error(`Failed to queue sync jobs for account ${bankAccountId}:`, error);
      throw error;
    }
  }

  /**
   * Queue sync jobs for multiple bank accounts
   */
  async queueMultipleAccountsSync(accountFilters = {}, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Default filter: active accounts only
    const filters = {
      status: 'active',
      ...accountFilters
    };

    const bankAccounts = await BankAccount.find(filters);
    
    if (bankAccounts.length === 0) {
      logger.info('No bank accounts found matching filters:', filters);
      return {
        totalAccounts: 0,
        queuedAccounts: [],
        totalJobs: 0
      };
    }

    logger.info(`Queueing sync jobs for ${bankAccounts.length} bank accounts`);

    const results = [];
    let totalJobs = 0;

    for (const bankAccount of bankAccounts) {
      try {
        const result = await this.queueBankAccountSync(bankAccount._id, options);
        results.push(result);
        totalJobs += result.totalJobs;

        // Add small delay between accounts to avoid overwhelming the system
        if (options.delayBetweenAccounts) {
          await new Promise(resolve => setTimeout(resolve, options.delayBetweenAccounts));
        }

      } catch (error) {
        logger.error(`Failed to queue sync for account ${bankAccount._id}:`, error);
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

    logger.info(`Queued sync jobs for ${successfulAccounts.length}/${bankAccounts.length} accounts, total jobs: ${totalJobs}`);

    return {
      totalAccounts: bankAccounts.length,
      successfulAccounts: successfulAccounts.length,
      failedAccounts: failedAccounts.length,
      queuedAccounts: results,
      totalJobs
    };
  }

  /**
   * Queue a specific strategy for a specific account
   */
  async queueStrategySync(bankAccountId, strategyName, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const bankAccount = await BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      throw new Error(`Bank account not found: ${bankAccountId}`);
    }

    const validStrategies = ['checking-accounts', 'investment-portfolios', 'foreign-currency', 'mercury-checking', 'ibkr-flex'];
    if (!validStrategies.includes(strategyName)) {
      throw new Error(`Invalid strategy: ${strategyName}. Valid strategies: ${validStrategies.join(', ')}`);
    }

    const priority = this.determinePriority(bankAccount, options);

    const jobId = await scrapingQueue.addScrapingJob(
      'scrape-strategy',
      bankAccountId,
      strategyName,
      {
        options,
        accountName: bankAccount.name,
        userId: bankAccount.userId
      },
      {
        priority,
        attempts: options.attempts || 3,
        timeout: options.timeout || 300000,
        delay: options.delay || 0
      }
    );

    logger.info(`Queued ${strategyName} sync job ${jobId} for account ${bankAccountId}`);

    return {
      jobId,
      bankAccountId,
      accountName: bankAccount.name,
      strategyName,
      priority
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    if (!this.isInitialized) {
      return { error: 'Service not initialized' };
    }

    return await scrapingQueue.getAllStats();
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    return await scrapingQueue.healthCheck();
  }

  /**
   * Determine job priority based on account and options
   */
  determinePriority(bankAccount, options = {}) {
    // Priority logic:
    // 1. If explicitly set in options, use it
    if (options.priority) {
      return options.priority;
    }

    // 2. High priority for recently created accounts (within 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (bankAccount.createdAt > oneDayAgo) {
      return 'high';
    }

    // 3. High priority for accounts that haven't been scraped recently
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    if (!bankAccount.lastScraped || bankAccount.lastScraped < threeDaysAgo) {
      return 'high';
    }

    // 4. Normal priority for regular accounts
    return 'normal';
  }

  /**
   * Pause all queues
   */
  async pauseQueues() {
    if (!this.isInitialized) return;

    const queueNames = ['scraping-high', 'scraping-normal', 'scraping-low'];
    for (const queueName of queueNames) {
      await scrapingQueue.pauseQueue(queueName);
    }

    logger.info('Paused all scraping queues');
  }

  /**
   * Resume all queues
   */
  async resumeQueues() {
    if (!this.isInitialized) return;

    const queueNames = ['scraping-high', 'scraping-normal', 'scraping-low'];
    for (const queueName of queueNames) {
      await scrapingQueue.resumeQueue(queueName);
    }

    logger.info('Resumed all scraping queues');
  }

  /**
   * Clear all queues
   */
  async clearQueues() {
    if (!this.isInitialized) return;

    const queueNames = ['scraping-high', 'scraping-normal', 'scraping-low'];
    for (const queueName of queueNames) {
      await scrapingQueue.clearQueue(queueName);
    }

    logger.info('Cleared all scraping queues');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (!this.isInitialized) return;

    await scrapingQueue.shutdown();
    this.isInitialized = false;

    logger.info('Queued data sync service shutdown complete');
  }
}

// Singleton instance
const queuedDataSyncService = new QueuedDataSyncService();

module.exports = queuedDataSyncService;
