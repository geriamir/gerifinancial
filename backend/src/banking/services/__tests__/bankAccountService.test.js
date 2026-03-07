const mongoose = require('mongoose');
const { BankAccount, Transaction } = require('../../models');
const bankAccountService = require('../bankAccountService');
const bankScraperService = require('../bankScraperService');
const queuedDataSyncService = require('../queuedDataSyncService');
const logger = require('../../../shared/utils/logger');

// Mock dependencies
jest.mock('../bankScraperService');
jest.mock('../queuedDataSyncService', () => ({
  queueBankAccountSync: jest.fn()
}));
jest.mock('../../../shared/utils/logger');

// Import valid credentials from mock scraper
const { validCredentials } = require('../../../test/mocks/bankScraper');

describe('BankAccountService', () => {
  let mockAccountData;
  let userId;
  let eventListeners;

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
    
    // Setup event listeners to capture emitted events
    eventListeners = {
      accountCreated: jest.fn(),
      accountDeleted: jest.fn(),
      accountActivated: jest.fn(),
      accountDeactivated: jest.fn()
    };
    
    // Listen for events
    bankAccountService.events.on('accountCreated', eventListeners.accountCreated);
    bankAccountService.events.on('accountDeleted', eventListeners.accountDeleted);
    bankAccountService.events.on('accountActivated', eventListeners.accountActivated);
    bankAccountService.events.on('accountDeactivated', eventListeners.accountDeactivated);
  });

  afterEach(() => {
    // Clean up event listeners
    bankAccountService.events.removeAllListeners();
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

      // Verify accountCreated event was emitted
      expect(eventListeners.accountCreated).toHaveBeenCalledWith(
        expect.objectContaining({ _id: account._id })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Emitted accountCreated event for new bank account: ${account._id}`)
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

      // Verify no event was emitted
      expect(eventListeners.accountCreated).not.toHaveBeenCalled();
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

      // Verify accountDeleted event was emitted
      expect(eventListeners.accountDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: account._id })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Emitted accountDeleted event for bank account: ${account._id}`)
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

      // Verify no event was emitted for inactive accounts
      expect(eventListeners.accountDeleted).not.toHaveBeenCalled();
    });

    it('should return null if account not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const result = await bankAccountService.delete(nonExistentId, userId);

      expect(result).toBeNull();
      expect(eventListeners.accountDeleted).not.toHaveBeenCalled();
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

      // Verify accountActivated event was emitted
      expect(eventListeners.accountActivated).toHaveBeenCalledWith(
        expect.objectContaining({ _id: account._id })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Emitted accountActivated event for bank account: ${account._id}`)
      );
    });

    it('should deactivate account and stop scraping', async () => {
      // First activate the account
      account.status = 'active';
      await account.save();

      const updatedAccount = await bankAccountService.updateStatus(account._id, userId, 'disabled');

      // Verify status update
      expect(updatedAccount.status).toBe('disabled');

      // Verify accountDeactivated event was emitted
      expect(eventListeners.accountDeactivated).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: account._id })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Emitted accountDeactivated event for bank account: ${account._id}`)
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

      // Verify no events were emitted for error case
      expect(eventListeners.accountActivated).not.toHaveBeenCalled();
    });

    it('should return null if account not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const result = await bankAccountService.updateStatus(nonExistentId, userId, 'active');

      expect(result).toBeNull();
      expect(bankScraperService.testConnection).not.toHaveBeenCalled();
      expect(eventListeners.accountActivated).not.toHaveBeenCalled();
    });
  });

  describe('recoverMissingTransactions', () => {
    let account;

    beforeEach(async () => {
      account = await BankAccount.create({
        userId,
        bankId: 'hapoalim',
        name: 'Recovery Test Account',
        credentials: { username: 'user', password: 'pass' },
        status: 'active',
        lastScraped: new Date('2026-03-01')
      });

      queuedDataSyncService.queueBankAccountSync.mockResolvedValue({
        queuedJobs: 1,
        totalJobs: 1
      });
    });

    it('should set lastScraped to latest non-future transaction date', async () => {
      const pastDate = new Date('2026-02-20');
      const recentDate = new Date('2026-03-05');
      const futureDate = new Date('2026-04-15');

      await Transaction.create([
        { identifier: 'tx-past', userId, accountId: account._id, amount: -100, currency: 'ILS', date: pastDate, type: 'Expense', description: 'Past', rawData: {} },
        { identifier: 'tx-recent', userId, accountId: account._id, amount: -200, currency: 'ILS', date: recentDate, type: 'Expense', description: 'Recent', rawData: {} },
        { identifier: 'tx-future', userId, accountId: account._id, amount: -50, currency: 'ILS', date: futureDate, type: 'Expense', description: 'Future installment', rawData: {} }
      ]);

      const result = await bankAccountService.recoverMissingTransactions(account._id, userId);

      expect(result.correctedLastScraped).toEqual(recentDate);

      const updated = await BankAccount.findById(account._id);
      expect(updated.lastScraped).toEqual(recentDate);
    });

    it('should also reset strategy-level lastScraped dates', async () => {
      account.strategySync = {
        'checking-accounts': { lastScraped: new Date('2026-03-01'), lastAttempted: new Date(), status: 'success' },
        'investment-portfolios': { lastScraped: new Date('2026-03-01'), lastAttempted: new Date(), status: 'success' }
      };
      account.markModified('strategySync');
      await account.save();

      const recentDate = new Date('2026-03-04');
      await Transaction.create({
        identifier: 'tx-strat', userId, accountId: account._id, amount: -100, currency: 'ILS', date: recentDate, type: 'Expense', description: 'Test', rawData: {}
      });

      await bankAccountService.recoverMissingTransactions(account._id, userId);

      const updated = await BankAccount.findById(account._id);
      expect(updated.strategySync['checking-accounts'].lastScraped).toEqual(recentDate);
      expect(updated.strategySync['investment-portfolios'].lastScraped).toEqual(recentDate);
    });

    it('should fall back to 6 months ago when no transactions exist', async () => {
      const before = new Date();
      before.setMonth(before.getMonth() - 6);

      const result = await bankAccountService.recoverMissingTransactions(account._id, userId);

      // Should be approximately 6 months ago (within a few seconds)
      expect(result.correctedLastScraped.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5000);
      expect(result.correctedLastScraped.getTime()).toBeLessThanOrEqual(Date.now());
      expect(result.latestTransactionDate).toBeNull();
    });

    it('should not set lastScraped to a future date when only future transactions exist', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await Transaction.create({
        identifier: 'tx-only-future', userId, accountId: account._id, amount: -100, currency: 'ILS', date: futureDate, type: 'Expense', description: 'Future only', rawData: {}
      });

      const before = new Date();
      before.setMonth(before.getMonth() - 6);

      const result = await bankAccountService.recoverMissingTransactions(account._id, userId);

      // No non-future transaction found, should fall back to ~6 months ago
      expect(result.correctedLastScraped.getTime()).toBeLessThanOrEqual(Date.now());
      expect(result.correctedLastScraped.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5000);
    });
  });
});
