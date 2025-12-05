const logger = require('../../../shared/utils/logger');
const BaseSyncStrategy = require('./BaseSyncStrategy');
const transactionService = require('../transactionService');

class CheckingAccountsSyncStrategy extends BaseSyncStrategy {
  constructor() {
    super({
      name: 'checking',
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
