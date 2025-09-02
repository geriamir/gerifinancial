const cron = require('node-cron');
const { BankAccount } = require('../models');
const dataSyncService = require('./dataSyncService');
const logger = require('../utils/logger');
const rateLimiter = require('../utils/rateLimiter');

class ScrapingSchedulerService {
  constructor() {
    this.jobs = new Map();
    this.rateLimiter = rateLimiter.createLimiter({
      maxRequests: 1,  // One request at a time
      perSeconds: 60   // per minute per bank
    });
  }

  /**
   * Start scheduling scraping jobs for all active bank accounts
   */
  async initialize() {
    try {
      // Cancel any existing jobs
      this.stopAll();

      // Get all active bank accounts
      const accounts = await BankAccount.find({ status: 'active' });
      
      // Schedule jobs for each account
      accounts.forEach(account => {
        this.scheduleAccount(account);
      });

      logger.info(`Initialized scraping scheduler with ${accounts.length} accounts`);
    } catch (error) {
      logger.error('Failed to initialize scraping scheduler:', error);
      throw error;
    }
  }

  /**
   * Schedule scraping for a specific bank account
   */
  scheduleAccount(account) {
    // Run daily at 3 AM
    const job = cron.schedule('0 3 * * *', async () => {
      try {
        // Use rate limiter to prevent overwhelming the bank's API
        await this.rateLimiter.acquire(account.bankId);
        
        logger.info(`Starting scheduled scraping for account ${account._id}`);
        
        const result = await dataSyncService.syncBankAccountData(account, {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          showBrowser: false
        });

        logger.info(`Completed scheduled scraping for account ${account._id}:`, result);
      } catch (error) {
        logger.error(`Failed to scrape account ${account._id}:`, error);
      } finally {
        this.rateLimiter.release(account.bankId);
      }
    });

    this.jobs.set(account._id.toString(), job);
    logger.info(`Scheduled scraping job for account ${account._id}`);
  }

  /**
   * Stop scheduling for a specific account
   */
  stopAccount(accountId) {
    const job = this.jobs.get(accountId.toString());
    if (job) {
      job.stop();
      this.jobs.delete(accountId.toString());
      logger.info(`Stopped scraping job for account ${accountId}`);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    this.jobs.forEach((job, accountId) => {
      job.stop();
      logger.info(`Stopped scraping job for account ${accountId}`);
    });
    this.jobs.clear();
  }
}

module.exports = new ScrapingSchedulerService();
