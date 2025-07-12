const mongoose = require('mongoose');
const categoryMappingService = require('../categoryMappingService');
const { Category, SubCategory, Transaction } = require('../../models');
const ManualCategorized = require('../../models/ManualCategorized');
const { CategorizationMethod, TransactionType } = require('../../constants/enums');

describe('CategoryMappingService', () => {
  let testUserId;
  let testExpenseCategory;
  let testIncomeCategory;
  let testTransferCategory;
  let testExpenseSubCategory;
  let testIncomeSubCategory;
  let testTransferSubCategory;

  beforeEach(async () => {
    // Clean up before each test
    await Promise.all([
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      Transaction.deleteMany({}),
      ManualCategorized.deleteMany({})
    ]);
    
    testUserId = new mongoose.Types.ObjectId();
    
    // Create test categories for both Income and Expense
    testExpenseCategory = await Category.create({
      name: 'Test Expense Category',
      type: TransactionType.EXPENSE,
      userId: testUserId
    });

    testIncomeCategory = await Category.create({
      name: 'Test Income Category',
      type: TransactionType.INCOME,
      userId: testUserId
    });

    testTransferCategory = await Category.create({
      name: 'Test Transfer Category',
      type: TransactionType.TRANSFER,
      userId: testUserId
    });

    // Create subcategories for both types
    testExpenseSubCategory = await SubCategory.create({
      name: 'Test Expense SubCategory',
      parentCategory: testExpenseCategory._id,
      keywords: ['test', 'coffee'],
      userId: testUserId
    });

    testIncomeSubCategory = await SubCategory.create({
      name: 'Test Income SubCategory',
      parentCategory: testIncomeCategory._id,
      keywords: ['salary', 'payment'],
      userId: testUserId
    });

    testTransferSubCategory = await SubCategory.create({
      name: 'Test Transfer SubCategory',
      parentCategory: testTransferCategory._id,
      keywords: ['credit', 'card', 'transfer'],
      userId: testUserId
    });

    // Update categories with subcategory references
    testExpenseCategory.subCategories = [testExpenseSubCategory._id];
    await testExpenseCategory.save();

    testIncomeCategory.subCategories = [testIncomeSubCategory._id];
    await testIncomeCategory.save();

    testTransferCategory.subCategories = [testTransferSubCategory._id];
    await testTransferCategory.save();
  });

  afterAll(async () => {
    await Promise.all([
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      Transaction.deleteMany({}),
      ManualCategorized.deleteMany({})
    ]);
  });

  describe('attemptAutoCategorization', () => {
    it('should only use expense categories for negative amounts using manual categorization', async () => {
      // Create manual categorization entries for both income and expense
      // Create manual categorization entry with a slightly different description
      await ManualCategorized.create({
        description: 'coffee shop expense',
        userId: testUserId,
        category: testExpenseCategory._id,
        subCategory: testExpenseSubCategory._id
      });

      const transaction = await Transaction.create({
        identifier: 'test-tx-1',
        description: 'coffee shop expense',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50, // Negative amount -> Should use expense category
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: {
          originalData: 'test',
          description: 'Coffee Shop Purchase',
          chargedAmount: -50
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testExpenseCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testExpenseSubCategory._id.toString());
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use income categories for positive amounts using manual categorization', async () => {
      // Create manual categorization entries for both income and expense
      // Create manual categorization entry with a slightly different description
      await ManualCategorized.create({
        description: 'salary payment income',
        userId: testUserId,
        category: testIncomeCategory._id,
        subCategory: testIncomeSubCategory._id
      });

      const transaction = await Transaction.create({
        identifier: 'test-tx-2',
        description: 'salary payment income',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 5000, // Positive amount -> Should use income category
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.INCOME,
        rawData: {
          originalData: 'test',
          description: 'Salary Payment',
          chargedAmount: 5000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testIncomeCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testIncomeSubCategory._id.toString());
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use expense categories for negative amounts using keyword matching', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-3',
        description: 'Test Coffee Purchase',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: {
          originalData: 'test',
          description: 'Test Coffee Purchase',
          chargedAmount: -50
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testExpenseCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testExpenseSubCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use income categories for positive amounts using keyword matching', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-4',
        description: 'Monthly Salary Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 5000,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.INCOME,
        rawData: {
          originalData: 'test',
          description: 'Monthly Salary Payment',
          chargedAmount: 5000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testIncomeCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testIncomeSubCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should not override existing categorization', async () => {
      const existingCategory = await Category.create({
        name: 'Existing Category',
        type: TransactionType.EXPENSE,
        userId: testUserId
      });

      const existingSubCategory = await SubCategory.create({
        name: 'Existing SubCategory',
        parentCategory: existingCategory._id,
        userId: testUserId
      });

      const transaction = await Transaction.create({
        identifier: 'test-tx-5',
        description: 'Coffee Shop Purchase',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        category: existingCategory._id,
        subCategory: existingSubCategory._id,
        categorizationMethod: CategorizationMethod.MANUAL,
        rawData: {
          originalData: 'test',
          description: 'Coffee Shop Purchase',
          chargedAmount: -50
        }
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(existingCategory._id);
      expect(transaction.subCategory).toEqual(existingSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.MANUAL);
    });

    it('should allow transfer categories for positive amounts using keyword matching', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-6',
        description: 'Credit Card Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.TRANSFER,
        rawData: {
          originalData: 'test',
          description: 'Credit Card Transfer Payment',
          chargedAmount: 1000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should allow transfer categories for negative amounts using keyword matching', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-7',
        description: 'Credit Card Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000, // Transfer transactions must be positive
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.TRANSFER,
        rawData: {
          originalData: 'test',
          description: 'Credit Card Transfer Payment',
          chargedAmount: -1000
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      expect(updated.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updated.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should allow transfer categories using manual categorization regardless of amount', async () => {
      await ManualCategorized.create({
        description: 'bank transfer',
        userId: testUserId,
        category: testTransferCategory._id,
        subCategory: testTransferSubCategory._id
      });

      // Test with positive amount
      const positiveTransaction = await Transaction.create({
        identifier: 'test-tx-8',
        description: 'Bank Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.TRANSFER,
        rawData: {
          originalData: 'test',
          description: 'Bank Transfer Payment',
          chargedAmount: 1000
        }
      });

      const updatedPositive = await categoryMappingService.attemptAutoCategorization(positiveTransaction);
      expect(updatedPositive.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updatedPositive.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());

      // Test with negative amount
      const negativeTransaction = await Transaction.create({
        identifier: 'test-tx-9',
        description: 'Bank Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000, // Transfer transactions must be positive
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.TRANSFER,
        rawData: {
          originalData: 'test',
          description: 'Bank Transfer Payment',
          chargedAmount: -1000
        }
      });

      const updatedNegative = await categoryMappingService.attemptAutoCategorization(negativeTransaction);
      expect(updatedNegative.category._id.toString()).toBe(testTransferCategory._id.toString());
      expect(updatedNegative.subCategory._id.toString()).toBe(testTransferSubCategory._id.toString());
    });

    it('should handle transactions without matches', async () => {
      const transaction = await Transaction.create({
        identifier: 'test-tx-10',
        description: 'Unique Purchase Without Match',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        rawData: {
          originalData: 'test',
          description: 'Unique Purchase Without Match',
          chargedAmount: -50
        }
      });

      const updated = await categoryMappingService.attemptAutoCategorization(transaction);

      // Should not have category or subCategory set
      expect(updated).toBeUndefined();
    });
  });
});
