const mongoose = require('mongoose');
jest.mock('@vitalets/google-translate-api', () => ({
  __esModule: true,
  default: jest.fn(text => Promise.resolve({ text: text === 'בית קפה' ? 'coffee shop' : text }))
}));

describe('CategoryAIService', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  let service;
  let mockCategories;

  beforeEach(() => {
    jest.clearAllMocks();
    service = require('../categoryAIService');
    mockCategories = [
      {
        id: '1',
        name: 'Food',
        type: 'Expense',
        subCategories: [
          {
            id: '1a',
            name: 'Restaurants',
            keywords: ['restaurant', 'cafe', 'burger', 'coffee shop']
          },
          {
            id: '1b',
            name: 'Groceries',
            keywords: ['supermarket', 'market', 'food']
          }
        ]
      },
      {
        id: '2',
        name: 'Transportation',
        type: 'Expense',
        subCategories: [
          {
            id: '2a',
            name: 'Public Transit',
            keywords: ['bus', 'train', 'subway']
          },
          {
            id: '2b',
            name: 'Taxi',
            keywords: ['taxi', 'uber', 'cab']
          }
        ]
      }
    ];
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('translateText', () => {
    it('should translate Hebrew text to English', async () => {
      const result = await service.translateText('בית קפה');
      expect(result).toBe('coffee shop');
    });

    it('should handle untranslatable text', async () => {
      const text = 'already english text';
      const result = await service.translateText(text);
      expect(result).toBe(text);
    });

    it('should use cache for repeated translations', async () => {
      const text = 'בית קפה';
      
      // First call should translate
      const result1 = await service.translateText(text);
      // Second call should use cache
      const result2 = await service.translateText(text);

      expect(result1).toBe('coffee shop');
      expect(result2).toBe('coffee shop');
      // Translation should only be called once
      expect(require('@vitalets/google-translate-api').default).toHaveBeenCalledTimes(1);
    });
  });

  describe('processText', () => {
    it('should tokenize and stem text correctly', () => {
      const text = 'Restaurant Food Delivery';
      const tokens = service.processText(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens).toContain('food');
      // Just check that the words are stemmed, not the exact stemming result
      expect(tokens.some(t => t.startsWith('restaur'))).toBe(true);
      expect(tokens.some(t => t.startsWith('deliver'))).toBe(true);
    });

    it('should handle empty text', () => {
      const tokens = service.processText('');
      expect(tokens).toEqual([]);
    });

    it('should handle Hebrew text with translation', async () => {
      const text = 'בית קפה';
      const translatedText = await service.translateText(text);
      const tokens = service.processText(translatedText);
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some(t => t.includes('coffee') || t.includes('shop'))).toBe(true);
    });
  });

  describe('suggestCategory', () => {
    it('should match exact keywords with high confidence', async () => {
      const description = 'McDonalds Restaurant';
      const amount = -50;

      const suggestion = await service.suggestCategory(
        description,
        amount,
        mockCategories,
        mockUserId
      );

      expect(suggestion.categoryId).toBe('1');
      expect(suggestion.subCategoryId).toBe('1a');
      expect(suggestion.confidence).toBeGreaterThan(0.5);
      expect(suggestion.reasoning).toContain('Restaurants');
    });

    it('should match Hebrew text after translation', async () => {
      const description = 'בית קפה';
      const amount = -75;

      const suggestion = await service.suggestCategory(
        description,
        amount,
        mockCategories,
        mockUserId
      );

      expect(suggestion.categoryId).toBe('1');
      expect(suggestion.subCategoryId).toBe('1a');
      expect(suggestion.confidence).toBeGreaterThan(0.5);
    });

    it('should match similar words', async () => {
      const description = 'Local Dining';
      const amount = -75;

      const suggestion = await service.suggestCategory(
        description,
        amount,
        mockCategories,
        mockUserId
      );

      expect(suggestion.categoryId).toBe('1');
      expect(suggestion.confidence).toBeGreaterThan(0);
    });

    it('should return low confidence for ambiguous descriptions', async () => {
      const description = 'Payment';
      const amount = -100;

      const suggestion = await service.suggestCategory(
        description,
        amount,
        mockCategories,
        mockUserId
      );

      expect(suggestion.confidence).toBeLessThan(0.5);
    });

    it('should handle missing parameters', async () => {
      const suggestion = await service.suggestCategory('', 0, [], null);
      
      expect(suggestion.categoryId).toBeNull();
      expect(suggestion.subCategoryId).toBeNull();
      expect(suggestion.confidence).toBe(0);
      expect(suggestion.reasoning).toBeTruthy();
    });
  });

  describe('suggestNewKeywords', () => {
    it('should extract relevant keywords from description', async () => {
      const description = 'Monthly Subway Pass Payment';
      
      const keywords = await service.suggestNewKeywords(description);

      expect(keywords).toContain('subway');
      expect(keywords).toContain('monthly');
      expect(keywords.length).toBeLessThanOrEqual(3);
    });

    it('should extract keywords from translated Hebrew text', async () => {
      const description = 'בית קפה';
      
      const keywords = await service.suggestNewKeywords(description);

      expect(keywords.some(k => k.includes('coffee') || k.includes('shop'))).toBe(true);
      expect(keywords.length).toBeLessThanOrEqual(3);
    });

    it('should filter out common words and short tokens', async () => {
      const description = 'Payment at the Big Store';
      
      const keywords = await service.suggestNewKeywords(description);

      expect(keywords).not.toContain('at');
      expect(keywords).not.toContain('the');
      expect(keywords.every(k => k.length > 3)).toBe(true);
    });

    it('should handle empty descriptions', async () => {
      const keywords = await service.suggestNewKeywords('');
      expect(keywords).toEqual([]);
    });
  });
});
