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
    mockCategories = [{
      id: '1',
      name: 'Food',
      type: 'Expense',
      subCategories: [{
        id: '1a',
        name: 'Restaurants',
        keywords: ['restaurant', 'cafe', 'coffee shop', 'dining']
      }]
    }];
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
    });
  });

  describe('processText', () => {
    it('should tokenize and stem text correctly', () => {
      const text = 'Restaurant Food Delivery';
      const tokens = service.processText(text);
      
      expect(tokens).not.toBeNull();
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.map(t => t.toLowerCase())).toContain('food');
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
      expect(tokens.map(t => t.toLowerCase())).toEqual(['coffee', 'shop']);
    });
  });

  describe('suggestCategory', () => {
    it('should prioritize rawCategory over description', async () => {
      const suggestion = await service.suggestCategory(
        'general payment',
        -50,
        mockCategories,
        mockUserId,
        'restaurant dining'
      );

      expect(suggestion.categoryId).toBe('1');
      expect(suggestion.subCategoryId).toBe('1a');
      expect(suggestion.confidence).toBeGreaterThan(0.7); // Higher confidence due to rawCategory
      expect(suggestion.reasoning).toContain('bank-provided category');
    });

    it('should match exact keywords with high confidence', async () => {
      const description = 'coffee shop';
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
      expect(suggestion.reasoning).toContain('transaction description');
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
      const description = 'dining';
      const amount = -75;

      const suggestion = await service.suggestCategory(
        description,
        amount,
        mockCategories,
        mockUserId
      );

      expect(suggestion.confidence).toBeGreaterThan(0);
    });

    it('should return low confidence for ambiguous descriptions', async () => {
      const description = 'general payment';
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

    it('should handle mixed Hebrew rawCategory and description', async () => {
      const suggestion = await service.suggestCategory(
        'general payment',
        -75,
        mockCategories,
        mockUserId,
        'בית קפה' // coffee shop in Hebrew
      );

      expect(suggestion.categoryId).toBe('1');
      expect(suggestion.subCategoryId).toBe('1a');
      expect(suggestion.confidence).toBeGreaterThan(0.5);
      expect(suggestion.reasoning).toContain('bank-provided category');
    });

    it('should combine matching scores from description and rawCategory', async () => {
      const suggestion = await service.suggestCategory(
        'coffee meeting',
        -30,
        mockCategories,
        mockUserId,
        'restaurant dinner'
      );

      expect(suggestion.categoryId).toBe('1');
      expect(suggestion.subCategoryId).toBe('1a');
      // Both description and rawCategory contribute to high confidence
      expect(suggestion.confidence).toBeGreaterThan(0.8);
    });

    it('should generate different confidence levels in reasoning', async () => {
      const strongMatch = await service.suggestCategory(
        'coffee shop restaurant',
        -50,
        mockCategories,
        mockUserId,
        'dining out'
      );
      expect(strongMatch.reasoning).toContain('very strong confidence');

      const weakMatch = await service.suggestCategory(
        'general store',
        -25,
        mockCategories,
        mockUserId,
        'misc'
      );
      expect(weakMatch.reasoning).toContain('partial confidence');
    });

  });

  describe('suggestNewKeywords', () => {
    it('should extract relevant keywords from description', async () => {
      const description = 'Coffee Shop Restaurant';
      
      const keywords = await service.suggestNewKeywords(description);

      expect(keywords).toContain('restaurant');
      expect(keywords.length).toBeLessThanOrEqual(3);
    });

    it('should extract keywords from translated Hebrew text', async () => {
      const description = 'בית קפה';
      
      const keywords = await service.suggestNewKeywords(description);

      expect(keywords).toContain('coffee');
      expect(keywords).toContain('shop');
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
