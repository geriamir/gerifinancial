const logger = require('../utils/logger');
const natural = require('natural');
const translationService = require('./translationService');
const { enhancedKeywordMatcher } = require('./enhanced-keyword-matching');
const WordTokenizer = natural.WordTokenizer;
const PorterStemmer = natural.PorterStemmer;

class CategoryAIService {
  constructor() {
    this.tokenizer = new WordTokenizer();
    this.tfidf = new natural.TfIdf();
    this.classifier = new natural.LogisticRegressionClassifier();
    this.initialized = false;
  }

  /**
   * Generate detailed reasoning for category suggestion
   * @private
   * @param {number} score - Match confidence score
   * @param {string} subCategoryName - Name of the matched subcategory
   * @param {boolean} hasRawCategory - Whether rawCategory was used in matching
   * @returns {string} Detailed reasoning message
   */
  _generateReasoning(score, subCategoryName, hasRawCategory, matchingType) {
    const confidence = score > 0.8 ? 'Very strong confidence' :
                      score > 0.6 ? 'Strong confidence' :
                      score > 0.4 ? 'Moderate confidence' :
                      'Low confidence';
    
    const source = hasRawCategory ? 
      'based on bank-provided category' :
      'based on transaction description';

    return `${confidence} match for ${subCategoryName} ${source}, with matching type: ${matchingType}. Confidence score: ${score.toFixed(2)}`;
  }


  /**
   * Process text into tokens and stemmed words
   * @param {string} text - Text to process
   * @returns {Array<string>} - Array of processed tokens
   */
  processText(text) {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    const stemmed = tokens.map(token => PorterStemmer.stem(token));

    return stemmed;
  }

  /**
   * Calculate similarity score between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} - Similarity score (0-1)
   */
  calculateSimilarity(text1, text2) {
    const tokens1 = new Set(this.processText(text1));
    const tokens2 = new Set(this.processText(text2));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    const similarity = intersection.size / union.size;

    return similarity;
  }

  /**
   * Build text corpus from subcategory keywords
   * @param {Array<{id: string, name: string, keywords: string[]}>} subCategories 
   */
  buildCorpus(subCategories) {
    this.tfidf = new natural.TfIdf();

    subCategories.forEach(sub => {
      const text = `${sub.name} ${(sub.keywords || []).join(' ')}`;
      this.tfidf.addDocument(this.processText(text).join(' '));
    });
  }

  async categorizeByAI(text, availableCategories, isRawCategory = false) {
      const translatedText = await translationService.translate(text, { from: 'he', to: 'en' });
      const processedText = this.processText(translatedText.toLowerCase());

      // Enhanced keyword match check first - prevents false positives
      for (const category of availableCategories) {
        // Check category-level keywords (for Income/Transfer)
        if (category.keywords && category.keywords.length > 0) {
          try {
            const keywordResult = await enhancedKeywordMatcher.matchKeywords(
              text, 
              translatedText, 
              category.keywords
            );

            if (keywordResult.hasMatches) {
              // Use enhanced matching confidence with boost for raw category
              const confidence = isRawCategory ? 
                Math.min(keywordResult.confidence * 1.1, 0.95) : 
                keywordResult.confidence;
              
              logger.info(`Enhanced keyword match for category ${category.name}: ${keywordResult.reasoning}`);
              
              return {
                categoryId: category.id,
                subCategoryId: null, // No subcategory for Income/Transfer
                confidence,
                reasoning: `Enhanced keyword matching: ${keywordResult.reasoning}. Final confidence: ${confidence.toFixed(2)}`
              };
            }
          } catch (error) {
            logger.warn(`Enhanced keyword matching failed for category ${category.name}:`, error);
            // Fallback to original logic would go here if needed
          }
        }

        // Check subcategory-level keywords (for Expenses)
        if (category.subCategories && category.subCategories.length > 0) {
          for (const subCategory of category.subCategories) {
            if (subCategory.keywords && subCategory.keywords.length > 0) {
              try {
                const keywordResult = await enhancedKeywordMatcher.matchKeywords(
                  text, 
                  translatedText, 
                  subCategory.keywords
                );

                if (keywordResult.hasMatches) {
                  // Use enhanced matching confidence with boost for raw category
                  const confidence = isRawCategory ? 
                    Math.min(keywordResult.confidence * 1.1, 0.95) : 
                    keywordResult.confidence;
                  
                  logger.debug(`Enhanced keyword match for subcategory ${subCategory.name}: ${keywordResult.reasoning}`);
                  
                  return {
                    categoryId: category.id,
                    subCategoryId: subCategory.id,
                    confidence,
                    reasoning: `Enhanced keyword matching: ${keywordResult.reasoning}. Final confidence: ${confidence.toFixed(2)}`
                  };
                }
              } catch (error) {
                logger.warn(`Enhanced keyword matching failed for subcategory ${subCategory.name}:`, error);
                // Fallback to original logic would go here if needed
              }
            }
          }
        }
      }

      let bestMatch = {
        categoryId: null,
        subCategoryId: null,
        confidence: 0,
        reasoning: 'Missing input parameters'
      };

      // TF-IDF based matching
      for (const category of availableCategories) {
        // Handle categories with keywords (Income/Transfer)
        if (category.keywords && category.keywords.length > 0) {
          const categoryText = `${category.name} ${category.keywords.join(' ')}`;
          const similarity = this.calculateSimilarity(processedText.join(' '), categoryText);
          
          if (similarity > bestMatch.confidence) {
            const confidence = isRawCategory ? 
              Math.min(similarity * 0.8, 1) : 
              Math.min(similarity * 0.6, 1);

            bestMatch = {
              categoryId: category.id,
              subCategoryId: null,
              confidence,
              reasoning: this._generateReasoning(confidence, category.name, isRawCategory, "similarity to category keywords")
            };
          }
        }

        // Handle categories with subcategories (Expenses)
        if (category.subCategories && category.subCategories.length > 0) {

          this.buildCorpus(category.subCategories);
          
          const scores = [];
          this.tfidf.tfidfs(processedText.join(' '), (index, score) => {
            scores.push({
              subCategory: category.subCategories[index],
              score: score
            });
          });

          const bestSubMatch = scores.reduce((best, current) => 
            current.score > best.score ? current : best,
            { score: 0, subCategory: null }
          );

          if (bestSubMatch.score > bestMatch.confidence) {
            const confidence = isRawCategory ? 
              Math.min(bestSubMatch.score * 0.8, 1) : 
              Math.min(bestSubMatch.score * 0.6, 1);

            bestMatch = {
              categoryId: category.id,
              subCategoryId: bestSubMatch.subCategory?.id || null,
              confidence,
              reasoning: this._generateReasoning(confidence, 
                bestSubMatch.subCategory?.name || '', 
                isRawCategory,
                "based on tfidf score for subcategories")
            };
          }
        }
      }

      return bestMatch;
  }

