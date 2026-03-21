const cron = require('node-cron');
const { BankAccount } = require('../models');
const dataSyncService = require('./dataSyncService');
const queuedDataSyncService = require('./queuedDataSyncService');
const logger = require('../../shared/utils/logger');
const rateLimiter = require('../../shared/utils/rateLimiter');
const bankAccountEvents = require('./bankAccountEvents');

class ScrapingSchedulerService {
  constructor() {
    this.jobs = new Map();
    this.rateLimiter = rateLimiter.createLimiter({
      maxRequests: 1,  // One request at a time
      perSeconds: 60   // per minute per bank
    });
    
    // Setup event listeners after other services are initialized
    setImmediate(() => {
      this.setupEventListeners();
    });
  }

  /**
   * Setup event listeners for bank account events
   */
  setupEventListeners() {
    try {
      bankAccountEvents.on('accountCreated', (bankAccount) => {
        logger.info(`Handling accountCreated event for bank account: ${bankAccount._id}`);
        
        // Schedule regular scraping for the account
        this.scheduleAccount(bankAccount);
        
        // Initiate immediate first sync for new account
        this.initiateFirstSync(bankAccount);
      });

      bankAccountEvents.on('accountActivated', (bankAccount) => {
        logger.info(`Handling accountActivated event for bank account: ${bankAccount._id}`);
        this.scheduleAccount(bankAccount);
      });

      bankAccountEvents.on('accountDeleted', ({ accountId }) => {
        logger.info(`Handling accountDeleted event for bank account: ${accountId}`);
        this.stopAccount(accountId);
      });

      bankAccountEvents.on('accountDeactivated', ({ accountId }) => {
        logger.info(`Handling accountDeactivated event for bank account: ${accountId}`);
        this.stopAccount(accountId);
      });

      logger.info('ScrapingSchedulerService event listeners initialized');
    } catch (error) {
      logger.error('Failed to setup ScrapingSchedulerService event listeners:', error);
    }
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

      // Perform initial startup check after a delay to let system stabilize
      setTimeout(() => {
        this.performStartupCheck(accounts);
      }, 10000); // 10 second delay

    } catch (error) {
      logger.error('Failed to initialize scraping scheduler:', error);
      throw error;
    }
  }

  /**
   * Schedule scraping for a specific bank account
   */
  scheduleAccount(account) {
    // OTP-based banks (e.g., Phoenix) require manual login — skip scheduling
    if (account.isOtpBank()) {
      logger.info(`Skipping scheduled scraping for OTP-based account ${account._id} (${account.bankId})`);
      return;
    }

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

  /**
   * Initiate first sync for a newly created account using queue system
   */
  async initiateFirstSync(bankAccount) {
    // OTP-based banks require manual login — skip automatic first sync
    if (bankAccount.isOtpBank()) {
      logger.info(`Skipping automatic first sync for OTP-based account: ${bankAccount.name}`);
      return;
    }

    try {
      logger.info(`Initiating first sync for new bank account: ${bankAccount.name} (${bankAccount._id})`);

      await this.rateLimiter.acquire(bankAccount.bankId);

      const result = await queuedDataSyncService.queueBankAccountSync(
        bankAccount._id,
        { 
          priority: 'high', // High priority for new accounts
          newAccount: true,
          reason: 'first_sync'
        }
      );

      logger.info(`Queued first sync for new account ${bankAccount.name}: ${result.totalJobs} jobs with high priority`);

    } catch (error) {
      logger.error(`Failed to queue first sync for new account ${bankAccount._id}:`, error);
    } finally {
      this.rateLimiter.release(bankAccount.bankId);
    }
  }

  /**
   * Perform startup check to queue scraping for accounts that need it
   */
  async performStartupCheck(accounts) {
    try {
      logger.info('Starting startup scraping check for active accounts...');
      
      const accountsNeedingScraping = [];

      // Check which accounts need scraping
      for (const account of accounts) {
        const needsScraping = await this.accountNeedsStartupScraping(account);
        if (needsScraping) {
          accountsNeedingScraping.push(account);
        }
      }

      if (accountsNeedingScraping.length === 0) {
        logger.info('All accounts are up to date, no startup scraping needed');
        return;
      }

      logger.info(`${accountsNeedingScraping.length} accounts need startup scraping, queueing jobs...`);

      // Queue sync jobs for accounts that need scraping
      for (const account of accountsNeedingScraping) {
        try {
          await this.rateLimiter.acquire(account.bankId);
          
          const result = await queuedDataSyncService.queueBankAccountSync(
            account._id,
            { 
              priority: 'normal',
              startupSync: true,
              reason: 'startup_check'
            }
          );
          
          logger.info(`Queued startup sync for account ${account.name}: ${result.totalJobs} jobs`);
          
          // Small delay between accounts
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          logger.error(`Failed to queue startup sync for account ${account._id}:`, error);
        } finally {
          this.rateLimiter.release(account.bankId);
        }
      }

      logger.info(`Startup scraping check completed: ${accountsNeedingScraping.length} accounts queued`);

    } catch (error) {
      logger.error('Error during startup scraping check:', error);
    }
  }

  /**
   * Check if an account needs scraping on startup (per-strategy check)
   */
  async accountNeedsStartupScraping(account) {
    try {
      const strategies = account.bankId === 'mercury'
        ? ['mercury-checking']
        : account.bankId === 'ibkr'
        ? ['ibkr-flex']
        : account.bankId === 'phoenix'
        ? [] // Phoenix requires OTP — no automatic sync
        : ['checking-accounts', 'investment-portfolios', 'foreign-currency'];
      const strategiesNeedingSync = [];

      // Check each strategy individually
      for (const strategyName of strategies) {
        const needsSync = account.strategyNeedsSync(strategyName, 24); // 24 hour threshold
        if (needsSync) {
          strategiesNeedingSync.push(strategyName);
        }
      }

      if (strategiesNeedingSync.length > 0) {
        logger.debug(`Account ${account.name} needs startup scraping for strategies: ${strategiesNeedingSync.join(', ')}`);
        return true;
      }

      // All strategies are up to date
      logger.debug(`Account ${account.name} is up to date for all strategies, no startup scraping needed`);
      return false;

    } catch (error) {
      logger.error(`Error checking if account ${account._id} needs scraping:`, error);
      // Default to needing scraping on error
      return true;
    }
  }
}

module.exports = new ScrapingSchedulerService();
