const mongoose = require('mongoose');
const { BankAccount } = require('../../models');
const bankAccountService = require('../bankAccountService');
const scrapingSchedulerService = require('../scrapingSchedulerService');
const bankScraperService = require('../bankScraperService');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('../scrapingSchedulerService');
jest.mock('../bankScraperService');
jest.mock('../../utils/logger');

// Import valid credentials from mock scraper
const { validCredentials } = require('../../test/mocks/bankScraper');

describe('BankAccountService', () => {
  let mockAccountData;
  let userId;

  beforeEach(async () => {
    userId = new mongoose.Types.ObjectId();
    mockAccountData = {
      bankId: 'hapoalim',
      name: 'Test Account',
      username: validCredentials.username,
      password: validCredentials.password
    };
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create bank account and schedule scraping', async () => {
      // Setup mock for credential validation
      bankScraperService.validateCredentials.mockResolvedValueOnce(true);

      const account = await bankAccountService.create(userId, mockAccountData);

      // Verify account creation
      expect(account).toBeDefined();
      expect(account.userId).toEqual(userId);
      expect(account.bankId).toBe(mockAccountData.bankId);
      expect(account.name).toBe(mockAccountData.name);
      expect(account.status).toBe('active');

      // Verify credential validation was called
      expect(bankScraperService.validateCredentials).toHaveBeenCalledWith(
        mockAccountData.bankId,
        {
          username: mockAccountData.username,
          password: mockAccountData.password
        }
      );

      // Verify scraping was scheduled
      expect(scrapingSchedulerService.scheduleAccount).toHaveBeenCalledWith(
        expect.objectContaining({ _id: account._id })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Scheduled scraping for new bank account: ${account._id}`)
      );
    });

    it('should throw error if credential validation fails', async () => {
      // Setup mock for credential validation failure
      const errorMessage = 'Invalid credentials';
      bankScraperService.validateCredentials.mockRejectedValueOnce(new Error(errorMessage));

      await expect(bankAccountService.create(userId, mockAccountData))
        .rejects.toThrow(errorMessage);

      // Verify no account was created
      const accounts = await BankAccount.find({ userId });
      expect(accounts).toHaveLength(0);

      // Verify scraping was not scheduled
      expect(scrapingSchedulerService.scheduleAccount).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete account and stop scraping if active', async () => {
      // Create test account
      const account = await BankAccount.create({
        userId,
        bankId: mockAccountData.bankId,
        name: mockAccountData.name,
        credentials: {
          username: mockAccountData.username,
          password: mockAccountData.password
        },
        status: 'active'
      });

      const result = await bankAccountService.delete(account._id, userId);

      // Verify deletion
      expect(result).toBe(true);
      const deletedAccount = await BankAccount.findById(account._id);
      expect(deletedAccount).toBeNull();

      // Verify scraping was stopped
      expect(scrapingSchedulerService.stopAccount).toHaveBeenCalledWith(account._id);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Stopped scraping for deleted bank account: ${account._id}`)
      );
    });

    it('should not stop scraping for inactive accounts', async () => {
      // Create test account with inactive status
      const account = await BankAccount.create({
        userId,
        bankId: mockAccountData.bankId,
        name: mockAccountData.name,
        credentials: {
          username: mockAccountData.username,
          password: mockAccountData.password
        },
        status: 'disabled'
      });

      await bankAccountService.delete(account._id, userId);

      // Verify scraping was not stopped
      expect(scrapingSchedulerService.stopAccount).not.toHaveBeenCalled();
    });

    it('should return null if account not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const result = await bankAccountService.delete(nonExistentId, userId);

      expect(result).toBeNull();
      expect(scrapingSchedulerService.stopAccount).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    let account;

    beforeEach(async () => {
      // Create test account
      account = await BankAccount.create({
        userId,
        bankId: mockAccountData.bankId,
        name: mockAccountData.name,
        credentials: {
          username: mockAccountData.username,
          password: mockAccountData.password
        },
        status: 'disabled'
      });
    });

    it('should activate account and schedule scraping', async () => {
      // Setup mock for connection test
      bankScraperService.testConnection.mockResolvedValueOnce(true);

      const updatedAccount = await bankAccountService.updateStatus(account._id, userId, 'active');

      // Verify status update
      expect(updatedAccount.status).toBe('active');
      expect(updatedAccount.get('lastError')).toBeNull();

      // Verify connection was tested
      expect(bankScraperService.testConnection).toHaveBeenCalledWith(
        expect.objectContaining({ _id: account._id })
      );

      // Verify scraping was scheduled
      expect(scrapingSchedulerService.scheduleAccount).toHaveBeenCalledWith(
        expect.objectContaining({ _id: account._id })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Scheduled scraping for activated bank account: ${account._id}`)
      );
    });

    it('should deactivate account and stop scraping', async () => {
      // First activate the account
      account.status = 'active';
      await account.save();

      const updatedAccount = await bankAccountService.updateStatus(account._id, userId, 'disabled');

      // Verify status update
      expect(updatedAccount.status).toBe('disabled');

      // Verify scraping was stopped
      expect(scrapingSchedulerService.stopAccount).toHaveBeenCalledWith(account._id);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Stopped scraping for deactivated bank account: ${account._id}`)
      );
    });

    it('should handle connection test failure', async () => {
      // Setup mock for connection test failure
      const errorMessage = 'Connection failed';
      bankScraperService.testConnection.mockRejectedValueOnce(new Error(errorMessage));

      await expect(bankAccountService.updateStatus(account._id, userId, 'active'))
        .rejects.toThrow(errorMessage);

      // Verify account status was set to error
      const errorAccount = await BankAccount.findById(account._id);
      expect(errorAccount.status).toBe('error');
      expect(errorAccount.lastError).toBeDefined();
      expect(errorAccount.lastError.message).toBe(errorMessage);

      // Verify scraping was not scheduled
      expect(scrapingSchedulerService.scheduleAccount).not.toHaveBeenCalled();
    });

    it('should return null if account not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const result = await bankAccountService.updateStatus(nonExistentId, userId, 'active');

      expect(result).toBeNull();
      expect(bankScraperService.testConnection).not.toHaveBeenCalled();
      expect(scrapingSchedulerService.scheduleAccount).not.toHaveBeenCalled();
    });
  });
});
