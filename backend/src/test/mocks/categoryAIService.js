let mockCategories = {};
let mockTranslation = {
  'בית קפה': 'coffee shop',
  'מסעדה': 'restaurant',
  'סופרמרקט': 'supermarket'
};

let translationCache = new Map();

const createMockSuggestion = (categoryId, subCategoryId, confidence = 0.9, fromRawCategory = false) => ({
  categoryId: categoryId?.toString() || null,
  subCategoryId: subCategoryId?.toString() || null,
  confidence,
  reasoning: confidence > 0.8 
    ? `very strong confidence match from ${fromRawCategory ? 'bank-provided category' : 'transaction description'}`
    : confidence > 0.5
      ? `moderate confidence match from ${fromRawCategory ? 'bank-provided category' : 'transaction description'}`
      : 'partial confidence match'
});

module.exports = {
  suggestCategory: jest.fn().mockImplementation((description, amount, categories, userId, rawCategory = '') => {
    if (!description || !categories?.length || !userId) {
      return Promise.resolve(createMockSuggestion(null, null, 0));
    }

    // First check raw category if provided
    if (rawCategory) {
      const translatedRaw = mockTranslation[rawCategory] || rawCategory;
      const searchRaw = translatedRaw.toLowerCase();
      
      // Check both raw category translations and specific keywords
      if (searchRaw.includes('coffee shop') || 
          searchRaw.includes('restaurant') || 
          searchRaw.includes('dining')) {
        const category = categories[0];
        const subCategory = category?.subCategories?.[0];
        if (category && subCategory) {
          return Promise.resolve(createMockSuggestion(category.id, subCategory.id, 0.95, true));
        }
      }
    }

    // Then check description
    const translatedDesc = mockTranslation[description] || description;
    const searchDesc = translatedDesc.toLowerCase();

    // Check both description translations and keywords
    if (searchDesc.includes('restaurant') || 
        searchDesc.includes('coffee shop') ||
        searchDesc.includes('dining')) {
      const category = categories[0];
      const subCategory = category?.subCategories?.[0];
      if (category && subCategory) {
        return Promise.resolve(createMockSuggestion(category.id, subCategory.id, 0.9, false));
      }
    }

    if (searchDesc.includes('general')) {
      return Promise.resolve(createMockSuggestion(null, null, 0.3, false));
    }

    return Promise.resolve(createMockSuggestion(null, null, 0.1, false));
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
