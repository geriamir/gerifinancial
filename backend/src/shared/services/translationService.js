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
   * Extract only words that need translation, filtering out numbers, currency, and special characters
   * @private
   * @param {string} text - Original text
   * @returns {string|null} - Cleaned text with only translatable words, or null if nothing to translate
   */
  _extractTranslatableWords(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // Remove common patterns that don't need translation
    let cleanText = text
      // Remove currency symbols and amounts (like $68.25, ₪123.45, €50.00)
      .replace(/[₪$€£¥]\s*\d+(?:[.,]\d+)?/g, '')
      // Remove standalone currency symbols
      .replace(/\s+[₪$€£¥]\s*/g, ' ')
      // Remove dates (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, MM/YYYY, etc.)
      .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, '')
      .replace(/\b\d{1,2}[./-]\d{4}\b/g, '')
      .replace(/\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/g, '')
      // Remove standalone numbers (integers and decimals)
      .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
      // Remove common punctuation and special characters but keep basic punctuation
      .replace(/[-_=+*/\\|<>{}[\]()]/g, ' ')
      // Remove multiple spaces and extra dots/commas
      .replace(/\s*[.,]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If the cleaned text is empty or too short, don't translate
    if (!cleanText || cleanText.length < 2) {
      return null;
    }

    // Check if the text contains only Latin characters, numbers, and common punctuation
    // If so, it likely doesn't need translation
    const latinOnlyPattern = /^[a-zA-Z0-9\s.,!?;:'"'-]+$/;
    if (latinOnlyPattern.test(cleanText)) {
      return null;
    }

    // Additional check: if only punctuation and spaces remain, skip
    const onlyPunctuationPattern = /^[\s.,!?;:"'-]+$/;
    if (onlyPunctuationPattern.test(cleanText)) {
      return null;
    }

    return cleanText;
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

    // First, extract only translatable words
    const translatableText = this._extractTranslatableWords(text);
    
    // If no translatable content found, return original text
    if (!translatableText) {
      logger.debug(`Skipping translation - no translatable words found in: "${text}"`);
      return text;
    }

    // Check memory cache first (using original text as key for consistency)
    const cacheKey = `${text}:${from}:${to}`;
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey);
    }

    // Check MongoDB cache (using original text as key)
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
        // Translate only the cleaned text
        const result = await translate(translatableText, { from, to });
        
        // Create a translated version by replacing the translatable part in original text
        let translatedText = text;
        if (result.text && result.text !== translatableText) {
          // Replace the original translatable words with translated words
          translatedText = text.replace(translatableText, result.text);
        }
        
        // Save to MongoDB and memory cache (using original text as key)
        try {
          await Translation.findOrCreate(text, translatedText, from, to);
          this._addToMemoryCache(cacheKey, translatedText);
        } catch (error) {
          logger.warn('Failed to cache translation:', error);
        }
        
        return translatedText;
      } catch (error) {
        if (error.message.toLowerCase().includes('too many requests') || error.response?.status === 429) {
          if (retryCount === maxRetries) {
            logger.error(`Translation of "${translatableText}" (from "${text}") failed after ${maxRetries} retries:`, error);
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
