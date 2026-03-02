const sseService = require('./sseService');
const { scrapingEvents } = require('../../banking');
const logger = require('../utils/logger');

/**
 * Event Bridge - Forwards internal application events to SSE clients
 * Connects the internal event system to the SSE service for real-time client updates
 * 
 * This service listens to internal events (EventEmitter) and forwards them
 * to connected SSE clients, enabling real-time push notifications
 */
class EventBridge {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the event bridge
   * Sets up listeners on internal events and forwards them to SSE
   */
  initialize() {
    if (this.initialized) {
      logger.info('[EventBridge] Already initialized');
      return;
    }

    // ========== SCRAPING EVENTS ==========
    
    // Generic strategy sync events (catches all strategies)
    scrapingEvents.on('strategySyncStarted', (data) => {
      const { userId, bankAccountId, strategyName } = data;
      const userIdStr = userId.toString();
      logger.info(`[EventBridge] Forwarding strategySyncStarted: ${strategyName} for user ${userIdStr}`);
      sseService.emit(userIdStr, 'scraping:started', {
        strategy: strategyName,
        bankAccountId,
        timestamp: new Date().toISOString()
      });
    });

    scrapingEvents.on('strategySyncCompleted', (data) => {
      const { userId, bankAccountId, strategyName, result } = data;
      const userIdStr = userId.toString();
      logger.info(`[EventBridge] Forwarding strategySyncCompleted: ${strategyName} for user ${userIdStr}`);
      sseService.emit(userIdStr, 'scraping:completed', {
        strategy: strategyName,
        bankAccountId,
        transactionsImported: result?.transactions?.newTransactions || 0,
        timestamp: new Date().toISOString()
      });
    });

    scrapingEvents.on('strategySyncFailed', (data) => {
      const { userId, bankAccountId, strategyName, error } = data;
      const userIdStr = userId.toString();
      logger.info(`[EventBridge] Forwarding strategySyncFailed: ${strategyName} for user ${userIdStr}`);
      sseService.emit(userIdStr, 'scraping:failed', {
        strategy: strategyName,
        bankAccountId,
        error: error?.message || 'Scraping failed',
        timestamp: new Date().toISOString()
      });
    });

    scrapingEvents.on('accountSyncCompleted', (data) => {
      const { userId, bankAccountId } = data;
      const userIdStr = userId.toString();
      logger.info(`[EventBridge] Forwarding accountSyncCompleted for user ${userIdStr}`);
      sseService.emit(userIdStr, 'account:sync-completed', {
        bankAccountId,
        timestamp: new Date().toISOString()
      });
    });

    // ========== ONBOARDING EVENTS ==========

    // Credit card detection completed
    scrapingEvents.on('credit-card-detection:completed', (data) => {
      const { userId, analysis } = data;
      const userIdStr = userId.toString();
      logger.info(`[EventBridge] Forwarding credit-card-detection:completed for user ${userIdStr}`);
      sseService.emit(userIdStr, 'onboarding:credit-card-detection', {
        recommendation: analysis?.recommendation,
        transactionCount: analysis?.transactionCount,
        timestamp: new Date().toISOString()
      });
    });

    // Credit card matching completed
    scrapingEvents.on('credit-card-matching:completed', (data) => {
      const { userId, matchingResults } = data;
      const userIdStr = userId.toString();
      logger.info(`[EventBridge] Forwarding credit-card-matching:completed for user ${userIdStr}`);
      sseService.emit(userIdStr, 'onboarding:credit-card-matching', {
        coveragePercentage: matchingResults?.coveragePercentage,
        matchedPayments: matchingResults?.coveredCount,
        unmatchedPayments: matchingResults?.uncoveredCount,
        timestamp: new Date().toISOString()
      });
    });

    // ========== FUTURE: Add more event types as needed ==========
    // Examples:
    // - investment-sync:completed
    // - budget:updated
    // - transaction:categorized
    // - rsu:vested
    // - alert:triggered

    this.initialized = true;
    logger.info('✅ Event Bridge initialized - forwarding internal events to SSE clients');
  }

  /**
   * Manually emit an event to SSE clients
   * Useful for custom events not tied to existing EventEmitters
   */
  emit(userId, eventType, data) {
    return sseService.emit(userId, eventType, data);
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(eventType, data) {
    return sseService.broadcast(eventType, data);
  }
}

// Export singleton instance
const eventBridge = new EventBridge();

module.exports = eventBridge;
