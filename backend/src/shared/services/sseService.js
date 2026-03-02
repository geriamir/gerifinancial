const logger = require('../utils/logger');

/**
 * Generic Server-Sent Events (SSE) service for real-time client updates
 * Provides push-based notifications for any subsystem in the application
 * 
 * Usage:
 * 1. Connect client: sseService.addClient(userId, res)
 * 2. Emit events: sseService.emit(userId, eventType, data)
 * 3. Subscribe to events: sseService.on(eventPattern, handler)
 */
class SSEService {
  constructor() {
    this.clients = new Map(); // userId -> Set of response objects
    this.eventHandlers = new Map(); // eventType -> Set of handler functions
  }

  /**
   * Add a client connection for a user
   * Sets up SSE headers and maintains the connection
   */
  addClient(userId, res) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx

    // Add client to user's connection set
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    
    this.clients.get(userId).add(res);
    logger.info(`[SSE] Client connected for user ${userId}. Total clients: ${this.clients.get(userId).size}`);

    // Send initial connection confirmation
    this.sendToClient(res, 'connected', { 
      timestamp: new Date().toISOString(),
      message: 'Connected to event stream' 
    });

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (!res.finished && !res.destroyed) {
        this.sendToClient(res, 'heartbeat', { timestamp: new Date().toISOString() });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Clean up on disconnect
    res.on('close', () => {
      clearInterval(heartbeatInterval);
      this.removeClient(userId, res);
    });
  }

  /**
   * Remove a client connection
   */
  removeClient(userId, res) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
      logger.info(`[SSE] Client disconnected for user ${userId}. Remaining: ${userClients.size}`);
    }
  }

  /**
   * Send an event to a specific client connection
   */
  sendToClient(res, eventType, data) {
    if (res.finished || res.destroyed) {
      return false;
    }

    try {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (error) {
      logger.error('[SSE] Error sending event:', error);
      return false;
    }
  }

  /**
   * Emit an event to a specific user (all their connections)
   */
  emit(userId, eventType, data) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.size === 0) {
      logger.warn(`[SSE] ⚠️ No clients connected for user ${userId}, event ${eventType} not sent`);
      logger.info(`[SSE] Currently connected users: ${Array.from(this.clients.keys()).join(', ')}`);
      return 0;
    }

    logger.info(`[SSE] ✅ Emitting ${eventType} to ${userClients.size} client(s) for user ${userId}`);
    logger.info(`[SSE] Event data:`, JSON.stringify(data));
    
    let successCount = 0;
    for (const res of userClients) {
      if (this.sendToClient(res, eventType, data)) {
        successCount++;
        logger.info(`[SSE] ✅ Successfully sent ${eventType} to client`);
      } else {
        logger.warn(`[SSE] ❌ Failed to send ${eventType} to client`);
      }
    }

    // Trigger any registered event handlers
    this.triggerHandlers(eventType, { userId, ...data });

    logger.info(`[SSE] Event ${eventType} sent to ${successCount}/${userClients.size} clients`);
    return successCount;
  }

  /**
   * Emit an event to all connected users
   */
  broadcast(eventType, data) {
    let totalSent = 0;
    for (const userId of this.clients.keys()) {
      totalSent += this.emit(userId, eventType, data);
    }
    return totalSent;
  }

  /**
   * Register an event handler (for server-side event processing)
   * Useful for logging, metrics, or triggering other actions
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType).add(handler);
  }

  /**
   * Remove an event handler
   */
  off(eventType, handler) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
  }

  /**
   * Trigger registered event handlers
   */
  triggerHandlers(eventType, data) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          logger.error(`[SSE] Error in event handler for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Get statistics about active connections
   */
  getStats() {
    let totalConnections = 0;
    const userConnections = {};

    for (const [userId, clients] of this.clients.entries()) {
      totalConnections += clients.size;
      userConnections[userId] = clients.size;
    }

    return {
      totalUsers: this.clients.size,
      totalConnections,
      userConnections,
      registeredHandlers: this.eventHandlers.size
    };
  }

  /**
   * Check if a user has active connections
   */
  hasConnections(userId) {
    const clients = this.clients.get(userId);
    return clients && clients.size > 0;
  }

  /**
   * Close all connections for a user
   */
  disconnectUser(userId) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      for (const res of userClients) {
        try {
          res.end();
        } catch (error) {
          logger.error(`[SSE] Error closing connection for user ${userId}:`, error);
        }
      }
      this.clients.delete(userId);
      logger.info(`[SSE] Disconnected all clients for user ${userId}`);
    }
  }

  /**
   * Close all connections
   */
  disconnectAll() {
    for (const userId of this.clients.keys()) {
      this.disconnectUser(userId);
    }
    logger.info('[SSE] Disconnected all clients');
  }
}

// Export singleton instance
const sseService = new SSEService();

module.exports = sseService;
