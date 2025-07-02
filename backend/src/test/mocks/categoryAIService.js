class MockCategoryAIService {
  constructor() {
    this.tfidf = null;
    this.initialized = true;
  }

  processText(text) {
    if (!text) return [];
    const tokens = text.toLowerCase().split(' ').filter(Boolean);
    // Simulate stemming by removing non-letters and keeping word roots
    return tokens.map(token => {
      const cleaned = token.replace(/[^a-z]/g, '');
      // Simplified Porter stemming
      let stemmed = cleaned;
      // Step 1
      stemmed = stemmed.replace(/(?:ational|tional|ational|iveness|fulness|ousness|aliti|iviti|biliti)$/, 'ate');
      stemmed = stemmed.replace(/(?:icate|ative|alize|iciti|ical)$/, 'ic');
      // Step 2
      stemmed = stemmed.replace(/(?:ency|ancy)$/, 'ent');
      stemmed = stemmed.replace(/(?:ing|ed)$/, '');
      // Step 3
      stemmed = stemmed.replace(/y$/, 'i');
      stemmed = stemmed.replace(/(?:ness|ship|ment|ate|ize|ion|ant|ent|ism|ic|al|er|or|ful|ous|ive|s|e)$/, '');
      return stemmed;
    });
  }

  calculateSimilarity(text1, text2) {
    const tokens1 = new Set(this.processText(text1));
    const tokens2 = new Set(this.processText(text2));
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    return intersection.size / (tokens1.size + tokens2.size - intersection.size);
  }

  async suggestCategory(description = '', amount = 0, availableCategories = []) {
    if (!description || !availableCategories?.length) {
      return {
        categoryId: null,
        subCategoryId: null,
        confidence: 0,
        reasoning: 'Missing input parameters'
      };
    }
    try {
      // Mock restaurant category match
      const words = description.toLowerCase().split(' ');
      const isRestaurant = words.some(word => 
        ['restaurant', 'dining', 'cafe', 'food'].includes(word)
      );

      if (isRestaurant) {
        const foodCategory = availableCategories.find(c => c.name.toLowerCase() === 'food');
        if (foodCategory && foodCategory.subCategories?.length) {
          const restaurant = foodCategory.subCategories.find(s => 
            s.name.toLowerCase() === 'restaurants' || 
            s.keywords?.some(k => words.includes(k.toLowerCase()))
          );
          
          if (restaurant) {
          return {
            categoryId: foodCategory._id?.toString() || foodCategory.id,
            subCategoryId: restaurant._id?.toString() || restaurant.id,
            confidence: 0.9,
            reasoning: `Strong match for ${restaurant.name} subcategory in ${foodCategory.name}`
            };
          }
        }
      }

      // Return low confidence for ambiguous descriptions
      const firstCategory = availableCategories[0];
      const firstSubCategory = firstCategory?.subCategories?.[0];
      return {
        categoryId: firstCategory?._id?.toString() || firstCategory?.id || null,
        subCategoryId: firstSubCategory?._id?.toString() || firstSubCategory?.id || null,
        confidence: 0.3,
        reasoning: 'Low confidence match'
      };
    } catch (error) {
      console.error('Error in mock suggestCategory:', error);
      return {
        categoryId: null,
        subCategoryId: null,
        confidence: 0,
        reasoning: 'Error in category suggestion'
      };
    }
  }

  async suggestNewKeywords(description = '') {
    const words = description.toLowerCase().split(' ');
    return words
      .filter(word => word.length > 3)
      .slice(0, 3)
      .map(word => word.trim())
      .filter(Boolean);
  }
}

module.exports = new MockCategoryAIService();
