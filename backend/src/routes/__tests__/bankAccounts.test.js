const request = require('supertest');
const mongoose = require('mongoose');
const { createTestUser } = require('../../test/testUtils');
const app = require('../../app');
const User = require('../../models/User');
const BankAccount = require('../../models/BankAccount');

describe('Bank Account Routes', () => {
  let user;
  let token;

  beforeEach(async () => {
    const testData = await createTestUser(User);
    user = testData.user;
    token = testData.token;
  });

  describe('POST /api/bank-accounts', () => {
    it('should create a new bank account', async () => {
      const bankAccountData = {
        bankId: 'hapoalim',
        name: 'My Bank Account',
        credentials: {
          username: 'testuser',
          password: 'bankpass123'
        }
      };

      const response = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send(bankAccountData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('bankId', bankAccountData.bankId);
      expect(response.body).toHaveProperty('name', bankAccountData.name);
      expect(response.body.userId.toString()).toBe(user._id.toString());
    });

    it('should not create bank account without authentication', async () => {
      const response = await request(app)
        .post('/api/bank-accounts')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/bank-accounts', () => {
    it('should list user\'s bank accounts', async () => {
      const bankAccount = new BankAccount({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Test Account',
        credentials: {
          username: 'testuser',
          password: 'bankpass123'
        }
      });
      await bankAccount.save();

      const response = await request(app)
        .get('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].userId.toString()).toBe(user._id.toString());
    });

    it('should not list accounts without authentication', async () => {
      const response = await request(app)
        .get('/api/bank-accounts');

      expect(response.status).toBe(401);
    });

    it('should only list accounts for authenticated user', async () => {
      const otherTestData = await createTestUser(User, {
        email: 'other@example.com',
        name: 'Other User'
      });
      const otherUser = otherTestData.user;

      const bankAccount = new BankAccount({
        userId: otherUser._id,
        bankId: 'hapoalim',
        name: 'Other Account',
        credentials: {
          username: 'testuser',
          password: 'bankpass123'
        }
      });
      await bankAccount.save();

      const response = await request(app)
        .get('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('DELETE /api/bank-accounts/:id', () => {
    it('should delete bank account', async () => {
      const bankAccount = new BankAccount({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Test Account',
        credentials: {
          username: 'testuser',
          password: 'bankpass123'
        }
      });
      await bankAccount.save();

      const response = await request(app)
        .delete(`/api/bank-accounts/${bankAccount.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const deletedAccount = await BankAccount.findById(bankAccount.id);
      expect(deletedAccount).toBeNull();
    });

    it('should not delete account without authentication', async () => {
      const bankAccount = new BankAccount({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Test Account',
        credentials: {
          username: 'testuser',
          password: 'bankpass123'
        }
      });
      await bankAccount.save();

      const response = await request(app)
        .delete(`/api/bank-accounts/${bankAccount.id}`);

      expect(response.status).toBe(401);
    });

    it('should not delete another user\'s account', async () => {
      const otherTestData = await createTestUser(User, {
        email: 'other@example.com',
        name: 'Other User'
      });
      const otherUser = otherTestData.user;

      const bankAccount = new BankAccount({
        userId: otherUser._id,
        bankId: 'hapoalim',
        name: 'Other Account',
        credentials: {
          username: 'testuser',
          password: 'bankpass123'
        }
      });
      await bankAccount.save();

      const response = await request(app)
        .delete(`/api/bank-accounts/${bankAccount.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      const accountStillExists = await BankAccount.findById(bankAccount.id);
      expect(accountStillExists).toBeTruthy();
    });
  });
});
