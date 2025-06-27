const request = require('supertest');
const mongoose = require('mongoose');
const { createTestUser } = require('../../test/testUtils');
const app = require('../../app');
const { User, BankAccount } = require('../../models');

// Setup mock for israeli-bank-scrapers
jest.mock('israeli-bank-scrapers', () => require('../../test/mocks/bankScraper'));

// Import valid credentials from mock
const { validCredentials } = require('../../test/mocks/bankScraper');

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
        username: validCredentials.username,
        password: validCredentials.password
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
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });
  });

  describe('POST /api/bank-accounts/scrape-all', () => {
    it('should scrape all active accounts', async () => {
      // Create two active accounts
      const accounts = await Promise.all([
        BankAccount.create({
          userId: user._id,
          bankId: 'hapoalim',
          name: 'Test Account 1',
          credentials: {
            username: validCredentials.username,
            password: validCredentials.password
          },
          status: 'active'
        }),
        BankAccount.create({
          userId: user._id,
          bankId: 'leumi',
          name: 'Test Account 2',
          credentials: {
            username: validCredentials.username,
            password: validCredentials.password
          },
          status: 'active'
        })
      ]);

      const res = await request(app)
        .post('/api/bank-accounts/scrape-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalAccounts).toBe(2);
      expect(res.body.successfulScrapes).toBe(2);
      expect(res.body.failedScrapes).toBe(0);
      expect(res.body.errors).toHaveLength(0);
    });

    it('should handle accounts with errors', async () => {
      // Create one successful and one failing account
      const accounts = await Promise.all([
        BankAccount.create({
          userId: user._id,
          bankId: 'hapoalim',
          name: 'Success Account',
          credentials: {
            username: validCredentials.username,
            password: validCredentials.password
          },
          status: 'active'
        }),
        BankAccount.create({
          userId: user._id,
          bankId: 'hapoalim',
          name: 'Error Account',
          credentials: {
            username: 'invalid',
            password: 'invalid'
          },
          status: 'active'
        })
      ]);

      const res = await request(app)
        .post('/api/bank-accounts/scrape-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalAccounts).toBe(2);
      expect(res.body.successfulScrapes).toBe(1);
      expect(res.body.failedScrapes).toBe(1);
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0]).toMatchObject({
        accountName: 'Error Account',
        error: expect.any(String)
      });
    });

    it('should only scrape active accounts and skip disabled ones', async () => {
      // Create one active and one disabled account
      const accounts = await Promise.all([
        BankAccount.create({
          userId: user._id,
          bankId: 'hapoalim',
          name: 'Active Account',
          credentials: {
            username: validCredentials.username,
            password: validCredentials.password
          },
          status: 'active'
        }),
        BankAccount.create({
          userId: user._id,
          bankId: 'leumi',
          name: 'Disabled Account',
          credentials: {
            username: validCredentials.username,
            password: validCredentials.password
          },
          status: 'disabled'
        })
      ]);

      const res = await request(app)
        .post('/api/bank-accounts/scrape-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalAccounts).toBe(1); // Only counts active accounts
      expect(res.body.successfulScrapes).toBe(1);
      expect(res.body.failedScrapes).toBe(0);
    });

    it('should handle case when user has no active accounts', async () => {
      const res = await request(app)
        .post('/api/bank-accounts/scrape-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalAccounts).toBe(0);
      expect(res.body.successfulScrapes).toBe(0);
      expect(res.body.failedScrapes).toBe(0);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/bank-accounts/scrape-all');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/bank-accounts/:id/scrape', () => {
    it('should scrape and save new transactions', async () => {
      const bankAccount = new BankAccount({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Test Account',
        credentials: {
          username: validCredentials.username,
          password: validCredentials.password
        }
      });
      await bankAccount.save();

      const res = await request(app)
        .post(`/api/bank-accounts/${bankAccount._id}/scrape`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          showBrowser: false,
          startDate: new Date().toISOString()
        });

      expect(res.status).toBe(200);
      expect(res.body.newTransactions).toBeGreaterThan(0);
      expect(res.body.errors).toHaveLength(0);
    });

    it('should handle non-existent account', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/bank-accounts/${fakeId}/scrape`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          showBrowser: false,
          startDate: new Date().toISOString()
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Bank account not found');
    });
  });

  describe('GET /api/bank-accounts', () => {
    it('should list user\'s bank accounts', async () => {
      const bankAccount = new BankAccount({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Test Account',
        credentials: {
          username: validCredentials.username,
          password: validCredentials.password
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
          username: validCredentials.username,
          password: validCredentials.password
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
          username: validCredentials.username,
          password: validCredentials.password
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
          username: validCredentials.username,
          password: validCredentials.password
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
          username: validCredentials.username,
          password: validCredentials.password
        }
      });
      await bankAccount.save();

      const response = await request(app)
        .delete(`/api/bank-accounts/${bankAccount.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      const accountStillExists = await BankAccount.findById(bankAccount.id);
      expect(accountStillExists).toBeTruthy();
    });
  });
});
