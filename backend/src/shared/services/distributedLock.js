const Redis = require('ioredis');
const logger = require('../utils/logger');

/**
 * Distributed Lock Service using Redis
 * Prevents concurrent operations on the same resource across multiple processes
 */
class DistributedLockService {
  constructor() {
    this.redis = null;
    this.lockPrefix = 'lock:';
    this.defaultTTL = 300000; // 5 minutes default lock TTL in milliseconds
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    if (this.redis) return;

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        lazyConnect: true
      });

      await this.redis.connect();
      logger.info('Distributed lock service initialized with Redis');
    } catch (error) {
      logger.error('Failed to initialize distributed lock service:', error);
      throw error;
    }
  }

  /**
   * Acquire a lock for a specific resource
   * @param {string} resourceId - Unique identifier for the resource
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   * @param {number} maxRetries - Maximum number of retry attempts (default: 0)
   * @param {number} retryDelay - Delay between retries in milliseconds (default: 1000)
   * @returns {Promise<string|null>} Lock token if acquired, null if lock is held by another process
   */
  async acquireLock(resourceId, ttl = this.defaultTTL, maxRetries = 0, retryDelay = 1000) {
    if (!this.redis) {
      await this.initialize();
    }

    const lockKey = `${this.lockPrefix}${resourceId}`;
    const lockToken = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Use SET with NX (only set if not exists) and PX (expiry in milliseconds)
        const result = await this.redis.set(lockKey, lockToken, 'PX', ttl, 'NX');
        
        if (result === 'OK') {
          logger.info(`Acquired lock for ${resourceId} with token ${lockToken} (TTL: ${ttl}ms)`);
          return lockToken;
        }

        // Lock is held by another process
        if (attempt < maxRetries) {
          logger.debug(`Lock for ${resourceId} is held, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.delay(retryDelay);
        }
      } catch (error) {
        logger.error(`Error acquiring lock for ${resourceId}:`, error);
        throw error;
      }
    }

    logger.warn(`Failed to acquire lock for ${resourceId} after ${maxRetries} retries`);
    return null;
  }

  /**
   * Release a lock for a specific resource
   * Only releases if the token matches (prevents releasing someone else's lock)
   * @param {string} resourceId - Unique identifier for the resource
   * @param {string} lockToken - Token received when acquiring the lock
   * @returns {Promise<boolean>} True if released, false if lock was not held or token mismatch
   */
  async releaseLock(resourceId, lockToken) {
    if (!this.redis) {
      await this.initialize();
    }

    const lockKey = `${this.lockPrefix}${resourceId}`;

    try {
      // Lua script to atomically check token and delete
      // This ensures we only delete the lock if we own it
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, lockKey, lockToken);
      
      if (result === 1) {
        logger.info(`Released lock for ${resourceId} with token ${lockToken}`);
        return true;
      } else {
        logger.warn(`Failed to release lock for ${resourceId} - token mismatch or lock already expired`);
        return false;
      }
    } catch (error) {
      logger.error(`Error releasing lock for ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a lock is currently held for a resource
   * @param {string} resourceId - Unique identifier for the resource
   * @returns {Promise<boolean>} True if lock exists, false otherwise
   */
  async isLocked(resourceId) {
    if (!this.redis) {
      await this.initialize();
    }

    const lockKey = `${this.lockPrefix}${resourceId}`;

    try {
      const exists = await this.redis.exists(lockKey);
      return exists === 1;
    } catch (error) {
      logger.error(`Error checking lock status for ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Extend the TTL of an existing lock
   * Only extends if the token matches
   * @param {string} resourceId - Unique identifier for the resource
   * @param {string} lockToken - Token received when acquiring the lock
   * @param {number} additionalTTL - Additional time in milliseconds
   * @returns {Promise<boolean>} True if extended, false if lock not held or token mismatch
   */
  async extendLock(resourceId, lockToken, additionalTTL) {
    if (!this.redis) {
      await this.initialize();
    }

    const lockKey = `${this.lockPrefix}${resourceId}`;

    try {
      // Lua script to atomically check token and extend TTL
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, lockKey, lockToken, additionalTTL);
      
      if (result === 1) {
        logger.debug(`Extended lock for ${resourceId} by ${additionalTTL}ms`);
        return true;
      } else {
        logger.warn(`Failed to extend lock for ${resourceId} - token mismatch or lock already expired`);
        return false;
      }
    } catch (error) {
      logger.error(`Error extending lock for ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a function with a lock
   * Automatically acquires lock, executes function, and releases lock
   * @param {string} resourceId - Unique identifier for the resource
   * @param {Function} fn - Async function to execute while holding the lock
   * @param {Object} options - Lock options
   * @returns {Promise<any>} Result of the function
   */
  async withLock(resourceId, fn, options = {}) {
    const {
      ttl = this.defaultTTL,
      maxRetries = 0,
      retryDelay = 1000,
      throwOnLockFailure = true
    } = options;

    const lockToken = await this.acquireLock(resourceId, ttl, maxRetries, retryDelay);

    if (!lockToken) {
      if (throwOnLockFailure) {
        throw new Error(`Failed to acquire lock for ${resourceId}`);
      }
      logger.warn(`Skipping operation for ${resourceId} - lock is held by another process`);
      return null;
    }

    try {
      // Execute the function
      const result = await fn();
      return result;
    } finally {
      // Always release the lock, even if the function throws
      await this.releaseLock(resourceId, lockToken);
    }
  }

  /**
   * Utility: Delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close Redis connection
   */
  async shutdown() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      logger.info('Distributed lock service shutdown complete');
    }
  }
}

// Singleton instance
const distributedLockService = new DistributedLockService();

module.exports = distributedLockService;
