const { BankAccount } = require('../models');
const bankScraperService = require('./bankScraperService');
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

    // Emit event for scheduling scraping for active account
    bankAccountEvents.emit('accountCreated', bankAccount);
    logger.info(`Emitted accountCreated event for new bank account: ${bankAccount._id}`);

    // Initiate immediate scraping for new account
    try {
      // Fire and forget - don't wait for scraping to complete
      setImmediate(async () => {
        try {
          // Lazy load dataSyncService to avoid circular dependency
          const dataSyncService = require('./dataSyncService');
          await dataSyncService.syncBankAccountData(bankAccount);
          logger.info(`Initial scraping completed for new bank account: ${bankAccount._id}`);
        } catch (error) {
          logger.warn(`Initial scraping failed for new bank account ${bankAccount._id}: ${error.message}`);
        }
      });
      logger.info(`Initiated immediate scraping for new bank account: ${bankAccount._id}`);
    } catch (error) {
      logger.warn(`Failed to initiate immediate scraping for bank account ${bankAccount._id}: ${error.message}`);
      // Don't throw error - bank account creation should still succeed
    }

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
}

const bankAccountServiceInstance = new BankAccountService();

module.exports = bankAccountServiceInstance;
module.exports.events = bankAccountEvents;
