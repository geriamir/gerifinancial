const mongoose = require('mongoose');
const { Transaction, BankAccount } = require('../../models');
const transactionService = require('../../services/transactionService');
const { TransactionType } = require('../../constants/enums');

describe('Transaction Scraping Integration', () => {
  let testBankAccount;

  beforeEach(async () => {
    testBankAccount = await BankAccount.create({
      userId: new mongoose.Types.ObjectId(),
      name: 'Test Account',
      bankId: 'leumi',
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

  it('should handle same-day transactions with different descriptions', async () => {
    const baseTransaction = {
      date: new Date('2025-01-01'),
      chargedAmount: -100,
      type: TransactionType.EXPENSE
    };

    const mockScrapedAccounts = [{
      txns: [
        { ...baseTransaction, description: 'Coffee Shop 1', identifier: 'tx1' },
        { ...baseTransaction, description: 'Coffee Shop 2', identifier: 'tx2' }
      ]
    }];

    const result = await transactionService.processScrapedTransactions(
      mockScrapedAccounts,
      testBankAccount
    );

    // Different descriptions should be saved as separate transactions
    expect(result.newTransactions).toBe(2);
    expect(result.duplicates).toBe(0);

    const savedTransactions = await Transaction.find({
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

    const savedTransactions = await Transaction.find({
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

    const savedTransactions = await Transaction.find({
      accountId: testBankAccount._id
    });
    expect(savedTransactions).toHaveLength(1);
  });

  it('should detect duplicates with matching memo', async () => {
    const baseTransaction = {
      date: new Date('2025-01-01'),
      chargedAmount: -100,
      description: 'Coffee Shop',
      rawData: { memo: 'Branch #123' },
      type: TransactionType.EXPENSE
    };

    // First scraping session
    await transactionService.processScrapedTransactions(
      [{ txns: [{ ...baseTransaction, identifier: 'tx1' }] }],
      testBankAccount
    );

    // Second session with same transaction details and memo
    const result = await transactionService.processScrapedTransactions(
      [{ txns: [{ ...baseTransaction, identifier: 'tx2' }] }],
      testBankAccount
    );

    expect(result.duplicates).toBe(1);
    expect(result.newTransactions).toBe(0);

    const savedTransactions = await Transaction.find({
      accountId: testBankAccount._id
    });
    expect(savedTransactions).toHaveLength(1);
  });

  it('should allow same description with different memos', async () => {
    const baseTransaction = {
      date: new Date('2025-01-01'),
      chargedAmount: -100,
      description: 'Coffee Shop',
      type: TransactionType.EXPENSE
    };

    const mockScrapedAccounts = [{
      txns: [
        { ...baseTransaction, rawData: { memo: 'Branch #123' }, identifier: 'tx1' },
        { ...baseTransaction, rawData: { memo: 'Branch #456' }, identifier: 'tx2' }
      ]
    }];

    const result = await transactionService.processScrapedTransactions(
      mockScrapedAccounts,
      testBankAccount
    );

    expect(result.newTransactions).toBe(2);
    expect(result.duplicates).toBe(0);

    const savedTransactions = await Transaction.find({
      accountId: testBankAccount._id
    });
    expect(savedTransactions).toHaveLength(2);
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

    const savedTransactions = await Transaction.find({
      accountId: testBankAccount._id
    });
    expect(savedTransactions).toHaveLength(2);
  });
});
