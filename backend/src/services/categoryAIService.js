const natural = require('natural');
const { tokenizer, stemmer } = natural;

class CategoryAIService {
  constructor() {
    this.tokenizer = new tokenizer();
    this.tfidf = new natural.TfIdf();
    this.classifier = new natural.LogisticRegressionClassifier();
    this.initialized = false;
  }

  /**
   * Process text into tokens and stemmed words
   * @param {string} text - Text to process
   * @returns {Array<string>} - Array of processed tokens
   */
  processText(text) {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    return tokens.map(token => stemmer.stem(token));
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

    return intersection.size / union.size;
  }

  /**
   * Build text corpus from subcategory keywords
   * @param {Array<{id: string, name: string, keywords: string[]}>} subCategories 
   */
  buildCorpus(subCategories) {
    this.tfidf = new natural.TfIdf();
    
    subCategories.forEach((sub, index) => {
      const text = `${sub.name} ${(sub.keywords || []).join(' ')}`;
      this.tfidf.addDocument(this.processText(text).join(' '));
      this.subCategoryIndex = index;
    });
  }

  /**
   * Suggests a category and subcategory for a transaction using NLP
   * @param {string} description - Transaction description
   * @param {number} amount - Transaction amount
   * @param {Array<{id: string, name: string, type: string, subCategories: Array<{id: string, name: string, keywords: string[]}>}>} availableCategories - List of available categories
   * @returns {Promise<{categoryId: string, subCategoryId: string, confidence: number, reasoning: string}>}
   */
  async suggestCategory(description, amount, availableCategories) {
    try {
      let bestMatch = {
        categoryId: null,
        subCategoryId: null,
        confidence: 0,
        reasoning: ''
      };

      // Process the transaction description
      const processedDesc = this.processText(description.toLowerCase());
      
      for (const category of availableCategories) {
        // Build corpus for this category's subcategories
        this.buildCorpus(category.subCategories);
        
        // Get TF-IDF scores for the description
        const scores = [];
        this.tfidf.tfidfs(processedDesc.join(' '), (index, score) => {
          scores.push({
            subCategory: category.subCategories[index],
            score
          });
        });

        // Find best matching subcategory
        const bestSubMatch = scores.reduce((best, current) => {
          // Also consider exact keyword matches
          const keywordMatch = current.subCategory.keywords?.some(keyword =>
            description.toLowerCase().includes(keyword.toLowerCase())
          ) ? 0.5 : 0;

          const totalScore = current.score + keywordMatch;
          return totalScore > best.score ? 
            { subCategory: current.subCategory, score: totalScore } : 
            best;
        }, { subCategory: null, score: 0 });

        if (bestSubMatch.score > bestMatch.confidence) {
          bestMatch = {
            categoryId: category.id,
            subCategoryId: bestSubMatch.subCategory.id,
            confidence: Math.min(bestSubMatch.score / 2, 1), // Normalize to 0-1
            reasoning: `Matched based on ${bestSubMatch.score > 0.5 ? 'strong' : 'partial'} similarity to subcategory "${bestSubMatch.subCategory.name}"`
          };
        }
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
      const tokens = this.processText(description);
      
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
      console.error('Error suggesting keywords:', error);
      return [];
    }
  }
}

module.exports = new CategoryAIService();
