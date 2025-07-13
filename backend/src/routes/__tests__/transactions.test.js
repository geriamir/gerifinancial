jest.mock('../../services/categoryAIService', () => require('../../test/mocks/categoryAIService'));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { createTestUser } = require('../../test/testUtils');
const { User, BankAccount, Category, SubCategory, Transaction } = require('../../models');
const transactionService = require('../../services/transactionService');

describe('Transaction Routes', () => {
  let token;
  let user;
  let bankAccount;
  let category;
  let subCategory;
  let transaction;
  let transactions = [];

  beforeEach(async () => {
    // Create test user with unique email
    const testData = await createTestUser(User, {
      email: `test${Date.now()}@example.com`
    });
    user = testData.user;
    token = testData.token;

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

    // Create test categories
    category = await Category.create({
      name: 'Food',
      type: 'Expense',
      userId: user._id
    });

    const transportCategory = await Category.create({
      name: 'Transportation',
      type: 'Expense',
      userId: user._id
    });

    subCategory = await SubCategory.create({
      name: 'Restaurants',
      keywords: ['restaurant', 'cafe'],
      parentCategory: category._id,
      isDefault: false,
      userId: user._id
    });

    // Update category with subcategory
    await Category.findByIdAndUpdate(category._id, {
      $push: { subCategories: subCategory._id }
    });

    // Create a test transaction for account-specific tests
    transaction = await Transaction.create({
        identifier: 'test-transaction-1',
        accountId: bankAccount._id,
        userId: user._id,
        amount: -100,  // Negative for Expense
        currency: 'ILS',
        date: new Date(),
        type: 'Expense',
        description: 'Test Restaurant',
        rawData: { 
          originalData: 'test',
          description: 'Test Restaurant',
          chargedAmount: -100
        }
    });

    // Create another account for pagination test data
    const otherAccount = await BankAccount.create({
      userId: user._id,
      bankId: 'hapoalim',
      name: 'Other Test Account',
      credentials: {
        username: 'testuser2',
        password: 'bankpass123'
      }
    });

    // Create additional transactions for pagination tests
    const dates = [
      new Date('2025-06-01'),
      new Date('2025-06-15'),
      new Date('2025-06-30')
    ];

    for (let i = 0; i < 25; i++) {
      const type = i % 2 === 0 ? 'Expense' : 'Income';
      const amount = type === 'Expense' ? -(50 + i) : (50 + i);
      const tx = await Transaction.create({
        identifier: `test-transaction-${i + 2}`,
        accountId: otherAccount._id,
        userId: user._id,
        amount: amount,
        currency: 'ILS',
        date: dates[i % 3],
        type: type,
        description: `Test Transaction ${i + 2}`,
        rawData: { 
          originalData: `test-${i + 2}`,
          description: `Test Transaction ${i + 2}`,
          chargedAmount: amount
        }
      });
      transactions.push(tx);
    }
  });

  describe('GET /api/transactions', () => {
    it('should return paginated transactions', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .query({ limit: 10, skip: 0 })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('transactions');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('hasMore');
      expect(res.body.transactions.length).toBe(10);
      expect(res.body.total).toBe(26); // 25 + 1 from initial setup
      expect(res.body.hasMore).toBe(true);
    });

    it('should filter transactions by date range', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .query({
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2025-06-15T23:59:59.999Z'
        })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.transactions.every(t => 
        new Date(t.date) >= new Date('2025-06-01') &&
        new Date(t.date) <= new Date('2025-06-15')
      )).toBe(true);
    });

    it('should filter transactions by type', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .query({ type: 'Expense' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.transactions.every(t => t.type === 'Expense')).toBe(true);
    });

    it('should filter transactions by search term', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .query({ search: 'Transaction 2' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.transactions.every(t => 
        t.description.includes('Transaction 2')
      )).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/transactions');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/transactions/:transactionId/suggest-category', () => {
    beforeEach(async () => {
      // Clear mocks
      jest.clearAllMocks();
    });

    it('should suggest category using AI analysis', async () => {
      const res = await request(app)
        .post(`/api/transactions/${transaction._id}/suggest-category`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('suggestion');
      expect(res.body.suggestion).toHaveProperty('categoryId');
      expect(res.body.suggestion).toHaveProperty('subCategoryId');
      expect(res.body.suggestion).toHaveProperty('confidence');
      expect(res.body.suggestion).toHaveProperty('reasoning');
    });

    it('should provide relevant suggestions for restaurant transactions', async () => {
      const restaurantTx = await Transaction.create({
        identifier: 'test-restaurant-tx',
        accountId: bankAccount._id,
        userId: user._id,
        amount: -75,
        currency: 'ILS',
        date: new Date(),
        type: 'Expense',
        description: 'Local Restaurant Dining',
        rawData: { 
          originalData: 'test',
          description: 'Local Restaurant Dining',
          chargedAmount: -75,
          memo: 'Restaurant'
        }
      });

      const res = await request(app)
        .post(`/api/transactions/${restaurantTx._id}/suggest-category`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.suggestion.categoryId).toBe(category._id.toString());
      expect(res.body.suggestion.subCategoryId).toBe(subCategory._id.toString());
      expect(res.body.suggestion.confidence).toBeGreaterThan(0.5);
    });

    it('should handle ambiguous transactions with lower confidence', async () => {
      const ambiguousTx = await Transaction.create({
        identifier: 'test-ambiguous-tx',
        accountId: bankAccount._id,
        userId: user._id,
        amount: -50,
        currency: 'ILS',
        date: new Date(),
        type: 'Expense',
        description: 'General Payment',
        rawData: { 
          originalData: 'test',
          description: 'General Payment',
          chargedAmount: -50,
          memo: 'Payment'
        }
      });

      const res = await request(app)
        .post(`/api/transactions/${ambiguousTx._id}/suggest-category`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.suggestion).toHaveProperty('confidence');
      expect(res.body.suggestion.confidence).toBeLessThan(0.5);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/transactions/${transaction._id}/suggest-category`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/transactions/summary/:accountId', () => {
    it('should return spending summary', async () => {
      const res = await request(app)
        .get(`/api/transactions/summary/${bankAccount._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalExpenses');
      expect(res.body).toHaveProperty('totalIncome');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/api/transactions/summary/${bankAccount._id}`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/transactions/:transactionId/categorize', () => {
    it('should categorize a transaction', async () => {
      const res = await request(app)
        .post(`/api/transactions/${transaction._id}/categorize`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          categoryId: category._id,
          subCategoryId: subCategory._id
        });

      expect(res.status).toBe(200);
      expect(res.body.category.toString()).toBe(category._id.toString());
      expect(res.body.subCategory.toString()).toBe(subCategory._id.toString());
    });

    it('should fail with invalid category', async () => {
      const res = await request(app)
        .post(`/api/transactions/${transaction._id}/categorize`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          categoryId: new mongoose.Types.ObjectId(),
          subCategoryId: new mongoose.Types.ObjectId()
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Category or subcategory not found');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/transactions/${transaction._id}/categorize`)
        .send({
          categoryId: category._id,
          subCategoryId: subCategory._id
        });

      expect(res.status).toBe(401);
    });
  });


  describe('Transaction Processing via Service', () => {
    it('should process scraped transactions correctly', async () => {
      const scrapedAccounts = [{
        txns: [{
          chargedAmount: -75,
          date: new Date(),
          description: 'Service Test Transaction',
          identifier: 'service-test-1'
        }]
      }];

      const result = await transactionService.processScrapedTransactions(
        scrapedAccounts, 
        bankAccount
      );

      expect(result.newTransactions).toBe(1);
      expect(result.duplicates).toBe(0);

      // Verify transaction was created
      const savedTransaction = await Transaction.findOne({
        description: 'Service Test Transaction'
      });
      expect(savedTransaction).toBeTruthy();
      expect(savedTransaction.identifier).toBe('service-test-1');
    });


    it('should handle transactions without identifiers', async () => {
      const scrapedAccounts = [{
        txns: [{
          chargedAmount: -100,
          date: new Date(),
          description: 'No ID Transaction'
          // No identifier provided - should cause validation error
        }]
      }];

      const result = await transactionService.processScrapedTransactions(
        scrapedAccounts, 
        bankAccount
      );

      // Should result in an error due to missing identifier
      expect(result.newTransactions).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].error).toContain('identifier');
    });
  });
});
