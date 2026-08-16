const mongoose = require('mongoose');
const transactionService = require('../transactionService');
const transactionCategorizationService = require('../transactionCategorizationService');
const { User } = require('../../../auth');
const { Transaction, CreditCard, Category, SubCategory, ManualCategorized } = require('../../models');
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
      CreditCard.deleteMany({}),
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
      const DAY_MS = 24 * 60 * 60 * 1000;
      const pastDate = new Date(Date.now() - 60 * DAY_MS);
      const recentDate = new Date(Date.now() - 10 * DAY_MS);
      const futureDate = new Date(Date.now() + 30 * DAY_MS);

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

    it('should not advance mostRecentTransactionDate from pending transactions', async () => {
      const completedDate = new Date('2026-02-15');
      const pendingDate = new Date('2026-03-10');

      const accounts = [{
        txns: [
          { identifier: 'completed-tx', date: completedDate, chargedAmount: -100, description: 'Completed purchase', currency: 'ILS', status: 'completed' },
          { identifier: 'pending-tx', date: pendingDate, chargedAmount: -200, description: 'Pending purchase', currency: 'ILS', status: 'pending' }
        ]
      }];

      const result = await transactionService.processScrapedTransactions(accounts, mockBankAccount);

      expect(result.mostRecentTransactionDate).toEqual(completedDate);
      expect(result.skippedPending).toBe(1);
      expect(result.newTransactions).toBe(1);
    });

    it('stores statement totals returned for a credit card account', async () => {
      const bankAccount = {
        _id: new mongoose.Types.ObjectId(),
        userId: user._id,
        bankId: 'visaCal',
        defaultCurrency: 'ILS'
      };
      const accounts = [{
        accountNumber: '1234',
        statements: [{
          date: '2026-08-10T00:00:00.000Z',
          amount: -34208.45,
          currency: '₪',
          transactionAmount: -31131.79
        }],
        txns: []
      }];

      await transactionService.processScrapedTransactions(accounts, bankAccount);
      accounts[0].statements[0].transactionAmount = -32000;
      await transactionService.processScrapedTransactions(accounts, bankAccount);

      const creditCard = await CreditCard.findOne({ bankAccountId: bankAccount._id });
      expect(creditCard.statements).toHaveLength(1);
      expect(creditCard.statements[0]).toEqual(expect.objectContaining({
        amount: -34208.45,
        currency: '₪',
        transactionAmount: -32000
      }));
    });

    // The queue is fed only by newly-saved transactions, so a backlog the AI
    // budget cut off on an earlier run would never be looked at again. A scrape
    // is when the allowance has rolled over and the work is already batched.
    describe('picking up what an earlier run could not afford', () => {
      // Spies here replace a service the whole file uses; clearMocks only
      // clears the calls, so without this they would still be in place for
      // every test after these.
      afterEach(() => jest.restoreAllMocks());

      const owed = (description) =>
        Transaction.create({
          identifier: `owed-${Math.random()}`,
          userId: user._id,
          accountId: mockBankAccount._id,
          amount: -75,
          currency: 'ILS',
          date: new Date('2026-01-15'),
          type: TransactionType.EXPENSE,
          description,
          awaitingModelCategorization: true,
          rawData: { description, chargedAmount: -75 }
        });

      it('queues the backlog alongside the new transactions', async () => {
        const waiting = await owed('Waiting Shop');
        const enqueue = jest.spyOn(transactionCategorizationService, 'enqueue').mockResolvedValue('job-1');

        await transactionService.processScrapedTransactions(mockScrapedAccounts, mockBankAccount);

        expect(enqueue).toHaveBeenCalledTimes(1);
        const [, ids] = enqueue.mock.calls[0];
        expect(ids.map(String)).toContain(String(waiting._id));
        expect(ids).toHaveLength(3);
      });

      // A user whose scrape turns up nothing new still has a backlog to work
      // off, and this is the only thing that ever comes back for it.
      it('queues the backlog even when the scrape found nothing new', async () => {
        const waiting = await owed('Waiting Shop');
        const enqueue = jest.spyOn(transactionCategorizationService, 'enqueue').mockResolvedValue('job-1');

        const result = await transactionService.processScrapedTransactions([{ txns: [] }], mockBankAccount);

        expect(result.newTransactions).toBe(0);
        expect(enqueue).toHaveBeenCalledWith(user._id, [waiting._id]);
      });

      it('queues nothing when there is neither new work nor a backlog', async () => {
        const enqueue = jest.spyOn(transactionCategorizationService, 'enqueue').mockResolvedValue('job-1');

        await transactionService.processScrapedTransactions([{ txns: [] }], mockBankAccount);

        expect(enqueue).not.toHaveBeenCalled();
      });
    });
  });

  describe('findPotentialDuplicate - uniqueId', () => {
    it('should detect duplicate by uniqueId', async () => {
      await Transaction.create({
        identifier: 'tx-uid-1',
        uniqueId: 'abc123hash',
        userId: user._id,
        accountId,
        amount: -100,
        currency: 'ILS',
        date: new Date('2026-03-01'),
        type: TransactionType.EXPENSE,
        description: 'Test Transaction',
        rawData: { description: 'Test Transaction', chargedAmount: -100 }
      });

      const duplicate = await transactionService.findPotentialDuplicate({
        accountId,
        userId: user._id,
        date: new Date('2026-03-01'),
        amount: -100,
        description: 'Test Transaction',
        uniqueId: 'abc123hash'
      });

      expect(duplicate).not.toBeNull();
      expect(duplicate.identifier).toBe('tx-uid-1');
    });

    it('should not match uniqueId across different accounts', async () => {
      const otherAccountId = new mongoose.Types.ObjectId();

      await Transaction.create({
        identifier: 'tx-uid-2',
        uniqueId: 'samehash999',
        userId: user._id,
        accountId: otherAccountId,
        amount: -100,
        currency: 'ILS',
        date: new Date('2026-03-01'),
        type: TransactionType.EXPENSE,
        description: 'Test Transaction',
        rawData: { description: 'Test Transaction', chargedAmount: -100 }
      });

      const duplicate = await transactionService.findPotentialDuplicate({
        accountId,
        userId: user._id,
        date: new Date('2026-03-01'),
        amount: -100,
        description: 'Test Transaction',
        uniqueId: 'samehash999'
      });

      expect(duplicate).toBeNull();
    });

    it('should backfill uniqueId when matched via fallback', async () => {
      const existing = await Transaction.create({
        identifier: 'tx-no-uid',
        userId: user._id,
        accountId,
        amount: -200,
        currency: 'ILS',
        date: new Date('2026-03-05'),
        type: TransactionType.EXPENSE,
        description: 'Grocery Store',
        rawData: { description: 'Grocery Store', chargedAmount: -200 }
      });

      expect(existing.uniqueId).toBeUndefined();

      const duplicate = await transactionService.findPotentialDuplicate({
        accountId,
        userId: user._id,
        date: new Date('2026-03-05'),
        amount: -200,
        description: 'Grocery Store',
        uniqueId: 'newhash456'
      });

      expect(duplicate).not.toBeNull();
      expect(duplicate._id.toString()).toBe(existing._id.toString());

      // Verify uniqueId was backfilled in the database
      const updated = await Transaction.findById(existing._id);
      expect(updated.uniqueId).toBe('newhash456');
    });

    it('should not overwrite existing uniqueId on fallback match', async () => {
      await Transaction.create({
        identifier: 'tx-has-uid',
        uniqueId: 'originalhash',
        userId: user._id,
        accountId,
        amount: -300,
        currency: 'ILS',
        date: new Date('2026-03-10'),
        type: TransactionType.EXPENSE,
        description: 'Electronics Store',
        rawData: { description: 'Electronics Store', chargedAmount: -300 }
      });

      const duplicate = await transactionService.findPotentialDuplicate({
        accountId,
        userId: user._id,
        date: new Date('2026-03-10'),
        amount: -300,
        description: 'Electronics Store',
        uniqueId: 'differenthash'
      });

      // Should NOT match by uniqueId (different hash), but SHOULD match by fallback
      expect(duplicate).not.toBeNull();

      // Original uniqueId should NOT be overwritten
      const updated = await Transaction.findById(duplicate._id);
      expect(updated.uniqueId).toBe('originalhash');
    });
  });

  describe('processScrapedTransactions - uniqueId dedup', () => {
    const mockBankAccount2 = {
      _id: new mongoose.Types.ObjectId(),
      userId: null,
      defaultCurrency: 'ILS'
    };

    beforeEach(() => {
      mockBankAccount2.userId = user._id;
    });

    it('should skip duplicates when scraped transactions share the same uniqueId as existing', async () => {
      // Pre-existing transaction with uniqueId
      await Transaction.create({
        identifier: 'existing-tx',
        uniqueId: 'deduphash1',
        userId: user._id,
        accountId: mockBankAccount2._id,
        amount: -150,
        currency: 'ILS',
        date: new Date('2026-03-01'),
        type: TransactionType.EXPENSE,
        description: 'Coffee Shop',
        rawData: { description: 'Coffee Shop', chargedAmount: -150 }
      });

      const accounts = [{
        txns: [
          {
            identifier: 'existing-tx',
            uniqueId: 'deduphash1',
            date: new Date('2026-03-01'),
            chargedAmount: -150,
            description: 'Coffee Shop',
            currency: 'ILS'
          },
          {
            identifier: 'new-tx',
            uniqueId: 'deduphash2',
            date: new Date('2026-03-02'),
            chargedAmount: -75,
            description: 'Bookstore',
            currency: 'ILS'
          }
        ]
      }];

      const result = await transactionService.processScrapedTransactions(accounts, mockBankAccount2);

      expect(result.duplicates).toBe(1);
      expect(result.newTransactions).toBe(1);

      const allTxns = await Transaction.find({ accountId: mockBankAccount2._id });
      expect(allTxns).toHaveLength(2);
    });

    it('should store uniqueId on newly created transactions', async () => {
      const accounts = [{
        txns: [
          {
            identifier: 'brand-new-tx',
            uniqueId: 'freshhash99',
            date: new Date('2026-03-15'),
            chargedAmount: -50,
            description: 'New Store',
            currency: 'ILS'
          }
        ]
      }];

      await transactionService.processScrapedTransactions(accounts, mockBankAccount2);

      const saved = await Transaction.findOne({ accountId: mockBankAccount2._id, identifier: 'brand-new-tx' });
      expect(saved).not.toBeNull();
      expect(saved.uniqueId).toBe('freshhash99');
    });
  });

});
