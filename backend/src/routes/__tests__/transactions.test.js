const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { createTestUser } = require('../../test/testUtils');
const { User, BankAccount, Category, SubCategory, Transaction } = require('../../models');

describe('Transaction Routes', () => {
  let token;
  let user;
  let bankAccount;
  let category;
  let subCategory;
  let transaction;
  let transactions = [];

  beforeEach(async () => {
    // Create test user
    const testData = await createTestUser(User);
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

    // Create test category and subcategory
    category = await Category.create({
      name: 'Food',
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
      rawData: { originalData: 'test' }
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

    // Create additional transactions for pagination tests (in different account)
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
        accountId: otherAccount._id,  // Use different account
        userId: user._id,
        amount: amount,
        currency: 'ILS',
        date: dates[i % 3],
        type: type,
        description: `Test Transaction ${i + 2}`,
        rawData: { originalData: `test-${i + 2}` }
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

  describe('GET /api/transactions/account/:accountId', () => {
    it('should return transactions for valid account', async () => {
      const res = await request(app)
        .get(`/api/transactions/account/${bankAccount._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBe(1);
      expect(res.body[0].identifier).toBe(transaction.identifier);
    });

    it('should filter transactions by date range', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const res = await request(app)
        .get(`/api/transactions/account/${bankAccount._id}`)
        .query({ startDate: startDate.toISOString(), endDate: endDate.toISOString() })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/api/transactions/account/${bankAccount._id}`);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/transactions/uncategorized/:accountId', () => {
    it('should return uncategorized transactions', async () => {
      const res = await request(app)
        .get(`/api/transactions/uncategorized/${bankAccount._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBe(1); // Our test transaction is uncategorized
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/api/transactions/uncategorized/${bankAccount._id}`);

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

  describe('GET /api/transactions/categories', () => {
    it('should return all categories with subcategories', async () => {
      const res = await request(app)
        .get('/api/transactions/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body[0].name).toBe('Food');
      expect(Array.isArray(res.body[0].subCategories)).toBeTruthy();
      expect(res.body[0].subCategories[0].name).toBe('Restaurants');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/transactions/categories');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/transactions/categories', () => {
    it('should create a new category', async () => {
      const newCategory = {
        name: 'Transportation',
        type: 'Expense',
        userId: user._id
      };

      const res = await request(app)
        .post('/api/transactions/categories')
        .set('Authorization', `Bearer ${token}`)
        .send(newCategory);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(newCategory.name);
      expect(res.body.type).toBe(newCategory.type);
    });

    it('should require name and type', async () => {
      const res = await request(app)
        .post('/api/transactions/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Name and type are required');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/transactions/categories')
        .send({ name: 'Test', type: 'Expense' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/transactions/categories/:categoryId/subcategories', () => {
    it('should create a new subcategory', async () => {
      const newSubCategory = {
        name: 'Fast Food',
        keywords: ['mcdonalds', 'burger'],
        isDefault: false
      };

      const res = await request(app)
        .post(`/api/transactions/categories/${category._id}/subcategories`)
        .set('Authorization', `Bearer ${token}`)
        .send(newSubCategory);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(newSubCategory.name);
      expect(res.body.keywords).toEqual(newSubCategory.keywords);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/transactions/categories/${category._id}/subcategories`)
        .send({ name: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/transactions/subcategories/:subCategoryId/keywords', () => {
    it('should update subcategory keywords', async () => {
      const newKeywords = ['restaurant', 'cafe', 'bistro'];

      const res = await request(app)
        .patch(`/api/transactions/subcategories/${subCategory._id}/keywords`)
        .set('Authorization', `Bearer ${token}`)
        .send({ keywords: newKeywords });

      expect(res.status).toBe(200);
      expect(res.body.keywords).toEqual(newKeywords);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .patch(`/api/transactions/subcategories/${subCategory._id}/keywords`)
        .send({ keywords: [] });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/transactions/categories/:categoryId', () => {
    it('should delete category and its subcategories', async () => {
      const res = await request(app)
        .delete(`/api/transactions/categories/${category._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      // Verify category is deleted
      const deletedCategory = await Category.findById(category._id);
      expect(deletedCategory).toBeNull();

      // Verify subcategories are deleted
      const deletedSubCategory = await SubCategory.findById(subCategory._id);
      expect(deletedSubCategory).toBeNull();
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/transactions/categories/${category._id}`);

      expect(res.status).toBe(401);
    });

    it('should handle non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/transactions/categories/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Category not found');
    });
  });

  describe('Transaction Identifier Generation', () => {
    it('should generate a unique identifier when none is provided', async () => {
      // Create transaction data without identifier
      const transactionData = {
        accountId: bankAccount._id,
        amount: 75,
        currency: 'ILS',
        date: new Date(),
        type: 'Expense',
        description: 'Auto ID Test',
        rawData: { originalData: 'test-auto-id' }
      };

      const transaction = await Transaction.createFromScraperData({
        chargedAmount: -75,
        date: new Date(),
        description: 'Auto ID Test'
      }, bankAccount._id, 'ILS', user._id);

      expect(transaction.identifier).toBeTruthy();
      expect(typeof transaction.identifier).toBe('string');
      expect(transaction.identifier.includes(bankAccount._id.toString())).toBe(true);
    });

    it('should use provided identifier when available', async () => {
      const providedId = 'test-provided-id';
      const transaction = await Transaction.createFromScraperData({
        identifier: providedId,
        chargedAmount: -75,
        date: new Date(),
        description: 'Provided ID Test'
      }, bankAccount._id, 'ILS', user._id);

      expect(transaction.identifier).toBe(providedId);
    });

    it('should generate unique identifiers for similar transactions', async () => {
      const date = new Date();
      const description = 'Similar Transaction';
      const amount = -100;

      const transaction1 = await Transaction.createFromScraperData({
        chargedAmount: amount,
        date,
        description
      }, bankAccount._id, 'ILS', user._id);

      const transaction2 = await Transaction.createFromScraperData({
        chargedAmount: amount,
        date,
        description
      }, bankAccount._id, 'ILS', user._id);

      expect(transaction1.identifier).not.toBe(transaction2.identifier);
    });
  });
});
