const bankScraperService = require('../../../banking/services/bankScraperService');
const { mockTransactions } = require('../../../test/mocks/bankScraper');

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

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

    it('initializes the scraper before logging in', async () => {
      const scraper = {
        initialize: jest.fn().mockResolvedValue(undefined),
        login: jest.fn().mockResolvedValue({ success: true })
      };
      jest.spyOn(bankScraperService, 'createScraper').mockReturnValue(scraper);

      await bankScraperService.login(mockBankAccount);

      expect(scraper.initialize).toHaveBeenCalledTimes(1);
      expect(scraper.login).toHaveBeenCalledTimes(1);
      expect(scraper.initialize.mock.invocationCallOrder[0])
        .toBeLessThan(scraper.login.mock.invocationCallOrder[0]);
    });

    it('rejects an unsuccessful scraper login result', async () => {
      const originalMaxRetries = bankScraperService.MAX_RETRIES;
      const scraper = {
        initialize: jest.fn().mockResolvedValue(undefined),
        login: jest.fn().mockResolvedValue({
          success: false,
          errorType: 'CHANGE_PASSWORD'
        }),
        terminate: jest.fn().mockResolvedValue(undefined)
      };
      jest.spyOn(bankScraperService, 'createScraper').mockReturnValue(scraper);
      bankScraperService.MAX_RETRIES = 1;

      try {
        await expect(bankScraperService.login(mockBankAccount)).rejects.toThrow(
          'Login failed: The bank requires a password change'
        );
        expect(scraper.terminate).toHaveBeenCalledWith(false);
      } finally {
        bankScraperService.MAX_RETRIES = originalMaxRetries;
      }
    });
  });

  // REMOVED: scrapeTransactions tests
  // The comprehensive scrapeTransactions method has been replaced with isolated sync methods
  // in dataSyncService. Tests for the new isolated approach are covered in dataSyncService.test.js

  describe('validateCredentials', () => {
    it('should validate correct credentials', async () => {
      const result = await bankScraperService.validateCredentials('hapoalim', {
        username: 'testuser',
        password: 'bankpass123'
      });
      expect(result).toBe(true);
    });

    it('closes the temporary scraper after validation', async () => {
      const scraper = {
        initialize: jest.fn().mockResolvedValue(undefined),
        login: jest.fn().mockResolvedValue({ success: true }),
        terminate: jest.fn().mockResolvedValue(undefined)
      };
      jest.spyOn(bankScraperService, 'createScraper').mockReturnValue(scraper);

      await bankScraperService.validateCredentials('hapoalim', {
        username: 'testuser',
        password: 'bankpass123'
      });

      expect(scraper.terminate).toHaveBeenCalledWith(true);
    });

    it('should reject invalid credentials', async () => {
      await expect(bankScraperService.validateCredentials('hapoalim', {
        username: 'invalid',
        password: 'invalid'
      })).rejects.toThrow('Login failed: Invalid bank credentials');
    });

    it.each(['isracard', 'amex'])('should preserve %s-specific credential fields', async (bankId) => {
      const result = await bankScraperService.validateCredentials(bankId, {
        id: 'testuser',
        card6Digits: '123456',
        password: 'bankpass123'
      });

      expect(result).toBe(true);
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