  /**
   * Suggests a category and subcategory for a transaction using NLP
   * @param {string} description - Transaction description
   * @param {number} amount - Transaction amount
   * @param {Array<{id: string, name: string, type: string, subCategories: Array<{id: string, name: string, keywords: string[]}>}>} availableCategories - List of available categories
   * @param {string} userId - User ID for authentication
   * @param {string} rawCategory - Raw category from bank
   * @param {string} memo - Transaction memo
   * @returns {Promise<{categoryId: string, subCategoryId: string, confidence: number, reasoning: string}>}
   */
  async suggestCategory(description = '', amount = 0, availableCategories = [], userId = null, rawCategory = '', memo = '') {
    try {

      const noMatch = {
          categoryId: null,
          subCategoryId: null,
          confidence: 0,
          reasoning: 'Missing input parameters'
        };

      if (!description || !availableCategories?.length || !userId) {
        return noMatch;
      }

      // Process text using AI categorization

      // Process rawCategory first
      let match;
      if (rawCategory.length > 0) {
        match = await this.categorizeByAI(rawCategory, availableCategories, true);
        
        if (match.confidence > 0.5) {

          const boostedConfidence = match.confidence * 1.2;
          
          return {
            categoryId: match.categoryId,
            subCategoryId: match.subCategoryId,
            confidence: boostedConfidence,
            reasoning: match.reasoning + `, with rawCategory match confidence: ${boostedConfidence.toFixed(2)}`
          };
        }
      }

      // Process memo next if available
      if (memo?.length > 0) {
        match = await this.categorizeByAI(memo, availableCategories, false);
        
        if (match.confidence > 0.5) {

          const boostedConfidence = match.confidence * 1.1; // Slightly lower boost than rawCategory
          const subCategoryName = availableCategories
            .find(c => c.id === match.categoryId)
            ?.subCategories.find(s => s.id === match.subCategoryId)?.name;
          
          return {
            categoryId: match.categoryId,
            subCategoryId: match.subCategoryId,
            confidence: boostedConfidence,
            reasoning: match.reasoning + `, with memo match confidence: ${boostedConfidence.toFixed(2)}`
          };
        }
      }

      // Process description last
      match = await this.categorizeByAI(description, availableCategories, false);
      if (match.confidence > 0.5) {

          return {
              categoryId: match.categoryId,
              subCategoryId: match.subCategoryId,
              confidence: match.confidence,
              reasoning: match.reasoning + `, with description match confidence: ${match.confidence.toFixed(2)}`
          };
      }

      return noMatch;
    } catch (error) {
      logger.error('Error in category suggestion:', error);
      throw new Error('Failed to get category suggestion');
    }
  }

  /**
   * Updates subcategory keywords based on successful categorizations
   * @param {string} description - Transaction description
   * @returns {Promise<Array<string>>} - Updated keywords
   */
  async suggestNewKeywords(description) {
    try {
      
      // First try with original text
      let tokens = this.processText(description);
      
      // If not enough tokens found, try with translated text
      if (tokens.length < 3) {
        const translatedDesc = await translationService.translate(description, { from: 'he', to: 'en' });
        tokens = this.processText(translatedDesc);
      }
      
      // Filter out common words and short tokens
      const significantTokens = tokens.filter(token => 
        token.length > 3 && 
        !natural.stopwords.includes(token)
      );

      // Get most relevant tokens based on frequency
      const wordFreq = {};
      significantTokens.forEach(token => {
        wordFreq[token] = (wordFreq[token] || 0) + 1;
      });

      const keywords = Object.entries(wordFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([token]) => token);

      return keywords;
    } catch (error) {
      logger.error('Error suggesting keywords:', error);
      return [];
    }
  }
}

module.exports = new CategoryAIService();
