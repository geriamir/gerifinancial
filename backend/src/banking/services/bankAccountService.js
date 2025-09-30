const { BankAccount } = require('../models');
const bankScraperService = require('./bankScraperService');
const queuedDataSyncService = require('./queuedDataSyncService');
const logger = require('../../shared/utils/logger');
const bankAccountEvents = require('./bankAccountEvents');

class BankAccountService {
  async create(userId, { bankId, name, username, password }) {
    // Validate bank credentials first
    await bankScraperService.validateCredentials(bankId, { username, password });
    const bankAccount = new BankAccount({
      userId,
      bankId,
      name,
      credentials: {
        username,
        password // Will be encrypted by pre-save hook
      },
      status: 'active'
    });

    await bankAccount.save();

    // Emit event for scheduling and initial scraping for active account
    bankAccountEvents.emit('accountCreated', bankAccount);
    logger.info(`Emitted accountCreated event for new bank account: ${bankAccount._id}`);

    return bankAccount;
  }

  async delete(accountId, userId) {
    const bankAccount = await BankAccount.findOne({ _id: accountId, userId });
    if (!bankAccount) return null;

    if (bankAccount.status === 'active') {
      bankAccountEvents.emit('accountDeleted', { accountId, bankAccount });
      logger.info(`Emitted accountDeleted event for bank account: ${accountId}`);
    }

    await BankAccount.deleteOne({ _id: accountId });
    return true;
  }

  async updateStatus(accountId, userId, status) {
    const bankAccount = await BankAccount.findOne({ _id: accountId, userId });
    if (!bankAccount) return null;
    const wasActive = bankAccount.status === 'active';
    bankAccount.status = status;

    try {
      if (status === 'active') {
        // For active status, test the connection first
        await bankScraperService.testConnection(bankAccount);
        bankAccount.lastScraped = new Date();
        bankAccount.lastError = null;  // Clear any previous errors when activating
      }

      await bankAccount.save();

      // Handle scheduling via events
      if (!wasActive && status === 'active') {
        bankAccountEvents.emit('accountActivated', bankAccount);
        logger.info(`Emitted accountActivated event for bank account: ${accountId}`);
      } else if (wasActive && status !== 'active') {
        bankAccountEvents.emit('accountDeactivated', { accountId, bankAccount });
        logger.info(`Emitted accountDeactivated event for bank account: ${accountId}`);
      }

      return bankAccount;
    } catch (error) {
      // If connection test fails, set error status
      bankAccount.status = 'error';
      bankAccount.lastError = {
        message: error.message,
        date: new Date()
      };
      await bankAccount.save();
      throw error;
    }
  }

  async getScrapingStatus(userId) {
    try {
      const bankAccounts = await BankAccount.find({ userId });
      
      // Find the most recent bank account or one that's currently scraping
      const activeBankAccount = bankAccounts.find(account => 
        account.scrapingStatus && account.scrapingStatus.isActive
      ) || bankAccounts[0];
      
      if (activeBankAccount && activeBankAccount.scrapingStatus) {
        const scrapingStatus = activeBankAccount.scrapingStatus;
        
        return {
          status: scrapingStatus.status || 'idle',
          isActive: scrapingStatus.isActive || false,
          progress: scrapingStatus.progress || 0,
          message: scrapingStatus.message || 'No import in progress',
          sessionId: null, // No session-based tracking with new system
          hasImportedTransactions: scrapingStatus.transactionsImported > 0,
          transactionsImported: scrapingStatus.transactionsImported || 0,
          transactionsCategorized: scrapingStatus.transactionsCategorized || 0
        };
      } else if (bankAccounts.length > 0) {
        // User has bank accounts but no scraping status yet
        return {
          status: 'idle',
          isActive: false,
          progress: 0,
          message: 'Ready to import transactions',
          sessionId: null,
          hasImportedTransactions: false,
          transactionsImported: 0,
          transactionsCategorized: 0
        };
      } else {
        // No bank accounts
        return {
          status: 'not_started',
          isActive: false,
          progress: 0,
          message: 'Please connect your bank account to start importing transactions',
          sessionId: null,
          hasImportedTransactions: false,
          transactionsImported: 0,
          transactionsCategorized: 0
        };
      }
    } catch (error) {
      logger.error(`Error getting scraping status for user ${userId}:`, error);
      throw error;
    }
  }

  // ===== QUEUE-BASED SCRAPING METHODS =====

  /**
   * Queue scraping jobs for a single bank account
   */
  async queueAccountScraping(accountId, userId, options = {}) {
    // Verify ownership
    const bankAccount = await BankAccount.findOne({ _id: accountId, userId });
    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    try {
      const result = await queuedDataSyncService.queueBankAccountSync(accountId, options);
      
      logger.info(`Queued scraping for account ${bankAccount.name} (${accountId})`);
      
      return {
        message: 'Scraping jobs queued successfully',
        accountId,
        accountName: bankAccount.name,
        queuedJobs: result.queuedJobs,
        totalJobs: result.totalJobs,
        priority: result.priority
      };
    } catch (error) {
      logger.error(`Failed to queue scraping for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Queue scraping jobs for all user's accounts
   */
  async queueAllAccountsScraping(userId, options = {}) {
    try {
      const result = await queuedDataSyncService.queueMultipleAccountsSync(
        { userId },
        { 
          delayBetweenAccounts: 1000, // 1 second delay between accounts
          ...options 
        }
      );

      logger.info(`Queued scraping for ${result.successfulAccounts}/${result.totalAccounts} accounts for user ${userId}`);

      return {
        message: 'Scraping jobs queued successfully',
        totalAccounts: result.totalAccounts,
        successfullyQueued: result.successfulAccounts,
        failedToQueue: result.failedAccounts,
        totalJobs: result.totalJobs,
        accounts: result.queuedAccounts.map(account => ({
          accountId: account.bankAccountId,
          accountName: account.accountName,
          queuedJobs: account.queuedJobs?.length || 0,
          error: account.error
        }))
      };
    } catch (error) {
      logger.error(`Failed to queue scraping for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Queue a specific strategy for a specific account
   */
  async queueStrategyForAccount(accountId, userId, strategyName, options = {}) {
    // Verify ownership
    const bankAccount = await BankAccount.findOne({ _id: accountId, userId });
    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    try {
      const result = await queuedDataSyncService.queueStrategySync(accountId, strategyName, options);
      
      logger.info(`Queued ${strategyName} strategy for account ${bankAccount.name} (${accountId})`);
      
      return {
        message: `${strategyName} scraping job queued successfully`,
        jobId: result.jobId,
        accountId,
        accountName: bankAccount.name,
        strategyName,
        priority: result.priority
      };
    } catch (error) {
      logger.error(`Failed to queue ${strategyName} strategy for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      return await queuedDataSyncService.getQueueStats();
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  /**
   * Get queue health status
   */
  async getQueueHealth() {
    try {
      return await queuedDataSyncService.getHealthStatus();
    } catch (error) {
      logger.error('Failed to get queue health:', error);
      throw error;
    }
  }
}

const bankAccountServiceInstance = new BankAccountService();

module.exports = bankAccountServiceInstance;
module.exports.events = bankAccountEvents;
