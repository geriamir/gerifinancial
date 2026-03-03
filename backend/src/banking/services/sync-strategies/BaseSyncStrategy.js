const logger = require('../../../shared/utils/logger');

/**
 * Abstract base class for all sync strategies.
 * Defines the common interface that every sync strategy must implement.
 */
class BaseSyncStrategy {
  constructor(config) {
    this.name = config.name;
    this.displayName = config.displayName;
    this.icon = config.icon;
    this.statusUpdates = config.statusUpdates || {};
  }

  /**
   * Get the empty result structure for this sync type
   * @returns {Object} - Empty result structure
   */
  getEmptyResult() {
    throw new Error('getEmptyResult method must be implemented by concrete strategy');
  }

  /**
   * Execute the sync for this strategy
   * @param {Object} bankAccount - Bank account to sync
   * @param {Object} options - Sync options
   * @param {Object} context - Data sync service context
   * @returns {Object} - Sync results
   */
  async executeSync(bankAccount, options, context) {
    throw new Error('executeSync method must be implemented by concrete strategy');
  }

  /**
   * Update scraping status on the bank account
   */
  async updateStatus(bankAccountId, statusData) {
    const bankScraperService = require('../bankScraperService');
    await bankScraperService.updateScrapingStatus(bankAccountId, {
      ...statusData,
      lastUpdatedAt: new Date()
    });
  }
}

module.exports = BaseSyncStrategy;
