const mongoose = require('mongoose');
const transactionService = require('../transactionService');
const { Transaction, PendingTransaction, Category, SubCategory, User } = require('../../models');
const { createTestUser } = require('../../test/testUtils');
const { TransactionType, CategorizationMethod } = require('../../constants/enums');

describe('TransactionService', () => {
  let user, category, subCategory, accountId;

  beforeEach(async () => {
    const testUser = await createTestUser(User);
    user = testUser.user;
    category = await Category.create({
      name: 'Food',
      type: 'Expense',
      userId: user._id
    });
    subCategory = await SubCategory.create({
      name: 'Restaurant',
      parentCategory: category._id,
      userId: user._id
    });
    accountId = new mongoose.Types.ObjectId();
  });

  describe('processScrapedTransactions', () => {
    const mockScrapedAccounts = [{
      txns: [
        {
          identifier: 'tx1',
          date: new Date(),
          chargedAmount: -100,
          description: 'Restaurant 1',
          currency: 'ILS'
        },
        {
          identifier: 'tx2',
          date: new Date(),
          chargedAmount: -50,
          description: 'Restaurant 2',
          currency: 'ILS'
        }
      ]
    }];

    const mockBankAccount = {
      _id: new mongoose.Types.ObjectId(),
      userId: null,
      defaultCurrency: 'ILS'
    };

    beforeEach(() => {
      mockBankAccount.userId = user._id;
    });

    it('should save scraped transactions to pending store', async () => {
      const result = await transactionService.processScrapedTransactions(
        mockScrapedAccounts,
        mockBankAccount
      );

      expect(result.newTransactions).toBe(2);
      expect(result.duplicates).toBe(0);
      expect(result.errors).toHaveLength(0);

      const pendingTxs = await PendingTransaction.find({
        accountId: mockBankAccount._id
      });
      expect(pendingTxs).toHaveLength(2);
    });

    it('should handle duplicate transactions', async () => {
      // First save
      await transactionService.processScrapedTransactions(
        mockScrapedAccounts,
        mockBankAccount
      );

      // Try to save same transactions again
      const result = await transactionService.processScrapedTransactions(
        mockScrapedAccounts,
        mockBankAccount
      );

      expect(result.newTransactions).toBe(0);
      expect(result.duplicates).toBe(2);
    });

    it('should not save transaction if it exists in permanent storage', async () => {
      // Create a transaction in permanent storage
      await Transaction.create({
        identifier: 'tx1',
        userId: user._id,
        accountId: mockBankAccount._id,
        amount: -100,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Restaurant 1',
        rawData: {}
      });

      const result = await transactionService.processScrapedTransactions(
        mockScrapedAccounts,
        mockBankAccount
      );

      expect(result.newTransactions).toBe(1); // Only tx2 should be saved
      expect(result.duplicates).toBe(1);
    });
  });

  describe('getPendingTransactions', () => {
    beforeEach(async () => {
      // Create some pending transactions
      await PendingTransaction.create([
        {
          identifier: 'tx1',
          userId: user._id,
          accountId,
          amount: -100,
          currency: 'ILS',
          date: new Date(),
          type: TransactionType.EXPENSE,
          description: 'Test 1',
          rawData: {}
        },
        {
          identifier: 'tx2',
          userId: user._id,
          accountId,
          amount: -50,
          currency: 'ILS',
          date: new Date(),
          type: TransactionType.EXPENSE,
          description: 'Test 2',
          rawData: {}
        }
      ]);
    });

    it('should get pending transactions with pagination', async () => {
      const options = { limit: 1, skip: 0 };
      const transactions = await transactionService.getPendingTransactions(user._id, options);
      expect(transactions).toHaveLength(1);
    });

    it('should filter by account ID', async () => {
      const otherAccountId = new mongoose.Types.ObjectId();
      await PendingTransaction.create({
        identifier: 'tx3',
        userId: user._id,
        accountId: otherAccountId,
        amount: -75,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Test 3',
        rawData: {}
      });

      const transactions = await transactionService.getPendingTransactions(user._id, {
        accountId
      });
      expect(transactions).toHaveLength(2);
      transactions.forEach(tx => {
        expect(tx.accountId.toString()).toBe(accountId.toString());
      });
    });
  });

  describe('verifyTransactions', () => {
    let pendingTxs;

    beforeEach(async () => {
      // Create pending transactions
      const rawData = {
        vendor: 'Test Restaurant',
        description: 'Original Description',
        chargedAmount: -100,
        memo: 'Test Memo'
      };

      // Create and categorize transactions
      pendingTxs = await Promise.all([
        PendingTransaction.create({
          identifier: 'tx1',
          userId: user._id,
          accountId,
          amount: -100,
          currency: 'ILS',
          date: new Date(),
          type: TransactionType.EXPENSE,
          description: 'Test 1',
          rawData: rawData,
          category: category._id,
          subCategory: subCategory._id,
          categorizationMethod: CategorizationMethod.MANUAL,
          processedDate: new Date()
        }),
        PendingTransaction.create({
          identifier: 'tx2',
          userId: user._id,
          accountId,
          amount: -50,
          currency: 'ILS',
          date: new Date(),
          type: TransactionType.EXPENSE,
          description: 'Test 2',
          rawData: rawData,
          category: category._id,
          subCategory: subCategory._id,
          categorizationMethod: CategorizationMethod.MANUAL,
          processedDate: new Date()
        })
      ]);
    });

    it('should verify and move transactions to permanent storage', async () => {
      const result = await transactionService.verifyTransactions(
        pendingTxs.map(tx => tx._id),
        user._id
      );

      expect(result.verifiedCount).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Check transactions were moved
      const permanent = await Transaction.find({
        userId: user._id,
        accountId
      });
      expect(permanent).toHaveLength(2);

      const remaining = await PendingTransaction.find({
        userId: user._id,
        accountId
      });
      expect(remaining).toHaveLength(0);
    });

    it('should handle uncategorized transactions in batch verification', async () => {
      // Create an uncategorized pending transaction
      const uncategorizedTx = await PendingTransaction.create({
        identifier: 'tx3',
        userId: user._id,
        accountId,
        amount: -75,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Test 3',
        rawData: {}
      });

      const result = await transactionService.verifyTransactions(
        [...pendingTxs.map(tx => tx._id), uncategorizedTx._id],
        user._id
      );

      expect(result.verifiedCount).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('must be categorized before verification');
    });
  });

  describe('findSimilarPendingTransactions', () => {
    let baseTx;

    beforeEach(async () => {
      baseTx = await PendingTransaction.create({
        identifier: 'tx1',
        userId: user._id,
        accountId,
        amount: -100,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Restaurant A',
        category: category._id,
        subCategory: subCategory._id,
        rawData: {}
      });

      // Create similar transactions
      await PendingTransaction.create([
        {
          identifier: 'tx2',
          userId: user._id,
          accountId,
          amount: -95,
          currency: 'ILS',
          date: new Date(),
          type: TransactionType.EXPENSE,
          description: 'Restaurant A',
          category: category._id,
          rawData: {}
        },
        {
          identifier: 'tx3',
          userId: user._id,
          accountId,
          amount: -50,
          currency: 'ILS',
          date: new Date(),
          type: TransactionType.EXPENSE,
          description: 'Completely Different',
          category: category._id,
          rawData: {}
        }
      ]);
    });

    it('should find similar transactions based on multiple factors', async () => {
      const result = await transactionService.findSimilarPendingTransactions(
        baseTx._id,
        user._id
      );

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Restaurant A');
      expect(result.similarity).toBeGreaterThan(0.7);
    });
  });
});
