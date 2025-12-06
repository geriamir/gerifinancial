// Mock queuedDataSyncService BEFORE any imports to avoid Redis dependency
jest.mock('../../services/queuedDataSyncService');

const request = require('supertest');
const mongoose = require('mongoose');
const { createTestUser } = require('../../../test/testUtils');
const queuedDataSyncService = require('../../services/queuedDataSyncService');
const app = require('../../../app');
const { User } = require('../../../auth');
const { BankAccount } = require('../../models');

// Import valid credentials from mock (bankScraperService handles the mocking automatically based on NODE_ENV)
const { validCredentials } = require('../../../test/mocks/bankScraper');

describe('Bank Account Routes', () => {
  let user;
  let token;

  beforeAll(() => {
    // Initialize sync strategies for queue-based tests
    if (!global.syncStrategies) {
      const { CheckingAccountsSyncStrategy } = require('../../services/sync-strategies');
      const PortfoliosSyncStrategy = require('../../../investments/services/sync/PortfoliosSyncStrategy');
      const ForeignCurrencySyncStrategy = require('../../../foreign-currency/services/sync/ForeignCurrencySyncStrategy');

      global.syncStrategies = {
        'checking-accounts': new CheckingAccountsSyncStrategy(),
        'investment-portfolios': new PortfoliosSyncStrategy(),
        'foreign-currency': new ForeignCurrencySyncStrategy()
      };
    }
  });

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
          username: validCredentials.username,
          password: validCredentials.password
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
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });
  });

  describe('POST /api/bank-accounts/scrape-all', () => {
    it('should queue scraping jobs for all active accounts', async () => {
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

      if (res.status !== 200) {
        console.log('Error response:', res.body);
      }
      expect(res.status).toBe(200);
      expect(res.body.totalAccounts).toBe(2);
      expect(res.body.successfullyQueued).toBe(2);
      expect(res.body.failedToQueue).toBe(0);
      expect(res.body.accounts).toHaveLength(2);
    });

    it('should handle accounts with queueing errors', async () => {
      // Create one successful and one potentially failing account
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
      // Queue-based system should queue both accounts even if credentials are invalid
      // Validation happens during job execution, not during queueing
      expect(res.body.successfullyQueued).toBeGreaterThanOrEqual(1);
      expect(res.body.accounts).toHaveLength(2);
    });

    it('should only queue active accounts and skip disabled ones', async () => {
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
      expect(res.body.successfullyQueued).toBe(1);
      expect(res.body.failedToQueue).toBe(0);
    });

    it('should handle case when user has no active accounts', async () => {
      const res = await request(app)
        .post('/api/bank-accounts/scrape-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.totalAccounts).toBe(0);
      expect(res.body.successfullyQueued).toBe(0);
      expect(res.body.failedToQueue).toBe(0);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/bank-accounts/scrape-all');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/bank-accounts/:id/scrape', () => {
    it('should queue scraping jobs for the account', async () => {
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
          priority: 'high'
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Scraping jobs queued successfully');
      expect(res.body.accountId).toBe(bankAccount._id.toString());
      expect(res.body.accountName).toBe('Test Account');
      expect(res.body.totalJobs).toBeGreaterThan(0);
      expect(Array.isArray(res.body.queuedJobs)).toBe(true);
    });

    it('should handle non-existent account', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/bank-accounts/${fakeId}/scrape`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          priority: 'high'
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('not found');
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
