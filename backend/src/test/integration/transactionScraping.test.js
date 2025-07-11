const mongoose = require('mongoose');
const { Transaction, BankAccount, PendingTransaction } = require('../../models');
const transactionService = require('../../services/transactionService');
const { TransactionType } = require('../../constants/enums');

describe('Transaction Scraping Integration', () => {
  let testBankAccount;

  beforeEach(async () => {
    testBankAccount = await BankAccount.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Test Account',
      bankId: 'test-bank',
      accountNumber: '123456',
      defaultCurrency: 'ILS'
    });
  });

  afterEach(async () => {
    await Promise.all([
      Transaction.deleteMany({}),
      PendingTransaction.deleteMany({}),
      BankAccount.deleteMany({})
    ]);
  });

  it('should handle same-day transactions correctly', async () => {
    const baseTransaction = {
      date: new Date('2025-01-01'),
      chargedAmount: -100,
      description: 'Coffee Shop',
      type: TransactionType.EXPENSE
    };

    const mockScrapedAccounts = [{
      txns: [
        { ...baseTransaction, identifier: 'tx1' },
        { ...baseTransaction, identifier: 'tx2' } // Same details but different identifier
      ]
    }];

    const result = await transactionService.processScrapedTransactions(
      mockScrapedAccounts,
      testBankAccount
    );

    // Both transactions should be saved (not marked as duplicates)
    expect(result.newTransactions).toBe(2);
    expect(result.duplicates).toBe(0);

    const savedTransactions = await PendingTransaction.find({
      accountId: testBankAccount._id
    });
    expect(savedTransactions).toHaveLength(2);
  });

  it('should detect duplicates across scraping sessions', async () => {
    // First scraping session
    const transaction = {
      date: new Date('2025-01-01'),
      chargedAmount: -100,
      description: 'Coffee Shop',
      identifier: 'tx1',
      type: TransactionType.EXPENSE
    };

    await transactionService.processScrapedTransactions(
      [{ txns: [transaction] }],
      testBankAccount
    );

    // Second scraping session with same transaction
    const result = await transactionService.processScrapedTransactions(
      [{ txns: [transaction] }],
      testBankAccount
    );

    expect(result.duplicates).toBe(1);
    expect(result.newTransactions).toBe(0);

    const savedTransactions = await PendingTransaction.find({
      accountId: testBankAccount._id
    });
    expect(savedTransactions).toHaveLength(1); // Only one should be saved
  });

  it('should detect duplicates by date and details', async () => {
    const baseTransaction = {
      date: new Date('2025-01-01'),
      chargedAmount: -100,
      description: 'Coffee Shop',
      type: TransactionType.EXPENSE
    };

    // First scraping session
    await transactionService.processScrapedTransactions(
      [{ txns: [{ ...baseTransaction, identifier: 'tx1' }] }],
      testBankAccount
    );

    // Second session with same transaction details but different identifier
    const result = await transactionService.processScrapedTransactions(
      [{ txns: [{ ...baseTransaction, identifier: 'different-id' }] }],
      testBankAccount
    );

    expect(result.duplicates).toBe(1);
    expect(result.newTransactions).toBe(0);

    const savedTransactions = await PendingTransaction.find({
      accountId: testBankAccount._id
    });
    expect(savedTransactions).toHaveLength(1);
  });

  it('should allow same details on different dates', async () => {
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

    const savedTransactions = await PendingTransaction.find({
      accountId: testBankAccount._id
    });
    expect(savedTransactions).toHaveLength(2);
  });
});
