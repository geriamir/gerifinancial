const mongoose = require('mongoose');
const categoryMappingService = require('../categoryMappingService');
const { Category, SubCategory, PendingTransaction, VendorMapping } = require('../../models');
const { CategorizationMethod } = require('../../constants/enums');

describe('CategoryMappingService', () => {
  let testUserId;
  let testExpenseCategory;
  let testIncomeCategory;
  let testTransferCategory;
  let testExpenseSubCategory;
  let testIncomeSubCategory;
  let testTransferSubCategory;

  beforeEach(async () => {
    testUserId = new mongoose.Types.ObjectId();
    
    // Create test categories for both Income and Expense
    testExpenseCategory = await Category.create({
      name: 'Test Expense Category',
      type: 'Expense',
      userId: testUserId
    });

    testIncomeCategory = await Category.create({
      name: 'Test Income Category',
      type: 'Income',
      userId: testUserId
    });

    testTransferCategory = await Category.create({
      name: 'Test Transfer Category',
      type: 'Transfer',
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

  afterEach(async () => {
    await Promise.all([
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      PendingTransaction.deleteMany({}),
      VendorMapping.deleteMany({})
    ]);
  });

  describe('attemptAutoCategorization', () => {
    it('should only use expense categories for negative amounts using vendor mapping', async () => {
      // Create vendor mapping for both income and expense
      await Promise.all([
        VendorMapping.create({
          vendorName: 'coffee shop',
          userId: testUserId,
          category: testExpenseCategory._id,
          subCategory: testExpenseSubCategory._id
        }),
        VendorMapping.create({
          vendorName: 'coffee shop',
          userId: testUserId,
          category: testIncomeCategory._id,
          subCategory: testIncomeSubCategory._id
        })
      ]);

      const transaction = new PendingTransaction({
        description: 'Coffee Shop Purchase',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50, // Negative amount -> Should use expense category
        currency: 'ILS',
        date: new Date(),
        type: 'Expense'
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(testExpenseCategory._id);
      expect(transaction.subCategory).toEqual(testExpenseSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use income categories for positive amounts using vendor mapping', async () => {
      // Create vendor mapping for both income and expense
      await Promise.all([
        VendorMapping.create({
          vendorName: 'salary payment',
          userId: testUserId,
          category: testExpenseCategory._id,
          subCategory: testExpenseSubCategory._id
        }),
        VendorMapping.create({
          vendorName: 'salary payment',
          userId: testUserId,
          category: testIncomeCategory._id,
          subCategory: testIncomeSubCategory._id
        })
      ]);

      const transaction = new PendingTransaction({
        description: 'Salary Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 5000, // Positive amount -> Should use income category
        currency: 'ILS',
        date: new Date(),
        type: 'Income'
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(testIncomeCategory._id);
      expect(transaction.subCategory).toEqual(testIncomeSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use expense categories for negative amounts using keyword matching', async () => {
      const transaction = new PendingTransaction({
        description: 'Test Coffee Purchase',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: 'Expense'
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(testExpenseCategory._id);
      expect(transaction.subCategory).toEqual(testExpenseSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should only use income categories for positive amounts using keyword matching', async () => {
      const transaction = new PendingTransaction({
        description: 'Monthly Salary Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 5000,
        currency: 'ILS',
        date: new Date(),
        type: 'Income'
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(testIncomeCategory._id);
      expect(transaction.subCategory).toEqual(testIncomeSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should not override existing categorization', async () => {
      const existingCategory = await Category.create({
        name: 'Existing Category',
        type: 'Expense',
        userId: testUserId
      });

      const existingSubCategory = await SubCategory.create({
        name: 'Existing SubCategory',
        parentCategory: existingCategory._id,
        userId: testUserId
      });

      const transaction = new PendingTransaction({
        description: 'Coffee Shop Purchase',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: 'Expense',
        category: existingCategory._id,
        subCategory: existingSubCategory._id,
        categorizationMethod: CategorizationMethod.MANUAL
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(existingCategory._id);
      expect(transaction.subCategory).toEqual(existingSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.MANUAL);
    });

    it('should allow transfer categories for positive amounts using keyword matching', async () => {
      const transaction = new PendingTransaction({
        description: 'Credit Card Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000,
        currency: 'ILS',
        date: new Date(),
        type: 'Transfer'
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(testTransferCategory._id);
      expect(transaction.subCategory).toEqual(testTransferSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should allow transfer categories for negative amounts using keyword matching', async () => {
      const transaction = new PendingTransaction({
        description: 'Credit Card Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -1000,
        currency: 'ILS',
        date: new Date(),
        type: 'Transfer'
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      expect(transaction.category).toEqual(testTransferCategory._id);
      expect(transaction.subCategory).toEqual(testTransferSubCategory._id);
      expect(transaction.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should allow transfer categories using vendor mapping regardless of amount', async () => {
      await VendorMapping.create({
        vendorName: 'bank transfer',
        userId: testUserId,
        category: testTransferCategory._id,
        subCategory: testTransferSubCategory._id
      });

      // Test with positive amount
      const positiveTransaction = new PendingTransaction({
        description: 'Bank Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000,
        currency: 'ILS',
        date: new Date(),
        type: 'Transfer'
      });

      await categoryMappingService.attemptAutoCategorization(positiveTransaction);
      expect(positiveTransaction.category).toEqual(testTransferCategory._id);
      expect(positiveTransaction.subCategory).toEqual(testTransferSubCategory._id);

      // Test with negative amount
      const negativeTransaction = new PendingTransaction({
        description: 'Bank Transfer Payment',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -1000,
        currency: 'ILS',
        date: new Date(),
        type: 'Transfer'
      });

      await categoryMappingService.attemptAutoCategorization(negativeTransaction);
      expect(negativeTransaction.category).toEqual(testTransferCategory._id);
      expect(negativeTransaction.subCategory).toEqual(testTransferSubCategory._id);
    });

    it('should handle transactions without matches', async () => {
      const transaction = new PendingTransaction({
        description: 'Unique Purchase Without Match',
        userId: testUserId,
        accountId: new mongoose.Types.ObjectId(),
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: 'Expense'
      });

      await categoryMappingService.attemptAutoCategorization(transaction);

      // Should not have category or subCategory set
      expect(transaction.category).toBeUndefined();
      expect(transaction.subCategory).toBeUndefined();
    });
  });
});
