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
    user = await createTestUser(User);
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'testpassword' });
    token = loginResponse.body.token;
  });

  describe('POST /api/bank-accounts', () => {
    it('should create a new bank account', async () => {
      const bankAccountData = {
        bankId: 'bank1',
        accountNumber: '123456789',
        username: 'testuser',
        password: 'bankpass123',
        nickname: 'Test Account'
      };

      const response = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send(bankAccountData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('bankId', bankAccountData.bankId);
      expect(response.body).toHaveProperty('accountNumber', bankAccountData.accountNumber);
      expect(response.body).toHaveProperty('nickname', bankAccountData.nickname);
      expect(response.body).toHaveProperty('user', user.id);
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
        bankId: 'bank1',
        accountNumber: '123456789',
        username: 'testuser',
        password: 'bankpass123',
        nickname: 'Test Account',
        user: user.id
      });
      await bankAccount.save();

      const response = await request(app)
        .get('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].user).toBe(user.id);
    });

    it('should not list accounts without authentication', async () => {
      const response = await request(app)
        .get('/api/bank-accounts');

      expect(response.status).toBe(401);
    });

    it('should only list accounts for authenticated user', async () => {
      const otherUser = await createTestUser(User);
      const bankAccount = new BankAccount({
        bankId: 'bank1',
        accountNumber: '123456789',
        username: 'testuser',
        password: 'bankpass123',
        nickname: 'Test Account',
        user: otherUser.id
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
        bankId: 'bank1',
        accountNumber: '123456789',
        username: 'testuser',
        password: 'bankpass123',
        nickname: 'Test Account',
        user: user.id
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
        bankId: 'bank1',
        accountNumber: '123456789',
        username: 'testuser',
        password: 'bankpass123',
        nickname: 'Test Account',
        user: user.id
      });
      await bankAccount.save();

      const response = await request(app)
        .delete(`/api/bank-accounts/${bankAccount.id}`);

      expect(response.status).toBe(401);
    });

    it('should not delete another user\'s account', async () => {
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'testpass123'
      });

      const bankAccount = new BankAccount({
        bankId: 'bank1',
        accountNumber: '123456789',
        username: 'testuser',
        password: 'bankpass123',
        nickname: 'Test Account',
        user: otherUser.id
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
