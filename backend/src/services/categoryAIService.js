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
    const stemmed = tokens.map(token => stemmer.stem(token));
    
    console.log('Text processing:', {
      original: text,
      tokens: tokens,
      stemmed: stemmed
    });

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
    
    console.log('Building corpus from subcategories:', {
      subCategoryCount: subCategories.length,
      subCategories: subCategories.map(sub => ({
        name: sub.name,
        keywords: sub.keywords
      }))
    });

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
      console.log('Starting category suggestion for:', {
        description,
        amount,
        availableCategories: availableCategories.map(cat => ({
          name: cat.name,
          type: cat.type,
          subCategoriesCount: cat.subCategories.length
        }))
      });

      let bestMatch = {
        categoryId: null,
        subCategoryId: null,
        confidence: 0,
        reasoning: ''
      };

      // Process the transaction description
      const processedDesc = this.processText(description.toLowerCase());
      
      for (const category of availableCategories) {
        console.log(`Processing category: ${category.name}`);
        
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

        console.log('TF-IDF Scores:', {
          category: category.name,
          scores: scores.map(s => ({
            subCategory: s.subCategory.name,
            score: s.score,
            keywords: s.subCategory.keywords
          }))
        });

        // Find best matching subcategory
        const bestSubMatch = scores.reduce((best, current) => {
          // Also consider exact keyword matches
          const keywordMatch = current.subCategory.keywords?.some(keyword =>
            description.toLowerCase().includes(keyword.toLowerCase())
          ) ? 0.5 : 0;

          console.log('Subcategory match calculation:', {
            subCategory: current.subCategory.name,
            tfidfScore: current.score,
            keywordMatch,
            totalScore: current.score + keywordMatch
          });

          const totalScore = current.score + keywordMatch;
          return totalScore > best.score ? 
            { subCategory: current.subCategory, score: totalScore } : 
            best;
        }, { subCategory: null, score: 0 });

        if (bestSubMatch.score > bestMatch.confidence) {
          console.log('New best match found:', {
            category: category.name,
            subCategory: bestSubMatch.subCategory.name,
            score: bestSubMatch.score
          });

          bestMatch = {
            categoryId: category.id,
            subCategoryId: bestSubMatch.subCategory.id,
            confidence: Math.min(bestSubMatch.score / 2, 1), // Normalize to 0-1
            reasoning: `Matched based on ${bestSubMatch.score > 0.5 ? 'strong' : 'partial'} similarity to subcategory "${bestSubMatch.subCategory.name}"`
          };
        }
      }

      console.log('Final suggestion:', bestMatch);
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
      
      const tokens = this.processText(description);
      
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

      console.log('Word frequencies:', wordFreq);

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
