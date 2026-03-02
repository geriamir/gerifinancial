const { BaseSyncStrategy, bankScraperService, dataSyncService } = require('../../../banking');
const logger = require('../../../shared/utils/logger');

/**
 * Sync strategy for foreign currency accounts
 */
class ForeignCurrencySyncStrategy extends BaseSyncStrategy {
  constructor() {
    super({
      name: 'foreignCurrency',
      displayName: 'Foreign Currency Accounts',
      icon: '💱',
      scrapingMethod: 'scrapeForeignCurrencyAccounts',
      statusUpdates: {
        start: { progress: 60, message: 'Downloading foreign currency accounts...' },
        error: (error) => ({ progress: 0, message: `Foreign currency sync failed: ${error}` })
      }
    });
  }

  /**
   * Check if the scraper supports foreign currency accounts
   */
  isSupported(scraper) {
    return scraper.doesSupportForeignCurrencyAccounts();
  }

  /**
   * Get empty result structure for foreign currency accounts
   */
  getEmptyResult() {
    return {
      foreignCurrency: { newAccounts: 0, updatedAccounts: 0, newTransactions: 0, errors: [] }
    };
  }

  /**
   * Process scraped foreign currency account data
   */
  async processScrapedData(scrapingResult, bankAccount, context) {
    const foreignCurrencyAccounts = scrapingResult.foreignCurrencyAccounts || [];
    
    // Process foreign currency accounts
    let foreignCurrencyResults = { newAccounts: 0, updatedAccounts: 0, newTransactions: 0, errors: [] };
    
    if (foreignCurrencyAccounts.length > 0) {
      logger.info(`Processing ${foreignCurrencyAccounts.length} foreign currency accounts`);
      
      const processedAccounts = bankScraperService.processForeignCurrencyAccounts(foreignCurrencyAccounts);
      foreignCurrencyResults = await dataSyncService.processForeignCurrencyAccounts(processedAccounts, bankAccount);
    }
    
    return {
      foreignCurrency: foreignCurrencyResults
    };
  }
}

module.exports = ForeignCurrencySyncStrategy;
