const logger = require('../../../shared/utils/logger');
const IsraeliScraperSyncStrategy = require('./IsraeliScraperSyncStrategy');
const transactionService = require('../transactionService');
const balanceService = require('../balanceService');

class CheckingAccountsSyncStrategy extends IsraeliScraperSyncStrategy {
  constructor() {
    super({
      name: 'checking-accounts',
      displayName: 'Checking Accounts',
      icon: '🏦',
      scrapingMethod: 'scrape',
      statusUpdates: {
        start: { progress: 20, message: 'Downloading checking account transactions...' },
        error: (error) => ({ progress: 0, message: `Checking accounts sync failed: ${error}` })
      }
    });
  }

  /**
   * Check if the bank supports checking accounts (regular transactions)
   */
  isSupported(scraper) {
    return scraper.doesSupportTransactions();
  }

  /**
   * Get empty result structure for checking accounts
   */
  getEmptyResult() {
    return { transactions: { newTransactions: 0, errors: [] } };
  }

  /**
   * Process scraped checking account data
   */
  async processScrapedData(scrapingResult, bankAccount, context) {
    const transactionResults = await transactionService.processScrapedTransactions(
      scrapingResult.accounts || [], 
      bankAccount
    );

    // Record aggregated balance from all scraped sub-accounts
    const accounts = scrapingResult.accounts || [];
    const balances = accounts.filter(a => a.balance != null).map(a => a.balance);
    if (balances.length > 0) {
      try {
        await balanceService.recordBalance(bankAccount._id, {
          balance: balances.reduce((sum, b) => sum + b, 0),
          currency: bankAccount.defaultCurrency || 'ILS',
          source: 'scraper'
        });
      } catch (err) {
        logger.warn(`Failed to record balance for account ${bankAccount._id}: ${err.message}`);
      }
    }
    
    return {
      transactions: transactionResults,
      metadata: {
        scrapingTimestamp: new Date().toISOString(),
        accountType: 'checking',
        totalAccounts: scrapingResult.accounts?.length || 0,
        totalTransactions: (scrapingResult.accounts || []).reduce((total, account) => 
          total + (account.txns ? account.txns.length : 0), 0)
      }
    };
  }
}

module.exports = CheckingAccountsSyncStrategy;
