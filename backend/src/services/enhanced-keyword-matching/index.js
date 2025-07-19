const EnhancedKeywordMatcher = require('./EnhancedKeywordMatcher');

/**
 * Enhanced Keyword Matching Module
 * 
 * This module provides robust keyword matching that addresses false positives
 * from simple substring matching while maintaining legitimate variations.
 * 
 * Key Features:
 * - Word boundary detection to prevent partial matches (car vs scar)
 * - Stemming support for variations (car vs cars)
 * - Multi-language support for Hebrew text
 * - Context validation to prevent false positives
 * - Graduated confidence scoring
 * - Performance monitoring and statistics
 */

// Create singleton instance for performance (shared regex cache)
const enhancedKeywordMatcher = new EnhancedKeywordMatcher();

module.exports = {
  // Main class export
  EnhancedKeywordMatcher,
  
  // Singleton instance (recommended for most use cases)
  enhancedKeywordMatcher,
  
  // Convenience methods using singleton instance
  async matchKeywords(text, translatedText, keywords, options = {}) {
    return enhancedKeywordMatcher.matchKeywords(text, translatedText, keywords, options);
  },

  async findBestMatch(text, translatedText, keyword, options = {}) {
    return enhancedKeywordMatcher.findBestMatch(text, translatedText, keyword, options);
  },

  exactPhraseMatch(text, phrase) {
    return enhancedKeywordMatcher.exactPhraseMatch(text, phrase);
  },

  stemmedWordMatch(text, keyword) {
    return enhancedKeywordMatcher.stemmedWordMatch(text, keyword);
  },

  getStats() {
    return enhancedKeywordMatcher.getStats();
  },

  resetStats() {
    return enhancedKeywordMatcher.resetStats();
  },

  clearCache() {
    return enhancedKeywordMatcher.clearCache();
  }
};
