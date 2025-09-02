const { BankAccount, Investment } = require('../../shared/models');
const dataSyncService = require('../../shared/services/dataSyncService');
const logger = require('../../shared/utils/logger');

class StartupDataSyncService {
  constructor() {
    this.isRunning = false;
    this.scrapingQueue = [];
  }

  async checkAndScrapeAccounts() {
    if (this.isRunning) {
      logger.info('Data sync already in progress, skipping startup check');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Starting account data sync check on server startup...');

      // Get all active bank accounts
      const bankAccounts = await BankAccount.find({ 
        status: 'active' 
      }).populate('userId', 'username');

      if (bankAccounts.length === 0) {
        logger.info('No active bank accounts found for investment scraping');
        return;
      }

      logger.info(`Found ${bankAccounts.length} active bank accounts to check`);

      // Check which accounts need scraping
      const accountsToScrape = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const account of bankAccounts) {
        const needsScraping = await this.accountNeedsInvestmentScraping(account, today);
        if (needsScraping) {
          accountsToScrape.push(account);
        }
      }

      if (accountsToScrape.length === 0) {
        logger.info('All accounts have been scraped today, no investment scraping needed');
        return;
      }


      logger.info(`${accountsToScrape.length} accounts need investment scraping, starting background process...`);

      // Start background scraping (non-blocking)
      this.startBackgroundScraping(accountsToScrape);

    } catch (error) {
      logger.error(`Error during startup investment check: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async accountNeedsInvestmentScraping(bankAccount, today) {
    try {
      // Check if account was scraped today at all
      const wasScrapedToday = bankAccount.lastScraped && 
        new Date(bankAccount.lastScraped).toDateString() === today.toDateString();

      if (!wasScrapedToday) {
        logger.debug(`Bank account ${bankAccount._id} was not scraped today`);
        return true;
      }

      // Check if we have any investments for this account but they're old
      const oldInvestments = await Investment.find({
        bankAccountId: bankAccount._id,
        lastUpdated: { $lt: today }
      });

      if (oldInvestments.length > 0) {
        logger.debug(`Bank account ${bankAccount._id} has ${oldInvestments.length} investments that need updating`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Error checking if account ${bankAccount._id} needs scraping: ${error.message}`);
      return false;
    }
  }

  async startBackgroundScraping(accountsToScrape) {
    // Add accounts to queue if not already there
    for (const account of accountsToScrape) {
      if (!this.scrapingQueue.find(item => item._id.toString() === account._id.toString())) {
        this.scrapingQueue.push(account);
      }
    }

    // Process queue in background (don't await to avoid blocking startup)
    setImmediate(() => this.processScrapingQueue());
  }

  async processScrapingQueue() {
    while (this.scrapingQueue.length > 0) {
      const account = this.scrapingQueue.shift();
      
      try {
        logger.info(`Starting background investment scraping for account ${account._id} (${account.name})`);
        
        await this.scrapeAccountInvestments(account);
        
        // Add delay between accounts to avoid overwhelming bank servers
        if (this.scrapingQueue.length > 0) {
          logger.info(`Waiting 30 seconds before scraping next account...`);
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
        
      } catch (error) {
        logger.error(`Background scraping failed for account ${account._id}: ${error.message}`);
        // Note: dataSyncService already handles error status updates
      }
    }
    
    logger.info('Background investment scraping queue completed');
  }

  async scrapeAccountInvestments(bankAccount) {
    try {
      logger.info(`Scraping all data (transactions + investments) for bank account ${bankAccount._id} (${bankAccount.name})`);
      
      // Use dataSyncService to scrape both transactions and investments in one go
      const result = await dataSyncService.syncBankAccountData(bankAccount);
      
      logger.info(`Successfully scraped account ${bankAccount._id}: ${result.transactions.newTransactions} new transactions, ${result.investments.newInvestments} new investments, ${result.investments.updatedInvestments} updated investments`);
      
      if (result.hasErrors) {
        logger.warn(`Scraping completed with errors for account ${bankAccount._id}`);
      }
      
      return result;
      
    } catch (error) {
      logger.error(`Failed to scrape account ${bankAccount._id} (${bankAccount.name}): ${error.message}`);
      throw error;
    }
  }

  // Method to manually trigger scraping for all accounts (useful for testing)
  async forceScrapeAllAccounts() {
    try {
      logger.info('Manually triggering investment scraping for all active accounts...');
      
      const bankAccounts = await BankAccount.find({ 
        status: 'active' 
      }).populate('userId', 'username');
      
      if (bankAccounts.length === 0) {
        logger.info('No active bank accounts found');
        return { message: 'No active accounts to scrape' };
      }
      
      this.startBackgroundScraping(bankAccounts);
      
      return { 
        message: `Started background scraping for ${bankAccounts.length} accounts`,
        accountCount: bankAccounts.length 
      };
      
    } catch (error) {
      logger.error(`Error forcing scrape all accounts: ${error.message}`);
      throw error;
    }
  }

  // Get current scraping status
  getScrapingStatus() {
    return {
      isRunning: this.isRunning,
      queueLength: this.scrapingQueue.length,
      queuedAccounts: this.scrapingQueue.map(account => ({
        id: account._id,
        name: account.name,
        bankId: account.bankId
      }))
    };
  }
}

module.exports = new StartupDataSyncService();
