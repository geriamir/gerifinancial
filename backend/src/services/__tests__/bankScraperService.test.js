const bankScraperService = require('../bankScraperService');
const { mockTransactions } = require('../../test/mocks/bankScraper');

// bankScraperService handles the mocking automatically based on NODE_ENV

describe('BankScraperService', () => {
  const mockBankAccount = {
    _id: 'test-account-1',
    bankId: 'hapoalim',
    credentials: {
      username: 'testuser',
      password: 'bankpass123'
    },
    lastScraped: null, // Simulate first scrape
    getScraperOptions: () => ({
      credentials: {
        username: 'testuser',
        password: 'bankpass123'
      },
      startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 6 months back for first scrape
    })
  };

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const scraper = await bankScraperService.login(mockBankAccount);
      expect(scraper).toBeDefined();
    });

    it('should retry on login failure', async () => {
      const badAccount = {
        ...mockBankAccount,
        credentials: {
          username: 'retry-test',
          password: 'pass'
        },
        getScraperOptions: () => ({
          credentials: {
            username: 'retry-test',
            password: 'pass'
          },
          startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
        })
      };

      await expect(bankScraperService.login(badAccount))
        .rejects
        .toThrow('Login failed');
    });

    it('should fail after max retries', async () => {
      const invalidAccount = {
        ...mockBankAccount,
        credentials: {
          username: 'invalid',
          password: 'invalid'
        },
        getScraperOptions: () => ({
          credentials: {
            username: 'invalid',
            password: 'invalid'
          },
          startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
        })
      };

      await expect(bankScraperService.login(invalidAccount))
        .rejects
        .toThrow('Login failed: Invalid bank credentials');
    });
  });

  describe('scrapeTransactions', () => {
    it('should successfully scrape transactions', async () => {
      const result = await bankScraperService.scrapeTransactions(mockBankAccount);
      expect(result.accounts[0].txns).toEqual(mockTransactions);
    });

    it('should retry on scraping failure', async () => {
      const errorAccount = {
        ...mockBankAccount,
        bankId: 'error_bank'
      };

      await expect(bankScraperService.scrapeTransactions(errorAccount))
        .rejects
        .toThrow('Bank API is temporarily unavailable');
    });
  });

  describe('validateCredentials', () => {
    it('should validate correct credentials', async () => {
      const result = await bankScraperService.validateCredentials('hapoalim', {
        username: 'testuser',
        password: 'bankpass123'
      });
      expect(result).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      await expect(bankScraperService.validateCredentials('hapoalim', {
        username: 'invalid',
        password: 'invalid'
      })).rejects.toThrow('Login failed: Invalid bank credentials');
    });
  });

  describe('testConnection', () => {
    it('should successfully test valid connection', async () => {
      const result = await bankScraperService.testConnection(mockBankAccount);
      expect(result).toBe(true);
    });

    it('should fail test for invalid connection', async () => {
      const invalidAccount = {
        ...mockBankAccount,
        credentials: {
          username: 'invalid',
          password: 'invalid'
        },
        getScraperOptions: () => ({
          credentials: {
            username: 'invalid',
            password: 'invalid'
          },
          startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
        })
      };

      await expect(bankScraperService.testConnection(invalidAccount))
        .rejects
        .toThrow('Login failed: Invalid bank credentials');
    });
  });
});
