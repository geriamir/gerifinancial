const { BankAccount } = require('../models');
const scrapingSchedulerService = require('./scrapingSchedulerService');
const bankScraperService = require('./bankScraperService');
const logger = require('../utils/logger');

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

    // Schedule scraping for active account
    await scrapingSchedulerService.scheduleAccount(bankAccount);
    logger.info(`Scheduled scraping for new bank account: ${bankAccount._id}`);

    return bankAccount;
  }

  async delete(accountId, userId) {
    const bankAccount = await BankAccount.findOne({ _id: accountId, userId });
    if (!bankAccount) return null;

    if (bankAccount.status === 'active') {
      await scrapingSchedulerService.stopAccount(accountId);
      logger.info(`Stopped scraping for deleted bank account: ${accountId}`);
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

      // Handle scheduling
      if (!wasActive && status === 'active') {
        await scrapingSchedulerService.scheduleAccount(bankAccount);
        logger.info(`Scheduled scraping for activated bank account: ${accountId}`);
      } else if (wasActive && status !== 'active') {
        await scrapingSchedulerService.stopAccount(accountId);
        logger.info(`Stopped scraping for deactivated bank account: ${accountId}`);
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
}

module.exports = new BankAccountService();
