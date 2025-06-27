const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { BankAccount, Transaction, User } = require('../../models');
const { createTestUser } = require('../testUtils');
const scrapingSchedulerService = require('../../services/scrapingSchedulerService');

// Mock israeli-bank-scrapers
jest.mock('israeli-bank-scrapers', () => require('../mocks/bankScraper'));

describe('Transaction Scraping Integration Tests', () => {
  let user;
  let token;
  let bankAccount;

  beforeEach(async () => {
    try {
      // Create test user with bank account and wait for it to be saved
      const testData = await createTestUser(User);
      user = testData.user;
      token = testData.token;

      // Create a test bank account with mock scraper's valid credentials
      const { validCredentials } = require('../mocks/bankScraper');
      bankAccount = await BankAccount.create({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Test Account',
        credentials: {
          username: validCredentials.username,
          password: validCredentials.password
        }
      });

      // Verify that both user and bank account were saved
      const savedUser = await User.findById(user._id);
      const savedAccount = await BankAccount.findById(bankAccount._id);
      if (!savedUser || !savedAccount) {
        throw new Error('Failed to create test data');
      }

      // Initialize the scraping scheduler
      await scrapingSchedulerService.initialize();

      // Log setup success
      console.log('Integration test setup complete:', {
        userId: user._id,
        bankAccountId: bankAccount._id,
        hasToken: !!token
      });
    } catch (error) {
      console.error('Failed to set up integration test:', error);
      throw error;
    }
  });

  afterEach(async () => {
    // Clean up
    await User.deleteMany({});
    await BankAccount.deleteMany({});
    await Transaction.deleteMany({});
  });

  afterAll(() => {
    // Stop scheduler
    scrapingSchedulerService.stopAll();
  });

  describe('Integration: Transaction Deduplication', () => {
    it('should handle duplicate transactions across multiple scrapes', async () => {
      console.log('Starting first scrape with token:', token);
      console.log('Bank account ID:', bankAccount._id);
      
      const firstResponse = await request(app)
        .post(`/api/bank-accounts/${bankAccount._id}/scrape`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          showBrowser: false,
          startDate: new Date().toISOString()
        });
        
      console.log('First scrape response:', firstResponse.status, firstResponse.body);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.newTransactions).toBeGreaterThan(0);
      expect(firstResponse.body.duplicates).toBe(0);

      const secondResponse = await request(app)
        .post(`/api/bank-accounts/${bankAccount._id}/scrape`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          showBrowser: false,
          startDate: new Date().toISOString()
        });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.duplicates).toBeGreaterThan(0);
      expect(secondResponse.body.newTransactions).toBe(0);

      // Verify transaction uniqueness in database
      const transactions = await Transaction.find({ accountId: bankAccount._id });
      const uniqueIdentifiers = new Set(transactions.map(t => t.identifier));
      expect(uniqueIdentifiers.size).toBe(transactions.length);
    });
  });

  describe('Service Integration: Scheduling System', () => {
    it('should integrate account creation with scheduler service', async () => {
      const { validCredentials } = require('../mocks/bankScraper');
      const response = await request(app)
        .post('/api/bank-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bankId: 'hapoalim',
          name: 'New Test Account',
          username: validCredentials.username,
          password: validCredentials.password
        });

      expect(response.status).toBe(201);
      const newAccountId = response.body._id;
      console.log('New account created:', newAccountId);
      expect(scrapingSchedulerService.jobs.has(newAccountId.toString())).toBeTruthy();
    });

    it('should integrate account deletion with scheduler service', async () => {
      const response = await request(app)
        .delete(`/api/bank-accounts/${bankAccount._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      // Verify scheduler integration
      expect(scrapingSchedulerService.jobs.has(bankAccount._id.toString())).toBeFalsy();
    });
  });

});
