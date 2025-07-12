const logger = require('../utils/logger');
const { translate } = require('@vitalets/google-translate-api');
const Translation = require('../models/Translation');

class TranslationService {
  constructor() {
    // Keep a small in-memory cache for frequent translations
    this.memoryCache = new Map();
    this.memoryCacheMaxSize = 1000;
  }

  /**
   * Add translation to memory cache with LRU eviction
   * @private
   */
  _addToMemoryCache(key, value) {
    if (this.memoryCache.size >= this.memoryCacheMaxSize) {
      // Remove oldest entry (first in Map)
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, value);
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract retry after value from error
   * @private
   * @param {Error} error - Error object from translation attempt
   * @returns {number} - Milliseconds to wait before retry
   */
  _getRetryAfterMs(error) {
    // Default to 60 seconds if no retry-after header
    const defaultRetry = 60 * 1000;

    try {
      // Check if error has response with headers
      if (error.response?.headers?.['retry-after']) {
        const retrySeconds = parseInt(error.response.headers['retry-after'], 10);
        if (!isNaN(retrySeconds)) {
          return retrySeconds * 1000; // Convert to milliseconds
        }
      }
    } catch (e) {
      logger.warn('Failed to parse retry-after header:', e);
    }

    return defaultRetry;
  }

  /**
   * Translate text with retry logic
   * @param {string} text - Text to translate
   * @param {Object} options - Translation options
   * @param {string} options.from - Source language (default: 'auto')
   * @param {string} options.to - Target language (default: 'en')
   * @param {number} options.maxRetries - Maximum number of retries (default: 3)
   * @returns {Promise<string>} - Translated text
   */
  async translate(text, options = {}) {
    const {
      from = 'auto',
      to = 'en',
      maxRetries = 3
    } = options;

    // Check memory cache first
    const cacheKey = `${text}:${from}:${to}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    // Check MongoDB cache
    try {
      const cachedTranslation = await Translation.findOne({
        originalText: text,
        fromLanguage: from,
        toLanguage: to
      });

      if (cachedTranslation) {
        // Add to memory cache
        this._addToMemoryCache(cacheKey, cachedTranslation.translatedText);
        return cachedTranslation.translatedText;
      }
    } catch (error) {
      logger.warn('Failed to check MongoDB translation cache:', error);
    }

    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const result = await translate(text, { from, to });
        
        // Save to MongoDB and memory cache
        try {
          await Translation.findOrCreate(text, result.text, from, to);
          this._addToMemoryCache(cacheKey, result.text);
        } catch (error) {
          logger.warn('Failed to cache translation:', error);
        }
        
        return result.text;
      } catch (error) {
        if (error.message.toLowerCase().includes('too many requests') || error.response?.status === 429) {
          if (retryCount === maxRetries) {
            logger.error(`Translation of ${text} failed after ${maxRetries} retries:`, error);
            return text; // Return original text after all retries exhausted
          }

          const retryAfterMs = this._getRetryAfterMs(error);
          logger.info(`Translation rate limited. Waiting ${retryAfterMs}ms before retry ${retryCount + 1}/${maxRetries}`);
          await this._sleep(retryAfterMs);
          retryCount++;
          continue;
        }

        // For other errors, log and return original text
        logger.error('Translation failed:', error);
        return text;
      }
    }

    return text; // Fallback to original text
  }
}

module.exports = new TranslationService();
