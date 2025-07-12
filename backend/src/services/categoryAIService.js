const logger = require('../utils/logger');
const natural = require('natural');
const translationService = require('./translationService');
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
  _generateReasoning(score, subCategoryName, hasRawCategory) {
    const confidence = score > 0.8 ? 'Very strong confidence' :
                      score > 0.6 ? 'Strong confidence' :
                      score > 0.4 ? 'Moderate confidence' :
                      'Low confidence';
    
    const source = hasRawCategory ? 
      'based on bank-provided category' :
      'based on transaction description';

    return `${confidence} match for ${subCategoryName} ${source}`;
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
    logger.info('Similarity calculation:', {
      text1,
      text2,
      intersection: Array.from(intersection),
      union: Array.from(union),
      similarity
    });

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

      // Exact keyword match check first
      for (const category of availableCategories) {
        for (const subCategory of category.subCategories) {
          const exactMatch = subCategory.keywords?.some(
            kw => text.toLowerCase().includes(kw.toLowerCase()) || 
                 translatedText.toLowerCase().includes(kw.toLowerCase())
          );

          if (exactMatch) {
            // Higher confidence for exact keyword matches
            const confidence = isRawCategory ? 0.95 : 0.85;
            return {
              categoryId: category.id,
              subCategoryId: subCategory.id,
              confidence,
              reasoning: confidence > 0.9 
                ? 'Very strong confidence match from transaction description' 
                : 'Moderate confidence match from transaction description'
            };
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
              isRawCategory)
          };
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
          logger.info('Matched by raw category: ', {
            description: description,
            memo: memo,
            rawCategory: rawCategory,
            category: match.categoryId,
            subCategory: match.subCategoryId,
            confidence: match.confidence,
            reasoning: match.reasoning
          });

          const boostedConfidence = match.confidence * 1.2;
          const subCategoryName = availableCategories
            .find(c => c.id === match.categoryId)
            ?.subCategories.find(s => s.id === match.subCategoryId)?.name;
          
          return {
            categoryId: match.categoryId,
            subCategoryId: match.subCategoryId,
            confidence: boostedConfidence,
            reasoning: boostedConfidence > 0.8 
              ? 'Very strong confidence match from bank-provided category'
              : 'Moderate confidence match from bank-provided category'
          };
        }
      }

      // Process memo next if available
      if (memo?.length > 0) {
        match = await this.categorizeByAI(memo, availableCategories, false);
        
        if (match.confidence > 0.5) {
          logger.info('Matched by memo: ', {
            description: description,
            memo: memo,
            category: match.categoryId,
            subCategory: match.subCategoryId,
            confidence: match.confidence,
            reasoning: match.reasoning
          });

          const boostedConfidence = match.confidence * 1.1; // Slightly lower boost than rawCategory
          const subCategoryName = availableCategories
            .find(c => c.id === match.categoryId)
            ?.subCategories.find(s => s.id === match.subCategoryId)?.name;
          
          return {
            categoryId: match.categoryId,
            subCategoryId: match.subCategoryId,
            confidence: boostedConfidence,
            reasoning: boostedConfidence > 0.8 
              ? 'Very strong confidence match from transaction memo'
              : 'Moderate confidence match from transaction memo'
          };
        }
      }

      // Process description last
      match = await this.categorizeByAI(description, availableCategories, false);
      if (match.confidence > 0.5) {
          const subCategoryName = availableCategories
            .find(c => c.id === match.categoryId)
            ?.subCategories.find(s => s.id === match.subCategoryId)?.name;

          logger.info('Matched by description: ', {
              description: description,
              rawCategory: rawCategory,
              memo: memo,
              category: match.categoryId,
              subCategory: match.subCategoryId,
              confidence: match.confidence,
            reasoning: match.reasoning
          });
            
          return {
              categoryId: match.categoryId,
              subCategoryId: match.subCategoryId,
              confidence: match.confidence,
              reasoning: match.confidence > 0.8 
                ? 'Very strong confidence match from transaction description'
                : 'Moderate confidence match from transaction description'
          };
      }

      logger.info(`No suitable category match found for description ${description}, rawCategory ${rawCategory}, memo ${memo}. Match confidence: ${match?.confidence || 0}`);

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
