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
      type: 'Expense'
    });

    subCategory = await SubCategory.create({
      name: 'Restaurants',
      keywords: ['restaurant', 'cafe'],
      parentCategory: category._id,
      isDefault: false
    });

    // Update category with subcategory
    await Category.findByIdAndUpdate(category._id, {
      $push: { subCategories: subCategory._id }
    });

    // Create test transaction
    transaction = await Transaction.create({
      identifier: 'test-transaction-1',
      accountId: bankAccount._id,
      amount: 100,
      currency: 'ILS',
      date: new Date(),
      type: 'Expense',
      description: 'Test Restaurant',
      rawData: { originalData: 'test' }
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
        type: 'Expense'
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
});
