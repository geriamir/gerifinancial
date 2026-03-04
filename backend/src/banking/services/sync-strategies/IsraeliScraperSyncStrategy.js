const logger = require('../../../shared/utils/logger');
const BaseSyncStrategy = require('./BaseSyncStrategy');

/**
 * Sync strategy for banks that use the israeli-bank-scrapers library.
 * Handles scraper creation, login, and the scrape→process pipeline.
 */
class IsraeliScraperSyncStrategy extends BaseSyncStrategy {
  constructor(config) {
    super(config);
    this.scrapingMethod = config.scrapingMethod;
  }

  /**
   * Check if the scraper supports this sync type
   * @param {Object} scraper - The bank scraper instance
   * @returns {boolean} - Whether this sync type is supported
   */
  isSupported(scraper) {
    throw new Error('isSupported method must be implemented by concrete strategy');
  }

  /**
   * Process the scraped data for this sync type
   * @param {Object} scrapingResult - Raw scraping result
   * @param {Object} bankAccount - Bank account instance
   * @param {Object} context - Data sync service context
   * @returns {Object} - Processed results
   */
  async processScrapedData(scrapingResult, bankAccount, context) {
    throw new Error('processScrapedData method must be implemented by concrete strategy');
  }

  /**
   * Execute the isolated sync using israeli-bank-scrapers
   */
  async executeSync(bankAccount, options, context) {
    try {
      logger.info(`${this.icon} Starting isolated ${this.displayName.toLowerCase()} sync for ${bankAccount._id}`);
      
      const bankScraperService = require('../bankScraperService');
      const scraper = bankScraperService.createScraper(bankAccount, options);
      const credentials = bankAccount.getScraperOptions().credentials;
      
      if (!this.isSupported(scraper)) {
        logger.info(`ℹ️ Bank ${bankAccount.bankId} does not support ${this.displayName.toLowerCase()} - skipping`);
        return this.getEmptyResult();
      }
      
      if (this.statusUpdates.start) {
        await this.updateStatus(bankAccount._id, {
          status: 'scraping',
          ...this.statusUpdates.start
        });
      }
      
      const scrapingResult = await scraper[this.scrapingMethod](credentials);
      
      if (!scrapingResult.success) {
        throw new Error(`${this.displayName} scraping failed: ${scrapingResult.errorMessage || 'Unknown error'}`);
      }
      
      const processedResults = await this.processScrapedData(scrapingResult, bankAccount, context);
      
      logger.info(`✅ ${this.displayName} sync completed successfully for ${bankAccount._id}`);
      return processedResults;
      
    } catch (error) {
      logger.error(`❌ ${this.displayName} sync failed for ${bankAccount._id}: ${error.message}`);
      
      if (this.statusUpdates.error) {
        await this.updateStatus(bankAccount._id, {
          status: 'error',
          ...this.statusUpdates.error(error.message),
          isActive: false
        });
      }
      
      throw error;
    }
  }
}

module.exports = IsraeliScraperSyncStrategy;
