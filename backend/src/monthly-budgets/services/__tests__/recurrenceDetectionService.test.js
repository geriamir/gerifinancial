const recurrenceDetectionService = require('../recurrenceDetectionService');
const TransactionPattern = require('../../models/TransactionPattern');
const { Transaction } = require('../../../banking');
const mongoose = require('mongoose');

// Mock the models
jest.mock('../../../banking', () => ({
  Transaction: {
    find: jest.fn()
  }
}));

jest.mock('../../models/TransactionPattern', () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  getPatternsForMonth: jest.fn()
}));

// Mock logger
jest.mock('../../../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn() // Add debug mock for the new validation functions
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

    test('should group transactions regardless of amount differences', () => {
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
          amount: -150, // 50% difference - should still be grouped
          category: { _id: 'cat1', name: 'Utilities' },
          subCategory: { _id: 'sub1', name: 'Internet' }
        },
        {
          _id: '3',
          description: 'Internet Bill',
          amount: -200, // 100% difference - should still be grouped
          category: { _id: 'cat1', name: 'Utilities' },
          subCategory: { _id: 'sub1', name: 'Internet' }
        }
      ];

      const groups = recurrenceDetectionService.groupSimilarTransactions(transactions);
      
      expect(groups).toHaveLength(1);
      expect(groups[0].transactions).toHaveLength(3); // All three should be grouped despite amount differences
      expect(groups[0].averageAmount).toBe(150); // Average of 100, 150, 200
      expect(groups[0].minAmount).toBe(100);
      expect(groups[0].maxAmount).toBe(200);
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

  describe('validateSingleTransactionPerPeriod', () => {
    test('should accept transactions with single occurrence per month', () => {
      const transactions = [
        { processedDate: new Date(2024, 0, 15) }, // Jan 2024
        { processedDate: new Date(2024, 2, 15) }, // Mar 2024
        { processedDate: new Date(2024, 4, 15) }  // May 2024
      ];
      
      const result = recurrenceDetectionService.validateSingleTransactionPerPeriod(transactions);
      expect(result).toBe(true);
    });

    test('should reject transactions with multiple occurrences in same month', () => {
      const transactions = [
        { processedDate: new Date(2024, 0, 15) }, // Jan 15, 2024
        { processedDate: new Date(2024, 0, 25) }, // Jan 25, 2024 - same month!
        { processedDate: new Date(2024, 2, 15) }  // Mar 2024
      ];
      
      const result = recurrenceDetectionService.validateSingleTransactionPerPeriod(transactions);
      expect(result).toBe(false);
    });

    test('should reject pattern with insufficient transactions', () => {
      const transactions = [
        { processedDate: new Date(2024, 0, 15) } // Only one transaction
      ];
      
      const result = recurrenceDetectionService.validateSingleTransactionPerPeriod(transactions);
      expect(result).toBe(false);
    });
  });

  describe('validateSpacingConsistency', () => {
    test('should accept consistent bi-monthly spacing', () => {
      const monthYears = ['2024-1', '2024-3', '2024-5']; // Jan, Mar, May (2-month gaps)
      
      const result = recurrenceDetectionService.validateSpacingConsistency(monthYears);
      expect(result).toBe(true);
    });

    test('should accept consistent quarterly spacing', () => {
      const monthYears = ['2024-1', '2024-4', '2024-7']; // Jan, Apr, Jul (3-month gaps)
      
      const result = recurrenceDetectionService.validateSpacingConsistency(monthYears);
      expect(result).toBe(true);
    });

    test('should accept consistent yearly spacing', () => {
      const monthYears = ['2023-1', '2024-1', '2025-1']; // Jan each year (12-month gaps)
      
      const result = recurrenceDetectionService.validateSpacingConsistency(monthYears);
      expect(result).toBe(true);
    });

    test('should reject inconsistent spacing', () => {
      const monthYears = ['2024-1', '2024-2', '2024-5']; // 1-month then 3-month gap
      
      const result = recurrenceDetectionService.validateSpacingConsistency(monthYears);
      expect(result).toBe(false);
    });

    test('should reject invalid gap patterns', () => {
      const monthYears = ['2024-1', '2024-6', '2024-11']; // 5-month gaps (not standard)
      
      const result = recurrenceDetectionService.validateSpacingConsistency(monthYears);
      expect(result).toBe(false);
    });

    test('should allow 1-month tolerance for edge cases', () => {
      const monthYears = ['2024-1', '2024-3', '2024-6']; // 2-month then 3-month gap (within tolerance)
      
      const result = recurrenceDetectionService.validateSpacingConsistency(monthYears);
      expect(result).toBe(true); // Should pass with 1-month tolerance
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

    test('should reject patterns with multiple transactions in same month', async () => {
      // Mock transaction data with multiple transactions in January
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          {
            _id: '1',
            description: 'Electric Bill',
            amount: -150,
            processedDate: new Date(2024, 0, 10), // Jan 10
            category: { _id: 'cat1', name: 'Utilities', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Electric' }
          },
          {
            _id: '2',
            description: 'Electric Bill',
            amount: -160,
            processedDate: new Date(2024, 0, 25), // Jan 25 - same month!
            category: { _id: 'cat1', name: 'Utilities', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Electric' }
          },
          {
            _id: '3',
            description: 'Electric Bill',
            amount: -155,
            processedDate: new Date(2024, 2, 15), // Mar 15
            category: { _id: 'cat1', name: 'Utilities', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Electric' }
          }
        ])
      });

      const patterns = await recurrenceDetectionService.detectPatterns('user123', 6);
      
      // Should return no patterns because of multiple transactions in January
      expect(patterns).toHaveLength(0);
    });

    test('should detect patterns with varying amounts but consistent timing', async () => {
      // Mock transaction data with different amounts but consistent bi-monthly timing
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          {
            _id: '1',
            description: 'Water Bill',
            amount: -80, // Varying amounts
            processedDate: new Date(2024, 0, 15), // Jan
            category: { _id: 'cat1', name: 'Utilities', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Water' }
          },
          {
            _id: '2',
            description: 'Water Bill',
            amount: -120, // Different amount
            processedDate: new Date(2024, 2, 15), // Mar
            category: { _id: 'cat1', name: 'Utilities', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Water' }
          },
          {
            _id: '3',
            description: 'Water Bill',
            amount: -95, // Different amount again
            processedDate: new Date(2024, 4, 15), // May
            category: { _id: 'cat1', name: 'Utilities', type: 'Expense' },
            subCategory: { _id: 'sub1', name: 'Water' }
          }
        ])
      });

      const patterns = await recurrenceDetectionService.detectPatterns('user123', 6);
      
      // Should detect the pattern despite amount variations
      expect(patterns).toHaveLength(1);
      expect(patterns[0].recurrencePattern).toBe('bi-monthly');
      expect(patterns[0].transactionIdentifier.description).toBe('water bill');
      expect(patterns[0].averageAmount).toBe(98); // Average of 80, 120, 95
      expect(patterns[0].transactionIdentifier.amountRange.min).toBe(80);
      expect(patterns[0].transactionIdentifier.amountRange.max).toBe(120);
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
