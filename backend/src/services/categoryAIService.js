const natural = require('natural');
const translate = require('@vitalets/google-translate-api').default;
const WordTokenizer = natural.WordTokenizer;
const PorterStemmer = natural.PorterStemmer;
const VendorMapping = require('../models/VendorMapping');

class CategoryAIService {
  constructor() {
    this.tokenizer = new WordTokenizer();
    this.tfidf = new natural.TfIdf();
    this.classifier = new natural.LogisticRegressionClassifier();
    this.initialized = false;
    this.translationCache = new Map();
  }

  /**
   * Translate text from Hebrew to English
   * @param {string} text - Text to translate
   * @returns {Promise<string>} - Translated text
   */
  async translateText(text) {
    try {
      // Check cache first
      if (this.translationCache.has(text)) {
        return this.translationCache.get(text);
      }

      const result = await translate(text, { from: 'he', to: 'en' });
      this.translationCache.set(text, result.text);
      
      console.log('Translation result:', {
        original: text,
        translated: result.text
      });

      return result.text;
    } catch (error) {
      console.error('Translation failed:', error);
      return text; // Return original text on failure
    }
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
    console.log('Similarity calculation:', {
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

  /**
   * Suggests a category and subcategory for a transaction using NLP
   * @param {string} description - Transaction description
   * @param {number} amount - Transaction amount
   * @param {Array<{id: string, name: string, type: string, subCategories: Array<{id: string, name: string, keywords: string[]}>}>} availableCategories - List of available categories
   * @param {string} userId - User ID for vendor mapping lookup
   * @returns {Promise<{categoryId: string, subCategoryId: string, confidence: number, reasoning: string}>}
   */
  async suggestCategory(description = '', amount = 0, availableCategories = [], userId = null) {
    try {

      if (!description || !availableCategories?.length || !userId) {
        return {
          categoryId: null,
          subCategoryId: null,
          confidence: 0,
          reasoning: 'Missing input parameters'
        };
      }

      // First try to find an exact vendor match
      const vendorMatches = await VendorMapping.findMatches(description, userId);
      if (vendorMatches.length > 0) {
        const match = vendorMatches[0];
        console.log('Found exact vendor match:', {
          vendor: match.vendorName,
          category: match.category,
          subCategory: match.subCategory
        });
        return {
          categoryId: match.category.toString(),
          subCategoryId: match.subCategory.toString(),
          confidence: match.confidence,
          reasoning: `Matched based on known vendor: ${match.vendorName}`
        };
      }

      // Try similar vendor match
      const similarVendor = await VendorMapping.suggestMapping(description, userId);
      if (similarVendor) {
        console.log('Found similar vendor:', {
          original: description,
          matchedVendor: similarVendor.vendorName,
          category: similarVendor.category,
          subCategory: similarVendor.subCategory
        });
        return {
          categoryId: similarVendor.category.toString(),
          subCategoryId: similarVendor.subCategory.toString(),
          confidence: 0.7,
          reasoning: `Matched based on similar vendor: ${similarVendor.vendorName}`
        };
      }

      // No vendor match, try translation and keyword matching
      const translatedDesc = await this.translateText(description);
      console.log('Using translated description:', {
        original: description,
        translated: translatedDesc
      });

      const processedDesc = this.processText(translatedDesc.toLowerCase());
      let bestMatch = {
        categoryId: null,
        subCategoryId: null,
        confidence: 0,
        reasoning: ''
      };
      
      for (const category of availableCategories) {
        this.buildCorpus(category.subCategories);
        
        const scores = [];
        this.tfidf.tfidfs(processedDesc.join(' '), (index, score) => {
          scores.push({
            subCategory: category.subCategories[index],
            score
          });
        });

        const bestSubMatch = scores.reduce((best, current) => {
          const keywordMatch = current.subCategory.keywords?.some(keyword =>
            translatedDesc.toLowerCase().includes(keyword.toLowerCase())
          ) ? 0.5 : 0;

          const totalScore = current.score + keywordMatch;
          return totalScore > best.score ? 
            { subCategory: current.subCategory, score: totalScore } : 
            best;
        }, { subCategory: null, score: 0 });

        if (bestSubMatch.score > bestMatch.confidence) {
          console.log('New best match found:', {
            description: translatedDesc,
            category: category.name,
            subCategory: bestSubMatch.subCategory.name,
            score: bestSubMatch.score
          });

          bestMatch = {
            categoryId: category.id,
            subCategoryId: bestSubMatch.subCategory.id,
            confidence: Math.min(bestSubMatch.score / 2, 1),
            reasoning: `Matched based on ${bestSubMatch.score > 0.5 ? 'strong' : 'partial'} similarity to subcategory "${bestSubMatch.subCategory.name}"`
          };
        }
      }

      if (!bestMatch.categoryId && availableCategories.length > 0) {
        const firstCategory = availableCategories[0];
        const firstSubCategory = firstCategory.subCategories?.[0];
        bestMatch = {
          categoryId: firstCategory.id,
          subCategoryId: firstSubCategory?.id || null,
          confidence: 0.1,
          reasoning: 'No strong matches found, using default category'
        };
      }

      return bestMatch;
    } catch (error) {
      console.error('Error in category suggestion:', error);
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
      console.log('Starting keyword suggestion for:', description);
      
      // First try with original text
      let tokens = this.processText(description);
      
      // If not enough tokens found, try with translated text
      if (tokens.length < 3) {
        const translatedDesc = await this.translateText(description);
        tokens = this.processText(translatedDesc);
      }
      
      // Filter out common words and short tokens
      const significantTokens = tokens.filter(token => 
        token.length > 3 && 
        !natural.stopwords.includes(token)
      );

      console.log('Filtered tokens:', {
        allTokens: tokens,
        significantTokens
      });

      // Get most relevant tokens based on frequency
      const wordFreq = {};
      significantTokens.forEach(token => {
        wordFreq[token] = (wordFreq[token] || 0) + 1;
      });

      const keywords = Object.entries(wordFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([token]) => token);

      console.log('Selected keywords:', keywords);
      return keywords;
    } catch (error) {
      console.error('Error suggesting keywords:', error);
      return [];
    }
  }
}

module.exports = new CategoryAIService();
