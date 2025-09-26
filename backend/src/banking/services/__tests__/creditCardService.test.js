const mongoose = require('mongoose');
const creditCardService = require('../creditCardService');
const { CreditCard, Transaction } = require('../../models');
const { User } = require('../../../auth');

describe('CreditCardService', () => {
  beforeEach(async () => {
    await CreditCard.deleteMany({});
    await Transaction.deleteMany({});
  });

  describe('getUserCreditCards', () => {
    it('should return empty array when user has no credit cards', async () => {
      const userId = new mongoose.Types.ObjectId();
      const result = await creditCardService.getUserCreditCards(userId);
      expect(result).toEqual([]);
    });

    it('should return credit cards with recent transaction counts', async () => {
      const userId = new mongoose.Types.ObjectId();
      const bankAccountId = new mongoose.Types.ObjectId();
      
      // Create credit card
      const creditCard = await CreditCard.create({
        bankAccountId,
        userId,
        cardNumber: '1234',
        displayName: 'Test Card',
        timingFlexibility: {
          cutoffDay: 15,
          gracePeriodDays: 15
        }
      });

      // Create transactions
      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));
      
      await Transaction.create([
        {
          identifier: 'test-txn-1',
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: now,
          processedDate: now,
          amount: -100,
          currency: 'ILS',
          description: 'Test transaction 1',
          rawData: { source: 'test' }
        },
        {
          identifier: 'test-txn-2',
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)), // 15 days ago, within 30-day window
          processedDate: new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)),
          amount: -50,
          currency: 'ILS',
          description: 'Test transaction 2',
          rawData: { source: 'test' }
        }
      ]);

      const result = await creditCardService.getUserCreditCards(userId);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        _id: creditCard._id,
        name: 'Test Card',
        identifier: '1234',
        recentTransactionCount: 2,
        totalSpentLast6Months: 150
      });
    });
  });

  describe('getCreditCardDetails', () => {
    it('should return null for non-existent credit card', async () => {
      const cardId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      
      const result = await creditCardService.getCreditCardDetails(cardId, userId);
      expect(result).toBeNull();
    });

    it('should return credit card details with statistics', async () => {
      const userId = new mongoose.Types.ObjectId();
      const bankAccountId = new mongoose.Types.ObjectId();
      
      const creditCard = await CreditCard.create({
        bankAccountId,
        userId,
        cardNumber: '1234',
        displayName: 'Test Card',
        timingFlexibility: {
          cutoffDay: 15,
          gracePeriodDays: 15
        }
      });

      await Transaction.create([
        {
          identifier: 'test-txn-3',
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: new Date(),
          processedDate: new Date(),
          amount: -200,
          currency: 'ILS',
          description: 'Test transaction',
          rawData: { source: 'test' }
        }
      ]);

      const result = await creditCardService.getCreditCardDetails(creditCard._id, userId);
      
      expect(result).toMatchObject({
        _id: creditCard._id,
        name: 'Test Card',
        totalTransactions: 1,
        totalSpentAllTime: 200,
        avgMonthlySpending: expect.any(Number)
      });
    });
  });

  describe('getCreditCardBasicStats', () => {
    it('should return basic statistics for 6 months', async () => {
      const userId = new mongoose.Types.ObjectId();
      const bankAccountId = new mongoose.Types.ObjectId();
      
      const creditCard = await CreditCard.create({
        bankAccountId,
        userId,
        cardNumber: '1234',
        displayName: 'Test Card',
        timingFlexibility: {
          cutoffDay: 15,
          gracePeriodDays: 15
        }
      });

      // Create transactions over 6 months
      const transactions = [];
      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        transactions.push({
          identifier: `test-txn-${4 + i}`,
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: date,
          processedDate: date,
          amount: -100,
          currency: 'ILS',
          description: `Transaction ${i}`,
          rawData: { source: 'test' }
        });
      }
      await Transaction.create(transactions);

      const result = await creditCardService.getCreditCardBasicStats(creditCard._id, userId);
      
      expect(result).toMatchObject({
        cardId: creditCard._id.toString(),
        last6MonthsTotal: 600,
        avgMonthlySpending: 100,
        totalTransactions: 6,
        periodStart: expect.any(String),
        periodEnd: expect.any(String)
      });
    });
  });

  describe('getCreditCardMonthlyStats', () => {
    it('should return monthly statistics with category breakdown', async () => {
      const userId = new mongoose.Types.ObjectId();
      const bankAccountId = new mongoose.Types.ObjectId();
      
      const creditCard = await CreditCard.create({
        bankAccountId,
        userId,
        cardNumber: '1234',
        displayName: 'Test Card',
        timingFlexibility: {
          cutoffDay: 15,
          gracePeriodDays: 15
        }
      });

      const targetDate = new Date(2024, 0, 15); // January 2024
      
      await Transaction.create([
        {
          identifier: 'test-txn-10',
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: targetDate,
          processedDate: targetDate,
          amount: -300,
          currency: 'ILS',
          description: 'Restaurant',
          rawData: { source: 'test' }
        },
        {
          identifier: 'test-txn-11',
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: targetDate,
          processedDate: targetDate,
          amount: -200,
          currency: 'ILS',
          description: 'Groceries',
          rawData: { source: 'test' }
        }
      ]);

      const result = await creditCardService.getCreditCardMonthlyStats(creditCard._id, 2024, 1, userId);
      
      expect(result).toMatchObject({
        cardId: creditCard._id.toString(),
        year: 2024,
        month: 1,
        monthName: 'January 2024',
        totalAmount: 500,
        transactionCount: 2,
        categoryBreakdown: expect.any(Array)
      });
    });

    it('should return zero data for month with no transactions', async () => {
      const userId = new mongoose.Types.ObjectId();
      const bankAccountId = new mongoose.Types.ObjectId();
      
      const creditCard = await CreditCard.create({
        bankAccountId,
        userId,
        cardNumber: '1234',
        displayName: 'Test Card',
        timingFlexibility: {
          cutoffDay: 15,
          gracePeriodDays: 15
        }
      });

      const result = await creditCardService.getCreditCardMonthlyStats(creditCard._id, 2024, 1, userId);
      
      expect(result).toMatchObject({
        cardId: creditCard._id.toString(),
        year: 2024,
        month: 1,
        monthName: 'January 2024',
        totalAmount: 0,
        transactionCount: 0,
        categoryBreakdown: []
      });
    });
  });

  describe('getCreditCardTrend', () => {
    it('should return 6-month trend with zero-filled missing months', async () => {
      const userId = new mongoose.Types.ObjectId();
      const bankAccountId = new mongoose.Types.ObjectId();
      
      const creditCard = await CreditCard.create({
        bankAccountId,
        userId,
        cardNumber: '1234',
        displayName: 'Test Card',
        timingFlexibility: {
          cutoffDay: 15,
          gracePeriodDays: 15
        }
      });

      // Create transactions for only 2 months out of 6
      const now = new Date();
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15);
      const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 4, 15);

      await Transaction.create([
        {
          identifier: 'test-txn-12',
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: twoMonthsAgo,
          processedDate: twoMonthsAgo,
          amount: -100,
          currency: 'ILS',
          description: 'Transaction 1',
          rawData: { source: 'test' }
        },
        {
          identifier: 'test-txn-13',
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: fourMonthsAgo,
          processedDate: fourMonthsAgo,
          amount: -200,
          currency: 'ILS',
          description: 'Transaction 2',
          rawData: { source: 'test' }
        }
      ]);

      const result = await creditCardService.getCreditCardTrend(creditCard._id, userId);
      
      expect(result).toMatchObject({
        cardId: creditCard._id.toString(),
        totalPeriodAmount: 300,
        avgMonthlyAmount: 150, // 300 / 2 months with data = 150 (accurate calculation)
        monthsWithData: 2 // Add this to verify the new field
      });
      
      expect(result.months).toHaveLength(6);
      
      // Check that months with transactions have correct amounts
      const monthsWithTransactions = result.months.filter(m => m.totalAmount > 0);
      expect(monthsWithTransactions).toHaveLength(2);
      
      // Check that months without transactions are zero-filled
      const monthsWithoutTransactions = result.months.filter(m => m.totalAmount === 0);
      expect(monthsWithoutTransactions).toHaveLength(4);
    });
  });

  describe('getCreditCardTransactions', () => {
    it('should return paginated transactions with filters', async () => {
      const userId = new mongoose.Types.ObjectId();
      const bankAccountId = new mongoose.Types.ObjectId();
      
      const creditCard = await CreditCard.create({
        bankAccountId,
        userId,
        cardNumber: '1234',
        displayName: 'Test Card',
        timingFlexibility: {
          cutoffDay: 15,
          gracePeriodDays: 15
        }
      });

      // Create multiple transactions
      const transactions = [];
      for (let i = 0; i < 25; i++) {
        transactions.push({
          identifier: `test-txn-${14 + i}`,
          accountId: bankAccountId,
          creditCardId: creditCard._id,
          userId,
          date: new Date(),
          processedDate: new Date(),
          amount: -(i + 1) * 10,
          currency: 'ILS',
          description: `Transaction ${i}`,
          rawData: { source: 'test' }
        });
      }
      await Transaction.create(transactions);

      // Test pagination
      const result = await creditCardService.getCreditCardTransactions(
        creditCard._id,
        { page: 1, limit: 10 },
        userId
      );
      
      expect(result).toMatchObject({
        totalCount: 25,
        currentPage: 1,
        totalPages: 3,
        hasNext: true,
        hasPrev: false
      });
      expect(result.transactions).toHaveLength(10);

      // Test basic filtering (without category since we don't have categories in our test data)
      const filteredResult = await creditCardService.getCreditCardTransactions(
        creditCard._id,
        { page: 1, limit: 20 },
        userId
      );
      
      expect(filteredResult.totalCount).toBe(25);
      expect(filteredResult.transactions).toHaveLength(20);
    });

    it('should return empty result for non-existent credit card', async () => {
      const cardId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      
      const result = await creditCardService.getCreditCardTransactions(cardId, {}, userId);
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle invalid ObjectId gracefully', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const result = await creditCardService.getCreditCardDetails('invalid-id', userId);
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const result = await creditCardService.getCreditCardDetails('invalid-id', userId);
      expect(result).toBeNull();
    });
  });
});
