const logger = require('../../../shared/utils/logger');

/**
 * Abstract base class for sync strategies
 * Defines the common interface and shared functionality for all sync strategies
 */
class BaseSyncStrategy {
  constructor(config) {
    this.name = config.name;
    this.displayName = config.displayName;
    this.icon = config.icon;
    this.scrapingMethod = config.scrapingMethod;
    this.statusUpdates = config.statusUpdates || {};
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
   * Get the empty result structure for this sync type
   * @returns {Object} - Empty result structure
   */
  getEmptyResult() {
    throw new Error('getEmptyResult method must be implemented by concrete strategy');
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
   * Execute the isolated sync for this strategy
   * @param {Object} bankAccount - Bank account to sync
   * @param {Object} options - Sync options
   * @param {Object} context - Data sync service context
   * @returns {Object} - Sync results
   */
  async executeSync(bankAccount, options, context) {
    try {
      logger.info(`${this.icon} Starting isolated ${this.displayName.toLowerCase()} sync for ${bankAccount._id}`);
      
      // Create scraper and get credentials
      const bankScraperService = require('../bankScraperService');
      const scraper = bankScraperService.createScraper(bankAccount, options);
      const credentials = bankAccount.getScraperOptions().credentials;
      
      // Check if bank supports this sync type
      if (!this.isSupported(scraper)) {
        logger.info(`ℹ️ Bank ${bankAccount.bankId} does not support ${this.displayName.toLowerCase()} - skipping`);
        return this.getEmptyResult();
      }
      
      // Update status to show scraping started
      if (this.statusUpdates.start) {
        await bankScraperService.updateScrapingStatus(bankAccount._id, {
          status: 'scraping',
          ...this.statusUpdates.start,
          lastUpdatedAt: new Date()
        });
      }
      
      // Execute the scraping method
      const scrapingResult = await scraper[this.scrapingMethod](credentials);
      
      if (!scrapingResult.success) {
        throw new Error(`${this.displayName} scraping failed: ${scrapingResult.errorMessage || 'Unknown error'}`);
      }
      
      // Process the scraped data using the strategy's processor
      const processedResults = await this.processScrapedData(scrapingResult, bankAccount, context);
      
      logger.info(`✅ ${this.displayName} sync completed successfully for ${bankAccount._id}`);
      return processedResults;
      
    } catch (error) {
      logger.error(`❌ ${this.displayName} sync failed for ${bankAccount._id}: ${error.message}`);
      
      // Update status to show error if configured
      if (this.statusUpdates.error) {
        const bankScraperService = require('../bankScraperService');
        await bankScraperService.updateScrapingStatus(bankAccount._id, {
          status: 'error',
          ...this.statusUpdates.error(error.message),
          lastUpdatedAt: new Date(),
          isActive: false
        });
      }
      
      throw error;
    }
  }
}

module.exports = BaseSyncStrategy;
