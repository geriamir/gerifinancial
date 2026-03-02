const EventEmitter = require('events');
const logger = require('../../shared/utils/logger');

/**
 * Shared event emitter for scraping/sync related events
 * This avoids circular dependencies between services and enables async post-processing
 */
class ScrapingEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Allow multiple listeners
  }

  /**
   * Emit when a strategy sync starts
   * @param {Object} data - Object containing strategyName, bankAccountId, userId
   */
  emitStrategySyncStarted(data) {
    const { strategyName, bankAccountId, userId } = data;
    logger.info(`Emitting strategySyncStarted event for ${strategyName} - account ${bankAccountId}, user ${userId}`);
    this.emit('strategySyncStarted', data);
    
    // Also emit strategy-specific events for targeted listeners
    this.emit(`${strategyName}:started`, data);
  }

  /**
   * Emit when a strategy sync completes successfully
   * @param {Object} data - Object containing strategyName, bankAccountId, userId, result
   */
  emitStrategySyncCompleted(data) {
    const { strategyName, bankAccountId, userId } = data;
    logger.info(`Emitting strategySyncCompleted event for ${strategyName} - account ${bankAccountId}, user ${userId}`);
    this.emit('strategySyncCompleted', data);
    
    // Also emit strategy-specific events for targeted listeners
    this.emit(`${strategyName}:completed`, data);
  }

  /**
   * Emit when a strategy sync fails
   * @param {Object} data - Object containing strategyName, bankAccountId, userId, error
   */
  emitStrategySyncFailed(data) {
    const { strategyName, bankAccountId, userId, error } = data;
    logger.info(`Emitting strategySyncFailed event for ${strategyName} - account ${bankAccountId}, user ${userId}`);
    this.emit('strategySyncFailed', data);
    
    // Also emit strategy-specific events for targeted listeners
    this.emit(`${strategyName}:failed`, data);
  }

  /**
   * Emit when all strategies for an account complete
   * @param {Object} data - Object containing bankAccountId, userId, results
   */
  emitAccountSyncCompleted(data) {
    const { bankAccountId, userId } = data;
    logger.info(`Emitting accountSyncCompleted event for account ${bankAccountId}, user ${userId}`);
    this.emit('accountSyncCompleted', data);
  }
}

// Export a singleton instance
module.exports = new ScrapingEvents();
