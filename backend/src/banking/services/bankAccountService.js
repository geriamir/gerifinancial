const { BankAccount, Transaction } = require('../models');
const bankScraperService = require('./bankScraperService');
const queuedDataSyncService = require('./queuedDataSyncService');
const logger = require('../../shared/utils/logger');
const bankAccountEvents = require('./bankAccountEvents');
const ForeignCurrencyAccount = require('../../foreign-currency/models/ForeignCurrencyAccount');

class BankAccountService {
  async create(userId, { bankId, name, username, password, apiToken, flexToken, queryId }) {
    let credentials;

    if (bankId === 'mercury') {
      // Mercury uses API token auth — no scraper validation needed
      credentials = { apiToken };
    } else if (bankId === 'ibkr') {
      // IBKR uses Flex Web Service token + query ID
      credentials = { flexToken, queryId };
    } else {
      // Israeli banks use username/password with browser scraping
      await bankScraperService.validateCredentials(bankId, { username, password });
      credentials = { username, password };
    }

    const bankAccount = new BankAccount({
      userId,
      bankId,
      name,
      credentials,
      defaultCurrency: bankId === 'mercury' ? 'USD' : bankId === 'ibkr' ? 'USD' : 'ILS',
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

  async updateCredentials(accountId, userId, { username, password, apiToken }) {
    const bankAccount = await BankAccount.findOne({ _id: accountId, userId });
    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    if (bankAccount.bankId === 'mercury') {
      // Mercury uses API token — no scraper validation
      bankAccount.credentials = { apiToken };
    } else {
      // Israeli banks: validate new credentials before saving
      await bankScraperService.validateCredentials(bankAccount.bankId, { username, password });
      bankAccount.credentials = { username, password };
    }

    // Clear any previous errors
    bankAccount.lastError = null;

    // If account was in error status, reactivate it
    if (bankAccount.status === 'error') {
      bankAccount.status = 'active';
    }

    await bankAccount.save();

    logger.info(`Credentials updated successfully for bank account ${accountId}`);

    // Automatically queue scraping to verify credentials and get latest data
    try {
      await queuedDataSyncService.queueBankAccountSync(accountId, { priority: 'high' });
      logger.info(`Queued scraping job for account ${bankAccount.name} after credential update`);
    } catch (error) {
      logger.error(`Failed to queue scraping after credential update for account ${bankAccount.name}:`, error);
      // Don't throw error - credential update was successful
    }

    return bankAccount;
  }

  async update(accountId, userId, updates) {
    const bankAccount = await BankAccount.findOne({ _id: accountId, userId });
    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    const allowedUpdates = ['name', 'scrapingConfig'];
    const updateKeys = Object.keys(updates);
    
    // Validate updates
    const invalidUpdates = updateKeys.filter(key => !allowedUpdates.includes(key));
    if (invalidUpdates.length > 0) {
      throw new Error(`Invalid update fields: ${invalidUpdates.join(', ')}`);
    }

    // Apply updates
    updateKeys.forEach(key => {
      bankAccount[key] = updates[key];
    });

    await bankAccount.save();

    logger.info(`Bank account ${accountId} updated successfully`);

    return bankAccount;
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
   * Recover missing transactions by recalculating lastScraped from actual data
   * and queuing a new scrape from the correct date
   */
  async recoverMissingTransactions(accountId, userId) {
    const bankAccount = await BankAccount.findOne({ _id: accountId, userId });
    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    // Find the actual latest regular transaction date for this account (exclude future-dated installments)
    const latestTransaction = await Transaction.findOne({
      accountId,
      date: { $lte: new Date() }
    })
      .sort({ date: -1 })
      .select('date')
      .lean();

    // Find the latest foreign currency transaction date separately
    const foreignAccounts = await ForeignCurrencyAccount.find({ bankAccountId: accountId }).select('_id').lean();
    let latestForeignDate = null;
    if (foreignAccounts.length > 0) {
      const foreignAccountIds = foreignAccounts.map(fa => fa._id);
      const latestForeignTx = await Transaction.findOne({
        accountId: { $in: foreignAccountIds },
        date: { $lte: new Date() }
      })
        .sort({ date: -1 })
        .select('date')
        .lean();
      if (latestForeignTx) {
        latestForeignDate = new Date(latestForeignTx.date);
      }
    }

    const oldLastScraped = bankAccount.lastScraped;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const regularDate = latestTransaction ? new Date(latestTransaction.date) : null;

    // Update lastScraped on the account (use regular transaction date or fallback)
    bankAccount.lastScraped = regularDate || sixMonthsAgo;

    // Set strategy-level lastScraped dates independently
    if (bankAccount.strategySync) {
      for (const strategy of Object.keys(bankAccount.strategySync.toObject ? bankAccount.strategySync.toObject() : bankAccount.strategySync)) {
        if (bankAccount.strategySync[strategy]?.lastScraped) {
          if (strategy === 'foreign-currency') {
            bankAccount.strategySync[strategy].lastScraped = latestForeignDate || sixMonthsAgo;
          } else {
            bankAccount.strategySync[strategy].lastScraped = regularDate || sixMonthsAgo;
          }
        }
      }
      bankAccount.markModified('strategySync');
    }

    await bankAccount.save();

    logger.info(`Recovered lastScraped for account ${accountId}: ${oldLastScraped?.toISOString() || 'null'} → regular: ${(regularDate || sixMonthsAgo).toISOString()}, foreign: ${(latestForeignDate || sixMonthsAgo).toISOString()}`);

    // Queue a new scrape from the corrected date
    const scrapeResult = await queuedDataSyncService.queueBankAccountSync(accountId, { priority: 'high' });

    return {
      message: 'Recovery scrape started',
      accountId,
      accountName: bankAccount.name,
      previousLastScraped: oldLastScraped,
      correctedLastScraped: regularDate || sixMonthsAgo,
      correctedForeignLastScraped: latestForeignDate || sixMonthsAgo,
      latestTransactionDate: latestTransaction?.date || null,
      latestForeignTransactionDate: latestForeignDate,
      queuedJobs: scrapeResult.queuedJobs,
      totalJobs: scrapeResult.totalJobs
    };
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
