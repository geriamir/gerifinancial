const recurrenceDetectionService = require('../recurrenceDetectionService');
const { Transaction, TransactionPattern } = require('../../models');
const mongoose = require('mongoose');

// Mock the models
jest.mock('../../models', () => ({
  Transaction: {
    find: jest.fn()
  },
  TransactionPattern: {
    findOne: jest.fn(),
    save: jest.fn(),
    getPatternsForMonth: jest.fn()
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-1234')
}));

describe('RecurrenceDetectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('groupSimilarTransactions', () => {
    test('should group transactions with similar descriptions and amounts', () => {
      const transactions = [
        {
          _id: '1',
          description: 'Municipal Tax Payment',
          amount: -450,
          category: { _id: 'cat1', name: 'Tax' },
          subCategory: { _id: 'sub1', name: 'Municipal' }
        },
        {
          _id: '2',
          description: 'Municipal Tax Payment',
          amount: -450,
          category: { _id: 'cat1', name: 'Tax' },
          subCategory: { _id: 'sub1', name: 'Municipal' }
        },
        {
          _id: '3',
          description: 'Grocery Shopping',
          amount: -200,
          category: { _id: 'cat2', name: 'Food' },
          subCategory: { _id: 'sub2', name: 'Groceries' }
        }
      ];

      const groups = recurrenceDetectionService.groupSimilarTransactions(transactions);
      
      expect(groups).toHaveLength(1); // Only municipal tax group (groceries filtered out for having < 2 transactions)
      expect(groups[0].transactions).toHaveLength(2);
      expect(groups[0].commonDescription).toBe('municipal tax payment');
      expect(groups[0].averageAmount).toBe(450);
    });

    test('should handle amount tolerance correctly', () => {
      const transactions = [
        {
          _id: '1',
          description: 'Internet Bill',
          amount: -100,
          category: { _id: 'cat1', name: 'Utilities' },
          subCategory: { _id: 'sub1', name: 'Internet' }
        },
        {
          _id: '2',
          description: 'Internet Bill',
          amount: -105, // 5% difference - should be grouped
          category: { _id: 'cat1', name: 'Utilities' },
          subCategory: { _id: 'sub1', name: 'Internet' }
        },
        {
          _id: '3',
          description: 'Internet Bill',
          amount: -120, // 20% difference - should NOT be grouped
          category: { _id: 'cat1', name: 'Utilities' },
          subCategory: { _id: 'sub1', name: 'Internet' }
        }
      ];

      const groups = recurrenceDetectionService.groupSimilarTransactions(transactions);
      
      expect(groups).toHaveLength(1);
      expect(groups[0].transactions).toHaveLength(2); // Only first two should be grouped
    });
  });

  describe('isDescriptionSimilar', () => {
    test('should match exact descriptions', () => {
      const result = recurrenceDetectionService.isDescriptionSimilar(
        'Municipal Tax Payment',
        'Municipal Tax Payment'
      );
      expect(result).toBe(true);
    });

    test('should match case-insensitive descriptions', () => {
      const result = recurrenceDetectionService.isDescriptionSimilar(
        'MUNICIPAL TAX PAYMENT',
        'municipal tax payment'
      );
      expect(result).toBe(true);
    });

    test('should match partial descriptions', () => {
      const result = recurrenceDetectionService.isDescriptionSimilar(
        'Municipal Tax Payment - City Hall',
        'Municipal Tax Payment'
      );
      expect(result).toBe(true);
    });

    test('should match with word overlap', () => {
      const result = recurrenceDetectionService.isDescriptionSimilar(
        'Electric Company Bill Payment',
        'Electric Bill Monthly Payment'
      );
      expect(result).toBe(true);
    });

    test('should not match unrelated descriptions', () => {
      const result = recurrenceDetectionService.isDescriptionSimilar(
        'Municipal Tax Payment',
        'Grocery Shopping'
      );
      expect(result).toBe(false);
    });
  });

  describe('checkBiMonthlyPattern', () => {
    test('should detect valid bi-monthly pattern', () => {
      const monthOccurrences = [1, 3, 5]; // Every 2 months
      const result = recurrenceDetectionService.checkBiMonthlyPattern(monthOccurrences, 6);
      
      expect(result).toBeTruthy();
      expect(result.type).toBe('bi-monthly');
      expect(result.scheduledMonths).toEqual([1, 3, 5]);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should detect bi-monthly pattern with year boundary', () => {
      const monthOccurrences = [11, 1]; // Nov, Jan (crossing year boundary - 2 month gap)
      const result = recurrenceDetectionService.checkBiMonthlyPattern(monthOccurrences, 4);
      
      expect(result).toBeTruthy();
      expect(result.type).toBe('bi-monthly');
      expect(result.scheduledMonths).toEqual([1, 11]); // Sorted order
    });

    test('should reject irregular pattern', () => {
      const monthOccurrences = [1, 2, 5]; // Not bi-monthly spacing
      const result = recurrenceDetectionService.checkBiMonthlyPattern(monthOccurrences, 6);
      
      expect(result).toBeNull();
    });

    test('should reject pattern with wrong number of occurrences', () => {
      const monthOccurrences = [1]; // Only one occurrence
      const result = recurrenceDetectionService.checkBiMonthlyPattern(monthOccurrences, 6);
      
      expect(result).toBeNull();
    });
  });

  describe('checkQuarterlyPattern', () => {
    test('should detect valid quarterly pattern', () => {
      const monthOccurrences = [1, 4, 7]; // Every 3 months
      const result = recurrenceDetectionService.checkQuarterlyPattern(monthOccurrences, 9);
      
      expect(result).toBeTruthy();
      expect(result.type).toBe('quarterly');
      expect(result.scheduledMonths).toEqual([1, 4, 7, 10]);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('should reject non-quarterly pattern', () => {
      const monthOccurrences = [1, 3, 5]; // Bi-monthly, not quarterly
      const result = recurrenceDetectionService.checkQuarterlyPattern(monthOccurrences, 6);
      
      expect(result).toBeNull();
    });
  });

  describe('checkYearlyPattern', () => {
    test('should detect valid yearly pattern', () => {
      const transactions = [
        { processedDate: new Date(2023, 0, 15) }, // January 2023
        { processedDate: new Date(2024, 0, 20) }, // January 2024
        { processedDate: new Date(2025, 0, 10) }  // January 2025
      ];
      
      const result = recurrenceDetectionService.checkYearlyPattern(transactions);
      
      expect(result).toBeTruthy();
      expect(result.type).toBe('yearly');
      expect(result.scheduledMonths).toEqual([1]);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should reject pattern with transactions in different months', () => {
      const transactions = [
        { processedDate: new Date(2023, 0, 15) }, // January 2023
        { processedDate: new Date(2024, 1, 20) }  // February 2024
      ];
      
      const result = recurrenceDetectionService.checkYearlyPattern(transactions);
      
      expect(result).toBeNull();
    });

    test('should reject pattern with insufficient years', () => {
      const transactions = [
        { processedDate: new Date(2024, 0, 15) } // Only one year
      ];
      
      const result = recurrenceDetectionService.checkYearlyPattern(transactions);
      
      expect(result).toBeNull();
    });
  });

  describe('calculatePatternConfidence', () => {
    test('should calculate high confidence for perfect match', () => {
      const confidence = recurrenceDetectionService.calculatePatternConfidence(3, 3, true);
      expect(confidence).toBeGreaterThan(0.9);
    });

    test('should calculate lower confidence for imperfect match', () => {
      const confidence = recurrenceDetectionService.calculatePatternConfidence(2, 3, true);
      expect(confidence).toBeLessThan(0.9);
      expect(confidence).toBeGreaterThan(0.5);
    });

    test('should return 0 confidence for inconsistent pattern', () => {
      const confidence = recurrenceDetectionService.calculatePatternConfidence(3, 3, false);
      expect(confidence).toBe(0);
    });
  });

  describe('detectPatterns integration', () => {
    beforeEach(() => {
      // Mock Transaction.find to return test data
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          {
            _id: '1',
            description: 'Municipal Tax',
            amount: -450,
            processedDate: new Date(2024, 0, 15), // Jan
            category: { _id: 'cat1', name: 'Tax', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Municipal' }
          },
          {
            _id: '2',
            description: 'Municipal Tax',
            amount: -450,
            processedDate: new Date(2024, 2, 15), // Mar
            category: { _id: 'cat1', name: 'Tax', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Municipal' }
          },
          {
            _id: '3',
            description: 'Municipal Tax',
            amount: -450,
            processedDate: new Date(2024, 4, 15), // May
            category: { _id: 'cat1', name: 'Tax', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Municipal' }
          }
        ])
      });
    });

    test('should detect bi-monthly pattern in real transaction data', async () => {
      const patterns = await recurrenceDetectionService.detectPatterns('user123', 6);
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].recurrencePattern).toBe('bi-monthly');
      expect(patterns[0].transactionIdentifier.description).toBe('municipal tax');
      expect(patterns[0].averageAmount).toBe(450);
      expect(patterns[0].scheduledMonths).toEqual([1, 3, 5]);
    });

    test('should return empty array for insufficient transactions', async () => {
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          {
            _id: '1',
            description: 'Single Transaction',
            amount: -100,
            processedDate: new Date(2024, 0, 15),
            category: { _id: 'cat1', name: 'Food', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Groceries' }
          }
        ])
      });

      const patterns = await recurrenceDetectionService.detectPatterns('user123', 6);
      
      expect(patterns).toHaveLength(0);
    });
  });

  describe('storeDetectedPatterns', () => {
    test('should handle empty pattern array', async () => {
      // Test with empty array - simpler test that doesn't require complex mocking
      const result = await recurrenceDetectionService.storeDetectedPatterns([]);
      
      expect(result).toHaveLength(0);
      expect(TransactionPattern.findOne).not.toHaveBeenCalled();
    });

    test('should update existing patterns', async () => {
      const existingPattern = {
        save: jest.fn().mockResolvedValue(true),
        displayName: 'Municipal Tax (Tax → Municipal)',
        detectionData: {},
        averageAmount: 400,
        scheduledMonths: [1, 3]
      };
      
      TransactionPattern.findOne.mockResolvedValue(existingPattern);
      
      const detectedPatterns = [{
        patternId: 'test-pattern',
        userId: 'user123',
        detectionData: { confidence: 0.9 },
        averageAmount: 450,
        scheduledMonths: [1, 3, 5],
        transactionIdentifier: {
          description: 'Municipal Tax',
          categoryId: 'cat1',
          subCategoryId: 'sub1'
        }
      }];

      const result = await recurrenceDetectionService.storeDetectedPatterns(detectedPatterns);
      
      expect(existingPattern.detectionData).toEqual({ confidence: 0.9 });
      expect(existingPattern.averageAmount).toBe(450);
      expect(existingPattern.scheduledMonths).toEqual([1, 3, 5]);
      expect(existingPattern.save).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
