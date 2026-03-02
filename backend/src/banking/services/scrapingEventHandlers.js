const scrapingEvents = require('./scrapingEvents');
const creditCardDetectionService = require('./creditCardDetectionService');
const { User } = require('../../auth');
const logger = require('../../shared/utils/logger');

/**
 * Event handlers for scraping events
 * Handles async post-processing after strategy completions
 */
class ScrapingEventHandlers {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize and register all event handlers
   */
  initialize() {
    if (this.initialized) {
      logger.info('Scraping event handlers already initialized');
      return;
    }

    // Listen for checking-accounts strategy completion
    scrapingEvents.on('checking-accounts:completed', this.handleCheckingAccountsCompleted.bind(this));

    // Listen for general strategy completion (for logging/monitoring)
    scrapingEvents.on('strategySyncCompleted', this.handleStrategySyncCompleted.bind(this));

    this.initialized = true;
    logger.info('✅ Scraping event handlers initialized and listening');
  }

  /**
   * Handle checking-accounts strategy completion
   * Triggers credit card detection for the user
   */
  async handleCheckingAccountsCompleted(data) {
    const { bankAccountId, userId } = data;
    
    logger.info(`📬 Received checking-accounts completion event for user ${userId}, account ${bankAccountId}`);
    
    try {
      // Run credit card detection asynchronously (don't block the job completion)
      logger.info(`🔍 Starting credit card detection for user ${userId} after checking-accounts sync`);
      
      await creditCardDetectionService.detectAndUpdateCreditCards(userId);
      
      // Mark credit card detection step as complete in onboarding
      await User.findByIdAndUpdate(userId, {
        $addToSet: {
          'onboardingStatus.completedSteps': 'credit-card-detection'
        }
      });
      
      logger.info(`✅ Credit card detection completed for user ${userId} after checking-accounts sync`);
      logger.info(`✅ Updated user ${userId} onboarding status - credit card detection complete`);
    } catch (error) {
      // Log error but don't throw - this is async post-processing
      logger.error(`❌ Credit card detection failed for user ${userId} after checking-accounts sync:`, error.message);
      logger.error(`Error stack:`, error.stack);
    }
  }

  /**
   * Handle general strategy completion (for monitoring/logging)
   */
  async handleStrategySyncCompleted(data) {
    const { strategyName, bankAccountId, userId } = data;
    
    logger.debug(`📊 Strategy sync completed: ${strategyName} for account ${bankAccountId}, user ${userId}`);
    
    // Can add additional monitoring, metrics, notifications here
  }
}

// Export singleton instance
const scrapingEventHandlers = new ScrapingEventHandlers();

module.exports = scrapingEventHandlers;
