const mongoose = require('mongoose');
const { Transaction, BankAccount, transactionService, TransactionType } = require('../../banking');

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
