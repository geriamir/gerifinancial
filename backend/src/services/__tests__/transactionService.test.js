const mongoose = require('mongoose');
const { Transaction, Category, SubCategory } = require('../../models');
const transactionService = require('../transactionService');
const { createTestUser } = require('../../test/testUtils');
const { User, BankAccount } = require('../../models');

describe('TransactionService', () => {
  let user;
  let bankAccount;
  let transactions = [];

  beforeEach(async () => {
    // Create test user
    const testData = await createTestUser(User);
    user = testData.user;

    // Create test bank account
    bankAccount = await BankAccount.create({
      userId: user._id,
      bankId: 'hapoalim',
      name: 'Test Account',
      credentials: {
        username: 'testuser',
        password: 'bankpass123'
      }
    });

    // Create test transactions with different dates and types
    const dates = [
      new Date('2025-06-01'),
      new Date('2025-06-15'),
      new Date('2025-06-30')
    ];

    for (let i = 0; i < 25; i++) {
      const type = i % 2 === 0 ? 'Expense' : 'Income';
      const amount = type === 'Expense' ? -(50 + i) : (50 + i);
      const tx = await Transaction.create({
        identifier: `test-transaction-${i + 1}`,
        accountId: bankAccount._id,
        userId: user._id,  // Add required userId
        amount: amount,    // Make amount match type
        currency: 'ILS',
        date: dates[i % 3],
        type: type,
        description: `Test Transaction ${i + 1}`,
        rawData: { originalData: `test-${i + 1}` }
      });
      transactions.push(tx);
    }
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const result = await transactionService.getTransactions({
        limit: 10,
        skip: 0,
        userId: user._id  // Add required userId
      });

      expect(result.transactions).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
    });

    it('should filter by date range', async () => {
      const result = await transactionService.getTransactions({
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        userId: user._id  // Add required userId
      });

      expect(result.transactions.every(t => 
        t.date >= new Date('2025-06-01') &&
        t.date <= new Date('2025-06-15')
      )).toBe(true);
    });

    it('should filter by type', async () => {
      const result = await transactionService.getTransactions({
        type: 'Expense',
        userId: user._id  // Add required userId
      });

      expect(result.transactions.every(t => t.type === 'Expense')).toBe(true);
    });

    it('should filter by account', async () => {
      const result = await transactionService.getTransactions({
        accountId: bankAccount._id,
        userId: user._id  // Add required userId
      });

      expect(result.transactions.every(t => 
        t.accountId.toString() === bankAccount._id.toString()
      )).toBe(true);
    });

    it('should search by description', async () => {
      const result = await transactionService.getTransactions({
        search: 'Transaction 1',
        userId: user._id  // Add required userId
      });

      expect(result.transactions.every(t => 
        t.description.includes('Transaction 1')
      )).toBe(true);
    });

    it('should handle multiple filters combined', async () => {
      const result = await transactionService.getTransactions({
        type: 'Expense',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        limit: 5,
        userId: user._id  // Add required userId
      });

      expect(result.transactions).toHaveLength(5);
      expect(result.transactions.every(t => t.type === 'Expense')).toBe(true);
      expect(result.transactions.every(t => 
        t.date >= new Date('2025-06-01') &&
        t.date <= new Date('2025-06-15')
      )).toBe(true);
    });
  });

  describe('createFromScraperData', () => {
    it('should generate unique identifier when none provided', async () => {
      const scraperData = {
        chargedAmount: -75,  // Negative amount will make it an Expense
        date: new Date(),
        description: 'Auto ID Test'
      };

      const transaction = await Transaction.createFromScraperData(
        scraperData,
        bankAccount._id,
        'ILS',
        user._id  // Add required userId
      );

      expect(transaction.identifier).toBeTruthy();
      expect(typeof transaction.identifier).toBe('string');
      expect(transaction.identifier.includes(bankAccount._id.toString())).toBe(true);
    });

    it('should use provided identifier', async () => {
      const providedId = 'test-provided-id';
      const transaction = await Transaction.createFromScraperData(
        {
          identifier: providedId,
          chargedAmount: -75,  // Negative amount will make it an Expense
          date: new Date(),
          description: 'Provided ID Test'
        },
        bankAccount._id,
        'ILS',
        user._id  // Add required userId
      );

      expect(transaction.identifier).toBe(providedId);
    });

    it('should generate different identifiers for similar transactions', async () => {
      const date = new Date();
      const description = 'Similar Transaction';
      const amount = -100;

      const transaction1 = await Transaction.createFromScraperData(
        {
          chargedAmount: amount,  // Already negative from the test setup
          date,
          description
        },
        bankAccount._id,
        'ILS',
        user._id  // Add required userId
      );

      const transaction2 = await Transaction.createFromScraperData(
        {
          chargedAmount: amount,
          date,
          description
        },
        bankAccount._id,
        'ILS',
        user._id  // Add required userId
      );

      expect(transaction1.identifier).not.toBe(transaction2.identifier);
    });
  });
});
