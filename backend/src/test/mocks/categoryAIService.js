let mockCategories = {};
let mockTranslation = {
  'בית קפה': 'coffee shop',
  'מסעדה': 'restaurant',
  'סופרמרקט': 'supermarket'
};

let translationCache = new Map();

const createMockSuggestion = (categoryId, subCategoryId) => ({
  categoryId: categoryId.toString(),
  subCategoryId: subCategoryId.toString(),
  confidence: 0.9,
  reasoning: 'Strong match for Restaurants subcategory in Food'
});

module.exports = {
  suggestCategory: jest.fn().mockImplementation((description, amount, categories, userId) => {
    // First check for Hebrew text
    const translatedDesc = mockTranslation[description] || description;
    const searchDesc = translatedDesc.toLowerCase();

    // Use the first available category/subcategory for restaurant matches
    if (searchDesc.includes('restaurant') || searchDesc.includes('coffee shop')) {
      const category = categories[0];
      const subCategory = category.subCategories[0];
      return Promise.resolve(createMockSuggestion(category.id, subCategory.id));
    }

    if (searchDesc.includes('general')) {
      return Promise.resolve({
        categoryId: null,
        subCategoryId: null,
        confidence: 0.3,
        reasoning: 'Low confidence match'
      });
    }

    if (!description || !categories?.length || !userId) {
      return Promise.resolve({
        categoryId: null,
        subCategoryId: null,
        confidence: 0,
        reasoning: 'Missing input parameters'
      });
    }

    return Promise.resolve({
      categoryId: null,
      subCategoryId: null,
      confidence: 0.1,
      reasoning: 'No strong match found'
    });
  }),

  translateText: jest.fn().mockImplementation((text) => {
    if (translationCache.has(text)) {
      return Promise.resolve(translationCache.get(text));
    }

    const translation = mockTranslation[text] || text;
    translationCache.set(text, translation);
    return Promise.resolve(translation);
  }),

  processText: jest.fn().mockImplementation((text) => {
    if (!text) return [];
    return text.toLowerCase().split(' ').filter(t => t);
  }),

  suggestNewKeywords: jest.fn().mockImplementation(async (description) => {
    // Try translation first if it's Hebrew
    const translatedDesc = mockTranslation[description] || description;
    if (translatedDesc.toLowerCase().includes('coffee') || 
        translatedDesc.toLowerCase().includes('restaurant')) {
      return ['coffee', 'shop', 'restaurant'];
    }
    if (!description) {
      return [];
    }
    return ['restaurant', 'dining', 'food'];
  }),

  // For testing purposes
  __setMockCategories: (categories) => {
    mockCategories = categories;
  },

  __setMockTranslations: (translations) => {
    mockTranslation = { ...mockTranslation, ...translations };
  }
};
