const smartBudgetService = require('../smartBudgetService');
const recurrenceDetectionService = require('../recurrenceDetectionService');
const TransactionPattern = require('../../models/TransactionPattern');
const Transaction = require('../../../banking/models/Transaction');
const mongoose = require('mongoose');

// Mock dependencies
jest.mock('../recurrenceDetectionService', () => ({
  detectPatterns: jest.fn(),
  storeDetectedPatterns: jest.fn()
}));
jest.mock('../../models/TransactionPattern');
jest.mock('../../../banking/models/Transaction');

describe('SmartBudgetService', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockYear = 2024;
  const mockMonth = 7;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPatternsForUser', () => {
    it('should detect patterns using recurrence detection service', async () => {
      const mockPatterns = [
        { id: '1', description: 'Netflix subscription', patternType: 'monthly' },
        { id: '2', description: 'Insurance payment', patternType: 'quarterly' }
      ];

      const mockStoredPatterns = mockPatterns.map(p => ({ ...p, _id: p.id }));

      recurrenceDetectionService.detectPatterns.mockResolvedValue(mockPatterns);
      recurrenceDetectionService.storeDetectedPatterns.mockResolvedValue(mockStoredPatterns);

      const result = await smartBudgetService.detectPatternsForUser(mockUserId, 6);

      expect(result).toEqual({
        success: true,
        patterns: mockStoredPatterns,
        totalDetected: 2,
        requiresUserApproval: true
      });

      expect(recurrenceDetectionService.detectPatterns).toHaveBeenCalledWith(mockUserId, 6);
      expect(recurrenceDetectionService.storeDetectedPatterns).toHaveBeenCalledWith(mockPatterns);
    });

    it('should handle no patterns detected', async () => {
      recurrenceDetectionService.detectPatterns.mockResolvedValue([]);

      const result = await smartBudgetService.detectPatternsForUser(mockUserId, 6);

      expect(result).toEqual({
        success: true,
        patterns: [],
        totalDetected: 0,
        requiresUserApproval: false
      });
    });

    it('should handle detection errors', async () => {
      const error = new Error('Detection failed');
      recurrenceDetectionService.detectPatterns.mockRejectedValue(error);

      await expect(smartBudgetService.detectPatternsForUser(mockUserId, 6))
        .rejects.toThrow('Detection failed');
    });
  });

  describe('checkPendingPatterns', () => {
    it('should check for pending patterns', async () => {
      const mockPendingPatterns = [
        { id: '1', description: 'Pattern 1' },
        { id: '2', description: 'Pattern 2' }
      ];

      TransactionPattern.getPendingPatterns = jest.fn().mockResolvedValue(mockPendingPatterns);

      const result = await smartBudgetService.checkPendingPatterns(mockUserId);

      expect(result).toEqual({
        hasPending: true,
        pendingCount: 2,
        patterns: mockPendingPatterns,
        message: 'You have 2 detected spending patterns awaiting your approval'
      });

      expect(TransactionPattern.getPendingPatterns).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle no pending patterns', async () => {
      TransactionPattern.getPendingPatterns = jest.fn().mockResolvedValue([]);

      const result = await smartBudgetService.checkPendingPatterns(mockUserId);

      expect(result).toEqual({
        hasPending: false,
        pendingCount: 0,
        patterns: [],
        message: 'No pending patterns - ready for budget calculation'
      });
    });
  });

  describe('calculateSmartBudget', () => {
    beforeEach(() => {
      // Mock TransactionPattern methods
      TransactionPattern.getPendingPatterns = jest.fn().mockResolvedValue([]);
      TransactionPattern.getActivePatterns = jest.fn().mockResolvedValue([]);
      
      // Mock Transaction.find
      Transaction.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
    });

    it('should throw error if pending patterns exist', async () => {
      const mockPendingPatterns = [{ id: '1', description: 'Pending pattern' }];
      TransactionPattern.getPendingPatterns = jest.fn().mockResolvedValue(mockPendingPatterns);

      await expect(smartBudgetService.calculateSmartBudget(mockUserId, mockYear, mockMonth, 6))
        .rejects.toThrow('Cannot calculate budget with 1 pending patterns');
    });

    it('should calculate budget with no patterns', async () => {
      const result = await smartBudgetService.calculateSmartBudget(mockUserId, mockYear, mockMonth, 6);

      expect(result.success).toBe(true);
      expect(result.budget).toBeDefined();
      expect(result.calculation).toBeDefined();
      expect(result.patterns).toBeDefined();
    });

    it('should calculate budget with approved patterns', async () => {
      const mockApprovedPatterns = [
        {
          _id: 'pattern1',
          displayName: 'Netflix Subscription',
          recurrencePattern: 'monthly',
          averageAmount: 50,
          scheduledMonths: [7],
          transactionIdentifier: {
            categoryId: 'cat1',
            subCategoryId: 'sub1'
          },
          matchesTransaction: jest.fn().mockReturnValue(false)
        }
      ];

      TransactionPattern.getActivePatterns = jest.fn().mockResolvedValue(mockApprovedPatterns);

      const result = await smartBudgetService.calculateSmartBudget(mockUserId, mockYear, mockMonth, 6);

      expect(result.success).toBe(true);
      expect(result.patterns.approved).toHaveLength(1);
      expect(result.patterns.approved[0].description).toBe('Netflix Subscription');
    });
  });

  describe('separateRecurringTransactions', () => {
    it('should separate recurring from non-recurring transactions', () => {
      const mockTransactions = [
        { id: '1', description: 'Netflix payment', amount: -50 },
        { id: '2', description: 'Grocery shopping', amount: -100 },
        { id: '3', description: 'Insurance payment', amount: -200 }
      ];

      const mockPatterns = [
        {
          matchesTransaction: jest.fn((transaction) => 
            transaction.description.includes('Netflix')
          )
        },
        {
          matchesTransaction: jest.fn((transaction) => 
            transaction.description.includes('Insurance')
          )
        }
      ];

      const result = smartBudgetService.separateRecurringTransactions(mockTransactions, mockPatterns);

      expect(result.recurringTransactions).toHaveLength(2);
      expect(result.nonRecurringTransactions).toHaveLength(1);
      expect(result.nonRecurringTransactions[0].description).toBe('Grocery shopping');
    });
  });

  describe('shouldPatternOccurInMonth', () => {
    it('should return true for explicitly scheduled months', () => {
      const pattern = {
        scheduledMonths: [3, 6, 9, 12],
        recurrencePattern: 'quarterly'
      };

      const result = smartBudgetService.shouldPatternOccurInMonth(pattern, 6);
      expect(result).toBe(true);
    });

    it('should return false for non-scheduled months', () => {
      const pattern = {
        scheduledMonths: [3, 6, 9, 12],
        recurrencePattern: 'quarterly'
      };

      const result = smartBudgetService.shouldPatternOccurInMonth(pattern, 5);
      expect(result).toBe(false);
    });
  });

  describe('calculateFutureOccurrences', () => {
    it('should calculate bi-monthly pattern correctly', () => {
      const pattern = {
        recurrencePattern: 'bi-monthly',
        scheduledMonths: [2, 4, 6]
      };

      // Month 8 should match (2+6=8)
      const result = smartBudgetService.calculateFutureOccurrences(pattern, 8);
      expect(result).toBe(true);

      // Month 7 should not match
      const result2 = smartBudgetService.calculateFutureOccurrences(pattern, 7);
      expect(result2).toBe(false);
    });

    it('should calculate quarterly pattern correctly', () => {
      const pattern = {
        recurrencePattern: 'quarterly',
        scheduledMonths: [3, 6, 9]
      };

      // Month 12 should match (3+9=12)
      const result = smartBudgetService.calculateFutureOccurrences(pattern, 12);
      expect(result).toBe(true);

      // Month 10 should not match
      const result2 = smartBudgetService.calculateFutureOccurrences(pattern, 10);
      expect(result2).toBe(false);
    });

    it('should calculate yearly pattern correctly', () => {
      const pattern = {
        recurrencePattern: 'yearly',
        scheduledMonths: [6]
      };

      // Should match month 6
      const result = smartBudgetService.calculateFutureOccurrences(pattern, 6);
      expect(result).toBe(true);

      // Should not match other months
      const result2 = smartBudgetService.calculateFutureOccurrences(pattern, 7);
      expect(result2).toBe(false);
    });
  });

  describe('executeSmartBudgetWorkflow', () => {
    it('should return pattern approval required when pending patterns exist', async () => {
      const mockPendingPatterns = [{ id: '1', description: 'Pending pattern' }];
      TransactionPattern.getPendingPatterns = jest.fn().mockResolvedValue(mockPendingPatterns);

      const result = await smartBudgetService.executeSmartBudgetWorkflow(mockUserId, mockYear, mockMonth, 6);

      expect(result).toEqual({
        step: 'pattern-approval-required',
        success: false,
        message: 'Found 1 spending patterns that need your approval before calculating budget',
        pendingPatterns: mockPendingPatterns,
        nextAction: 'approve-patterns'
      });
    });

    it('should calculate budget when no pending patterns', async () => {
      // Mock no pending patterns
      TransactionPattern.getPendingPatterns = jest.fn().mockResolvedValue([]);
      TransactionPattern.getActivePatterns = jest.fn().mockResolvedValue([]);
      TransactionPattern.find = jest.fn().mockResolvedValue([]); // Fix this mock
      Transaction.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      
      // Mock the detection service calls for the workflow
      recurrenceDetectionService.detectPatterns.mockResolvedValue([]);
      recurrenceDetectionService.storeDetectedPatterns.mockResolvedValue([]);

      const result = await smartBudgetService.executeSmartBudgetWorkflow(mockUserId, mockYear, mockMonth, 6);

      expect(result.step).toBe('budget-calculated');
      expect(result.success).toBe(true);
      expect(result.budget).toBeDefined();
    });
  });

  describe('groupTransactionsByCategory', () => {
    it('should group transactions by category and subcategory', () => {
      const transactions = [
        {
          category: { _id: 'cat1' },
          subCategory: { _id: 'sub1' },
          amount: -100
        },
        {
          category: { _id: 'cat1' },
          subCategory: { _id: 'sub2' },
          amount: -50
        },
        {
          category: { _id: 'cat2' },
          subCategory: { _id: 'sub1' },
          amount: -75
        }
      ];

      const result = smartBudgetService.groupTransactionsByCategory(transactions);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['cat1|sub1']).toHaveLength(1);
      expect(result['cat1|sub2']).toHaveLength(1);
      expect(result['cat2|sub1']).toHaveLength(1);
    });

    it('should handle missing category/subcategory', () => {
      const transactions = [
        {
          category: null,
          subCategory: null,
          amount: -100
        }
      ];

      const result = smartBudgetService.groupTransactionsByCategory(transactions);

      expect(result['unknown|general']).toHaveLength(1);
    });
  });

  describe('mergeBudgetComponents', () => {
    it('should merge expense budgets with recurring budgets', () => {
      const expenseBudgets = [
        {
          categoryId: 'cat1',
          subCategoryId: 'sub1',
          budgetedAmount: 100,
          source: 'non-recurring-average'
        }
      ];

      const recurringBudgets = [
        {
          categoryId: 'cat1',
          subCategoryId: 'sub1',
          budgetedAmount: 50,
          source: 'recurring-pattern',
          patternId: 'pattern1',
          patternType: 'monthly'
        }
      ];

      const result = smartBudgetService.mergeBudgetComponents(expenseBudgets, recurringBudgets);

      expect(result).toHaveLength(1);
      expect(result[0].budgetedAmount).toBe(150); // 100 + 50
      expect(result[0].source).toBe('combined-average-and-pattern');
      expect(result[0].patternInfo).toBeDefined();
    });

    it('should add new recurring budgets that dont exist in expense budgets', () => {
      const expenseBudgets = [
        {
          categoryId: 'cat1',
          subCategoryId: 'sub1',
          budgetedAmount: 100,
          source: 'non-recurring-average'
        }
      ];

      const recurringBudgets = [
        {
          categoryId: 'cat2',
          subCategoryId: 'sub2',
          budgetedAmount: 50,
          source: 'recurring-pattern',
          patternId: 'pattern1',
          patternType: 'monthly'
        }
      ];

      const result = smartBudgetService.mergeBudgetComponents(expenseBudgets, recurringBudgets);

      expect(result).toHaveLength(2);
      expect(result[0].categoryId).toBe('cat1');
      expect(result[1].categoryId).toBe('cat2');
    });
  });
});
