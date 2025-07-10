const mongoose = require('mongoose');
const { Transaction, Category, SubCategory, User, PendingTransaction, VendorMapping } = require('../../models');
const transactionService = require('../transactionService');
const { createTestUser } = require('../../test/testUtils');
const { TransactionType, CategorizationMethod } = require('../../constants/enums');

describe('Transaction Verification Flow', () => {
  let user;
  let category;
  let subCategory;
  let pendingTransaction;

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

    // Create test pending transaction
    pendingTransaction = await PendingTransaction.create({
      identifier: `test-${Date.now()}`,
      accountId: new mongoose.Types.ObjectId(),
      userId: user._id,
      amount: -100,
      currency: 'ILS',
      date: new Date(),
      type: TransactionType.EXPENSE,
      description: 'Test Restaurant',
      memo: 'Test Memo',
      rawData: {
        description: 'Test Restaurant',
        chargedAmount: -100
      }
    });
  });

  describe('Categorization with Verification', () => {
    it('should categorize pending transaction without immediate verification', async () => {
      await transactionService.categorizePendingTransaction(
        pendingTransaction._id,
        category._id,
        subCategory._id,
        user._id
      );

      const updated = await PendingTransaction.findById(pendingTransaction._id);
      expect(updated.category.toString()).toBe(category._id.toString());
      expect(updated.subCategory.toString()).toBe(subCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.MANUAL);
    });

    it('should move transaction to permanent storage when verifying', async () => {
      // First categorize
      await transactionService.categorizePendingTransaction(
        pendingTransaction._id,
        category._id,
        subCategory._id,
        user._id
      );

      // Then verify
      const result = await transactionService.verifyTransactions(
        [pendingTransaction._id],
        user._id
      );

      expect(result.verifiedCount).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Check it was moved to permanent storage
      const permanent = await Transaction.findOne({ identifier: pendingTransaction.identifier });
      expect(permanent).toBeTruthy();
      expect(permanent.category.toString()).toBe(category._id.toString());
      expect(permanent.subCategory.toString()).toBe(subCategory._id.toString());

      // Check it was removed from pending
      const pending = await PendingTransaction.findById(pendingTransaction._id);
      expect(pending).toBeNull();
    });
  });

  describe('Auto-categorization', () => {
    it('should use vendor mapping for new transactions', async () => {
      // Create a vendor mapping for future categorization
      await VendorMapping.findOrCreate({
        vendorName: 'Test Restaurant',
        userId: user._id,
        category: category._id,
        subCategory: subCategory._id,
        language: 'en'
      });

      // Create new pending transaction with same description
      const newPending = await PendingTransaction.create({
        identifier: `test-${Date.now()}-2`,
        accountId: new mongoose.Types.ObjectId(),
        userId: user._id,
        amount: -150,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Test Restaurant',
        memo: 'Test Memo',
        rawData: {
          description: 'Test Restaurant',
          chargedAmount: -150
        }
      });

      await transactionService.attemptAutoCategorization(newPending);

      const updated = await PendingTransaction.findById(newPending._id);
      expect(updated.category.toString()).toBe(category._id.toString());
      expect(updated.subCategory.toString()).toBe(subCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });

    it('should apply AI categorization to pending transactions', async () => {
      const newPending = await PendingTransaction.create({
        identifier: `test-${Date.now()}-3`,
        accountId: new mongoose.Types.ObjectId(),
        userId: user._id,
        amount: -80,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'New Restaurant',
        rawData: {
          description: 'New Restaurant',
          chargedAmount: -80,
          category: 'Food & Dining'
        }
      });

      await transactionService.attemptAutoCategorization(newPending);

      const updated = await PendingTransaction.findById(newPending._id);
      expect(updated.category).toBeTruthy();
      expect(updated.subCategory).toBeTruthy();
      expect(updated.categorizationMethod).toBe(CategorizationMethod.AI);
    });
  });

  describe('Vendor Mapping Integration', () => {
    it('should create vendor mapping when categorizing pending transactions', async () => {
      await transactionService.categorizePendingTransaction(
        pendingTransaction._id,
        category._id,
        subCategory._id,
        user._id
      );

      // Create new transaction with same description
      const newPending = await PendingTransaction.create({
        identifier: `test-${Date.now()}-4`,
        accountId: new mongoose.Types.ObjectId(),
        userId: user._id,
        amount: -90,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Test Restaurant',
        rawData: {
          description: 'Test Restaurant',
          chargedAmount: -90
        }
      });

      await transactionService.attemptAutoCategorization(newPending);

      const updated = await PendingTransaction.findById(newPending._id);
      expect(updated.category.toString()).toBe(category._id.toString());
      expect(updated.subCategory.toString()).toBe(subCategory._id.toString());
      expect(updated.categorizationMethod).toBe(CategorizationMethod.PREVIOUS_DATA);
    });
  });
});
