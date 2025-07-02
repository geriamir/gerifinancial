const CategoryAIService = require('../categoryAIService');

describe('CategoryAIService', () => {
  let service;
  let mockCategories;

  beforeEach(() => {
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
            keywords: ['restaurant', 'cafe', 'burger']
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

  describe('processText', () => {
    it('should tokenize and stem text correctly', () => {
      const text = 'Restaurant Food Delivery';
      const tokens = service.processText(text);
      
      expect(tokens).toContain('restaur'); // stemmed from 'restaurant'
      expect(tokens).toContain('food');
      expect(tokens).toContain('deliveri'); // stemmed from 'delivery'
    });

    it('should handle empty text', () => {
      const tokens = service.processText('');
      expect(tokens).toEqual([]);
    });
  });

  describe('suggestCategory', () => {
    it('should match exact keywords with high confidence', async () => {
      const description = 'McDonalds Restaurant';
      const amount = -50;

      const suggestion = await service.suggestCategory(
        description,
        amount,
        mockCategories
      );

      expect(suggestion.categoryId).toBe('1');
      expect(suggestion.subCategoryId).toBe('1a');
      expect(suggestion.confidence).toBeGreaterThan(0.5);
      expect(suggestion.reasoning).toContain('Restaurants');
    });

    it('should match similar words', async () => {
      const description = 'Local Dining';
      const amount = -75;

      const suggestion = await service.suggestCategory(
        description,
        amount,
        mockCategories
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
        mockCategories
      );

      expect(suggestion.confidence).toBeLessThan(0.5);
    });

    it('should handle multiple keyword matches', async () => {
      const description = 'Uber Eats Restaurant Delivery';
      const amount = -60;

      const suggestion = await service.suggestCategory(
        description,
        amount,
        mockCategories
      );

      // Should match either Restaurant or Taxi category
      expect(['1a', '2b']).toContain(suggestion.subCategoryId);
      expect(suggestion.confidence).toBeGreaterThan(0);
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
