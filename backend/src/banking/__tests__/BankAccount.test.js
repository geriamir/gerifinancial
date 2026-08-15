const mongoose = require('mongoose');
const { BankAccount } = require('../models');
const credentialEncryption = require('../../shared/services/credentialEncryption');

// Mock dependencies
jest.mock('../services/bankAccountService');

// Import valid credentials from mock scraper
const { validCredentials } = require('../../test/mocks/bankScraper');

describe('BankAccount Model', () => {
  let mockAccount;

  beforeEach(async () => {
    // Credentials are encrypted with a key that belongs to a specific user, so
    // the owning user has to actually exist.
    const user = await global.createTestUser();
    mockAccount = {
      userId: user._id,
      bankId: 'hapoalim',
      name: 'Test Account',
      credentials: {
        username: validCredentials.username,
        password: validCredentials.password
      },
      status: 'active',
      scrapingConfig: {
        schedule: {
          frequency: 'daily',
          timeOfDay: '03:00'
        }
      }
    };
  });

  describe('Account Management', () => {
    it('should save bank account with encrypted credentials', async () => {
      const account = new BankAccount(mockAccount);
      await account.save();

      const savedAccount = await BankAccount.findById(account._id);
      expect(savedAccount.credentials.password).not.toBe(validCredentials.password);
      expect(credentialEncryption.isEncrypted(savedAccount.credentials.password)).toBe(true);
      expect(
        await credentialEncryption.decryptForUser(
          savedAccount.userId,
          savedAccount.credentials.password
        )
      ).toBe(validCredentials.password);
      expect(savedAccount.status).toBe('active');
    });

    it('should allow status updates', async () => {
      const account = await BankAccount.create(mockAccount);
      account.status = 'disabled';
      await account.save();
      
      const updatedAccount = await BankAccount.findById(account._id);
      expect(updatedAccount.status).toBe('disabled');
    });

    it('should track error state', async () => {
      const account = await BankAccount.create(mockAccount);
      const errorMessage = 'Test error';
      account.lastError = {
        message: errorMessage,
        date: new Date()
      };
      await account.save();

      const updatedAccount = await BankAccount.findById(account._id);
      expect(updatedAccount.lastError.message).toBe(errorMessage);
    });
  });

  describe('Next Scraping Time Calculation', () => {
    it('should calculate next daily scraping time correctly', async () => {
      const account = await BankAccount.create(mockAccount);
      const nextTime = account.getNextScrapingTime();
      
      expect(nextTime).toBeInstanceOf(Date);
      expect(nextTime.getHours()).toBe(3); // 03:00
      expect(nextTime.getMinutes()).toBe(0);
      
      // Should be either today (if before 3 AM) or tomorrow
      const now = new Date();
      const expectedDate = new Date(now);
      
      if (now.getHours() >= 3) {
        // Add 1 day, handling month boundaries properly
        expectedDate.setDate(now.getDate() + 1);
      }
      
      expect(nextTime.getDate()).toBe(expectedDate.getDate());
      expect(nextTime.getMonth()).toBe(expectedDate.getMonth());
      expect(nextTime.getFullYear()).toBe(expectedDate.getFullYear());
    });

    it('should calculate next weekly scraping time correctly', async () => {
      mockAccount.scrapingConfig.schedule.frequency = 'weekly';
      mockAccount.scrapingConfig.schedule.dayOfWeek = 1; // Monday
      
      const account = await BankAccount.create(mockAccount);
      const nextTime = account.getNextScrapingTime();
      
      expect(nextTime.getDay()).toBe(1); // Monday
      expect(nextTime.getHours()).toBe(3);
      expect(nextTime.getMinutes()).toBe(0);
    });

    it('should calculate next monthly scraping time correctly', async () => {
      mockAccount.scrapingConfig.schedule.frequency = 'monthly';
      mockAccount.scrapingConfig.schedule.dayOfMonth = 15;
      
      const account = await BankAccount.create(mockAccount);
      const nextTime = account.getNextScrapingTime();
      
      expect(nextTime.getDate()).toBe(15);
      expect(nextTime.getHours()).toBe(3);
      expect(nextTime.getMinutes()).toBe(0);
    });
  });

  describe('Scraper Options', () => {
    it('should generate correct scraper options', async () => {
      const account = await BankAccount.create(mockAccount);
      
      const options = await account.getScraperOptions();
      expect(options).toEqual({
        companyId: 'hapoalim',
        credentials: {
          username: validCredentials.username,
          password: validCredentials.password
        },
        startDate: expect.any(Date),
        showBrowser: false,
        verbose: false
      });
    });

    it('should map and decrypt Isracard credentials for the scraper', async () => {
      const account = await BankAccount.create({
        ...mockAccount,
        bankId: 'isracard',
        credentials: {
          username: validCredentials.username,
          password: validCredentials.password,
          card6Digits: validCredentials.card6Digits
        }
      });

      const savedAccount = await BankAccount.findById(account._id);
      expect(savedAccount.credentials.card6Digits).not.toBe(validCredentials.card6Digits);
      expect(credentialEncryption.isEncrypted(savedAccount.credentials.card6Digits)).toBe(true);
      expect((await savedAccount.getScraperOptions()).credentials).toEqual({
        id: validCredentials.username,
        card6Digits: validCredentials.card6Digits,
        password: validCredentials.password
      });
    });

    it('should default first-time scraping to the past year', async () => {
      const before = new Date();
      before.setMonth(before.getMonth() - 12);
      const account = await BankAccount.create(mockAccount);
      const defaultStartDate = account.getDefaultStartDate();
      const after = new Date();
      after.setMonth(after.getMonth() - 12);

      expect(account.scrapingConfig.options.monthsBack).toBe(12);
      expect(account.scrapingConfig.options.startDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(account.scrapingConfig.options.startDate.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(defaultStartDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(defaultStartDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Default Currency', () => {
    it('should set ILS as default currency when not specified', async () => {
      const account = await BankAccount.create(mockAccount);
      expect(account.defaultCurrency).toBe('ILS');
    });

    it('should allow custom default currency', async () => {
      mockAccount.defaultCurrency = 'USD';
      const account = await BankAccount.create(mockAccount);
      expect(account.defaultCurrency).toBe('USD');
    });
  });

  describe('JSON Transformation', () => {
    it('should remove sensitive data when converting to JSON', async () => {
      const account = await BankAccount.create(mockAccount);
      const json = account.toJSON();

      expect(json.credentials).toBeDefined();
      expect(json.credentials.username).toBe(mockAccount.credentials.username);
      expect(json.credentials.password).toBeUndefined();
      expect(json.credentials.card6Digits).toBeUndefined();
      expect(json.bankId).toBe(mockAccount.bankId);
      expect(json.name).toBe(mockAccount.name);
    });
  });
});
