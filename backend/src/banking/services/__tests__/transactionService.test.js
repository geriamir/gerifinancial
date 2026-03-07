const mongoose = require('mongoose');
const transactionService = require('../transactionService');
const { User } = require('../../../auth');
const { Transaction, Category, SubCategory, ManualCategorized } = require('../../models');
const { createTestUser } = require('../../../test/testUtils');
const { TransactionType, CategorizationMethod } = require('../../constants/enums');

describe('TransactionService', () => {
  let user, category, subCategory, accountId;

  beforeEach(async () => {
    // Clean up before each test
    await Promise.all([
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      Transaction.deleteMany({}),
      ManualCategorized.deleteMany({})
    ]);

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

  afterAll(async () => {
    await Promise.all([
      Transaction.deleteMany({}),
      ManualCategorized.deleteMany({})
    ]);
  });

  describe('categorizeTransaction', () => {
    it('should save manual categorization only when requested', async () => {
      const transaction = await Transaction.create({
        identifier: 'tx1',
        userId: user._id,
        accountId,
        amount: -100,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Restaurant 1',
        rawData: {
          originalData: 'test',
          description: 'Restaurant 1',
          chargedAmount: -100
        }
      });

      // Categorize without saving as manual
      await transactionService.categorizeTransaction(
        transaction._id,
        category._id,
        subCategory._id,
        false // saveAsManual
      );

      let manualCategorizations = await ManualCategorized.find({});
      expect(manualCategorizations).toHaveLength(0);

      // Categorize and save as manual
      await transactionService.categorizeTransaction(
        transaction._id,
        category._id,
        subCategory._id,
        true // saveAsManual
      );

      manualCategorizations = await ManualCategorized.find({});
      expect(manualCategorizations).toHaveLength(1);
      expect(manualCategorizations[0].description).toBe('restaurant 1');
    });

    it('should handle transactions with memos in manual categorization', async () => {
      const transaction = await Transaction.create({
        identifier: 'tx1',
        userId: user._id,
        accountId,
        amount: -100,
        currency: 'ILS',
        date: new Date(),
        type: TransactionType.EXPENSE,
        description: 'Restaurant 1',
        memo: 'Business Lunch',
        rawData: {
          originalData: 'test',
          description: 'Restaurant 1',
          chargedAmount: -100,
          memo: 'Business Lunch'
        }
      });

      await transactionService.categorizeTransaction(
        transaction._id,
        category._id,
        subCategory._id,
        true // saveAsManual
      );

      const manualCategorizations = await ManualCategorized.find({});
      expect(manualCategorizations).toHaveLength(1);
      expect(manualCategorizations[0].description).toBe('restaurant 1');
      expect(manualCategorizations[0].memo).toBe('business lunch');
    });

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


    it('should save scraped transactions directly', async () => {
      const result = await transactionService.processScrapedTransactions(
        mockScrapedAccounts,
        mockBankAccount
      );

      expect(result.newTransactions).toBe(2);
      expect(result.duplicates).toBe(0);
      expect(result.errors).toHaveLength(0);

      const transactions = await Transaction.find({
        accountId: mockBankAccount._id
      });
      expect(transactions).toHaveLength(2);
    });

    it('should pick the latest non-future date for mostRecentTransactionDate', async () => {
      const pastDate = new Date('2026-02-15');
      const recentDate = new Date('2026-03-05');
      const futureDate = new Date('2026-04-20');

      const accounts = [{
        txns: [
          { identifier: 'past-tx', date: pastDate, chargedAmount: -100, description: 'Past expense', currency: 'ILS' },
          { identifier: 'recent-tx', date: recentDate, chargedAmount: -200, description: 'Recent expense', currency: 'ILS' },
          { identifier: 'future-tx', date: futureDate, chargedAmount: -50, description: 'Future installment', currency: 'ILS' }
        ]
      }];

      const result = await transactionService.processScrapedTransactions(accounts, mockBankAccount);

      expect(result.mostRecentTransactionDate).toEqual(recentDate);
    });

    it('should keep mostRecentTransactionDate null when all transactions are future-dated', async () => {
      const futureDate1 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const futureDate2 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const accounts = [{
        txns: [
          { identifier: 'future-tx-1', date: futureDate1, chargedAmount: -100, description: 'Future 1', currency: 'ILS' },
          { identifier: 'future-tx-2', date: futureDate2, chargedAmount: -200, description: 'Future 2', currency: 'ILS' }
        ]
      }];

      const result = await transactionService.processScrapedTransactions(accounts, mockBankAccount);

      expect(result.mostRecentTransactionDate).toBeNull();
    });
  });

});
