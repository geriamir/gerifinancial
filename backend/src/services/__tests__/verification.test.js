const mongoose = require('mongoose');
const { Transaction, Category, SubCategory, User } = require('../../models');
const ManualCategorized = require('../../models/ManualCategorized');
const transactionService = require('../transactionService');
const { createTestUser } = require('../../test/testUtils');
const { TransactionType, CategorizationMethod, TransactionStatus } = require('../../constants/enums');

describe('Transaction Verification Flow', () => {
  let user;
  let category;
  let subCategory;
  let testTransaction;

  beforeEach(async () => {
    // Create test user
    const testData = await createTestUser(User);
    user = testData.user;

    // Create test category and subcategory
    category = await Category.create({
      name: 'Food',
      type: 'Expense',
      userId: user._id
    });

    subCategory = await SubCategory.create({
      name: 'Restaurant',
      keywords: ['restaurant', 'cafe'],
      parentCategory: category._id,
      userId: user._id
    });

    await Category.findByIdAndUpdate(category._id, {
      $push: { subCategories: subCategory._id }
    });

    // Create test transaction
    testTransaction = await Transaction.create({
      identifier: `test-${Date.now()}`,
      accountId: new mongoose.Types.ObjectId(),
      userId: user._id,
      amount: -100,
      currency: 'ILS',
      date: new Date(),
      type: TransactionType.EXPENSE,
      description: 'Test Restaurant',
      memo: 'Test Memo',
      status: TransactionStatus.VERIFIED,
      rawData: {
        description: 'Test Restaurant',
        chargedAmount: -100
      }
    });
  });

  describe('Transaction Categorization', () => {
    it('should categorize transactions', async () => {
      await transactionService.categorizeTransaction(
        testTransaction._id,
        category._id,
        subCategory._id,
        true // saveAsManual
      );

      const updated = await Transaction.findById(testTransaction._id);
      expect(updated.category.toString()).toBe(category._id.toString());
      expect(updated.subCategory.toString()).toBe(subCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.MANUAL);
    });

    it('should save manual categorizations for future use', async () => {
      await transactionService.categorizeTransaction(
        testTransaction._id,
        category._id,
        subCategory._id,
        true // saveAsManual
      );

      // Create another transaction with same description
      const newTransaction = await Transaction.create({
        identifier: `test-${Date.now()}-2`,
        accountId: new mongoose.Types.ObjectId(),
        userId: user._id,
        amount: -150,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Test Restaurant',
        status: TransactionStatus.VERIFIED,
        rawData: {
          description: 'Test Restaurant',
          chargedAmount: -150
        }
      });

      await transactionService.attemptAutoCategorization(newTransaction);

      const updated = await Transaction.findById(newTransaction._id);
      expect(updated.category.toString()).toBe(category._id.toString());
      expect(updated.subCategory.toString()).toBe(subCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });
  });

  describe('Auto-categorization', () => {
    it('should use previous categorization for new transactions', async () => {
      // Create manual categorization entry
      await ManualCategorized.create({
        description: 'Test Restaurant',
        userId: user._id,
        category: category._id,
        subCategory: subCategory._id,
        language: 'he'
      });

      // Create new transaction with same description
      const newTransaction = await Transaction.create({
        identifier: `test-${Date.now()}-2`,
        accountId: new mongoose.Types.ObjectId(),
        userId: user._id,
        amount: -150,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Test Restaurant',
        memo: 'Test Memo',
        status: TransactionStatus.VERIFIED,
        rawData: {
          description: 'Test Restaurant',
          chargedAmount: -150
        }
      });

      await transactionService.attemptAutoCategorization(newTransaction);

      const updated = await Transaction.findById(newTransaction._id);
      expect(updated.category.toString()).toBe(category._id.toString());
      expect(updated.subCategory.toString()).toBe(subCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should apply AI categorization to transactions', async () => {
      const newTransaction = await Transaction.create({
        identifier: `test-${Date.now()}-3`,
        accountId: new mongoose.Types.ObjectId(),
        userId: user._id,
        amount: -80,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'XYZ24 Special Store',
        status: TransactionStatus.VERIFIED,
        rawData: {
          description: 'XYZ24 Special Store',
          chargedAmount: -80,
          category: 'Food & Dining'
        }
      });

      await transactionService.attemptAutoCategorization(newTransaction);

      const updated = await Transaction.findById(newTransaction._id);
      expect(updated.category).toBeTruthy();
      expect(updated.subCategory).toBeTruthy();
      expect(updated.categorizationMethod).toBe(CategorizationMethod.AI);
    });
  });

  describe('Vendor Mapping Integration', () => {
    it('should create vendor mapping when categorizing transactions', async () => {
      await transactionService.categorizeTransaction(
        testTransaction._id,
        category._id,
        subCategory._id,
        true // saveAsManual
      );

      // Create new transaction with same description
      const newTransaction = await Transaction.create({
        identifier: `test-${Date.now()}-4`,
        accountId: new mongoose.Types.ObjectId(),
        userId: user._id,
        amount: -90,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Test Restaurant',
        status: TransactionStatus.VERIFIED,
        rawData: {
          description: 'Test Restaurant',
          chargedAmount: -90
        }
      });

      await transactionService.attemptAutoCategorization(newTransaction);

      const updated = await Transaction.findById(newTransaction._id);
      expect(updated.category.toString()).toBe(category._id.toString());
      expect(updated.subCategory.toString()).toBe(subCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });
  });
});
