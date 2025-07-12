const mongoose = require('mongoose');
const { Transaction, BankAccount } = require('../../models');
const transactionService = require('../../services/transactionService');
const { TransactionType } = require('../../constants/enums');

describe('Transaction Deduplication', () => {
  let testBankAccount;

  beforeEach(async () => {
    testBankAccount = await BankAccount.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Test Account',
      bankId: 'leumi',  // Using a real bank enum value
      accountNumber: '123456',
      defaultCurrency: 'ILS',
      credentials: {
        username: 'testuser',
        password: 'testpass'
      }
    });
  });

  afterEach(async () => {
    await Promise.all([
      Transaction.deleteMany({}),
      BankAccount.deleteMany({})
    ]);
  });

  describe('Cross-Session Deduplication', () => {
    it('should detect duplicate by exact match (date, amount, description)', async () => {
      const transaction = {
        date: new Date('2025-01-01'),
        chargedAmount: -100,
        description: 'Coffee Shop',
        identifier: 'tx1',
        type: TransactionType.EXPENSE
      };

      // First session
      const firstResult = await transactionService.processScrapedTransactions(
        [{ txns: [transaction] }],
        testBankAccount
      );
      expect(firstResult.newTransactions).toBe(1);

      // Second session - same transaction
      const secondResult = await transactionService.processScrapedTransactions(
        [{ txns: [transaction] }],
        testBankAccount
      );
      expect(secondResult.duplicates).toBe(1);
      expect(secondResult.newTransactions).toBe(0);
    });

    it('should detect duplicate even with different identifier', async () => {
      const baseTransaction = {
        date: new Date('2025-01-01'),
        chargedAmount: -100,
        description: 'Coffee Shop',
        type: TransactionType.EXPENSE
      };

      // First session
      await transactionService.processScrapedTransactions(
        [{ txns: [{ ...baseTransaction, identifier: 'tx1' }] }],
        testBankAccount
      );

      // Second session - same transaction details but different ID
      const result = await transactionService.processScrapedTransactions(
        [{ txns: [{ ...baseTransaction, identifier: 'different-id' }] }],
        testBankAccount
      );

      expect(result.duplicates).toBe(1);
      expect(result.newTransactions).toBe(0);
    });
  });

  describe('Different Date Handling', () => {
    it('should allow same transaction details on different dates', async () => {
      const baseTransaction = {
        chargedAmount: -100,
        description: 'Coffee Shop',
        type: TransactionType.EXPENSE
      };

      const mockScrapedAccounts = [{
        txns: [
          { ...baseTransaction, date: new Date('2025-01-01'), identifier: 'tx1' },
          { ...baseTransaction, date: new Date('2025-01-02'), identifier: 'tx2' }
        ]
      }];

      const result = await transactionService.processScrapedTransactions(
        mockScrapedAccounts,
        testBankAccount
      );

      expect(result.newTransactions).toBe(2);
      expect(result.duplicates).toBe(0);

      const firstDayTransactions = await Transaction.find({
        accountId: testBankAccount._id,
        date: new Date('2025-01-01')
      });
      expect(firstDayTransactions).toHaveLength(1);

      const secondDayTransactions = await Transaction.find({
        accountId: testBankAccount._id,
        date: new Date('2025-01-02')
      });
      expect(secondDayTransactions).toHaveLength(1);
    });
  });

  describe('Session Tracking', () => {
    it('should track transactions within session using composite key', async () => {
      const transaction = {
        date: new Date('2025-01-01'),
        chargedAmount: -100,
        description: 'Coffee Shop',
        identifier: 'tx1',
        type: TransactionType.EXPENSE
      };

      const mockScrapedAccounts = [{
        txns: [transaction, { ...transaction }] // Same transaction twice in same session
      }];

      const result = await transactionService.processScrapedTransactions(
        mockScrapedAccounts,
        testBankAccount
      );

      expect(result.duplicates).toBe(1); // Second instance should be marked duplicate
      expect(result.newTransactions).toBe(1);

      const savedTransactions = await Transaction.find({
        accountId: testBankAccount._id
      });
      expect(savedTransactions).toHaveLength(1);
    });
  });
});
