const mockCategories = {
  '1': {
    id: '1',
    name: 'Food',
    subCategories: [{
      id: '1a',
      name: 'Restaurants'
    }]
  }
};

const mockSuggestion = {
  categoryId: '1',
  subCategoryId: '1a',
  confidence: 0.9,
  reasoning: 'Strong match for Restaurants subcategory in Food'
};

const mockAmbiguousSuggestion = {
  categoryId: 'mock-category-id',
  subCategoryId: 'mock-subcategory-id',
  confidence: 0.3,
  reasoning: 'Low confidence match'
};

const mockKeywords = ['restaurant', 'dining', 'food'];

const mockTranslation = {
  'בית קפה': 'coffee shop',
  'מסעדה': 'restaurant',
  'סופרמרקט': 'supermarket'
};

let translationCache = new Map();

module.exports = {
  suggestCategory: jest.fn().mockImplementation((description, amount, categories, userId) => {
    // First check for Hebrew text
    const translatedDesc = mockTranslation[description] || description;
    const searchDesc = translatedDesc.toLowerCase();

    if (searchDesc.includes('restaurant') || searchDesc.includes('coffee shop')) {
      return Promise.resolve(mockSuggestion);
    }
    if (searchDesc.includes('general')) {
      return Promise.resolve(mockAmbiguousSuggestion);
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
    return mockKeywords;
  })
};
