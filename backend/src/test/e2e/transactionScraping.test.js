const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { BankAccount, Transaction, User } = require('../../models');
const { createTestUser } = require('../testUtils');
const scrapingSchedulerService = require('../../services/scrapingSchedulerService');

// Mock israeli-bank-scrapers
jest.mock('israeli-bank-scrapers', () => require('../mocks/bankScraper'));

describe('Transaction Scraping E2E Tests', () => {
  let user;
  let token;
  let bankAccount;

  beforeAll(async () => {
    // Create test user with bank account
    const testData = await createTestUser(User);
    user = testData.user;
    token = testData.token;

    // Create a test bank account
    bankAccount = await BankAccount.create({
      userId: user._id,
      bankId: 'hapoalim',
      name: 'Test Account',
      credentials: {
        username: 'testuser',
        password: 'testpass'
      }
    });

    // Initialize the scraping scheduler
    await scrapingSchedulerService.initialize();
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({});
    await BankAccount.deleteMany({});
    await Transaction.deleteMany({});
    scrapingSchedulerService.stopAll();
  });

  describe('Manual Scraping', () => {
    it('should manually trigger transaction scraping', async () => {
      const response = await request(app)
        .post(`/api/transactions/scrape/${bankAccount._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          showBrowser: false,
          startDate: new Date().toISOString()
        });

      expect(response.status).toBe(200);
      expect(response.body.newTransactions).toBeGreaterThan(0);
      expect(response.body.errors).toHaveLength(0);

      // Verify transactions were saved
      const transactions = await Transaction.find({ accountId: bankAccount._id });
      expect(transactions.length).toBeGreaterThan(0);
    });

    it('should handle scraping errors gracefully', async () => {
      // Create an account with invalid credentials
      const invalidAccount = await BankAccount.create({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Invalid Account',
        credentials: {
          username: 'invalid',
          password: 'invalid'
        }
      });

      const response = await request(app)
        .post(`/api/transactions/scrape/${invalidAccount._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          showBrowser: false,
          startDate: new Date().toISOString()
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBeTruthy();
    });
  });

  describe('Scheduled Scraping', () => {
    it('should automatically schedule scraping for new accounts', async () => {
      const newAccount = await BankAccount.create({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'New Test Account',
        credentials: {
          username: 'testuser2',
          password: 'testpass2'
        }
      });

      // Verify that a job was created for the new account
      expect(scrapingSchedulerService.jobs.has(newAccount._id.toString())).toBeTruthy();
    });

    it('should stop scheduling when account is deleted', async () => {
      const response = await request(app)
        .delete(`/api/bank-accounts/${bankAccount._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      // Verify that the job was removed
      expect(scrapingSchedulerService.jobs.has(bankAccount._id.toString())).toBeFalsy();
    });
  });

  describe('Transaction Processing', () => {
    it('should deduplicate transactions', async () => {
      // Trigger scraping twice
      await request(app)
        .post(`/api/transactions/scrape/${bankAccount._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          showBrowser: false,
          startDate: new Date().toISOString()
        });

      const secondResponse = await request(app)
        .post(`/api/transactions/scrape/${bankAccount._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          showBrowser: false,
          startDate: new Date().toISOString()
        });

      expect(secondResponse.body.duplicates).toBeGreaterThan(0);
      expect(secondResponse.body.newTransactions).toBe(0);
    });
  });
});
