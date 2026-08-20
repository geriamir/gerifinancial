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
    // Credentials are encrypted with a key that belongs to a specific user, so
    // the owning user has to actually exist.
    const user = await global.createTestUser();
    userId = user._id;
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

    it('can defer credential validation to the initial background scrape', async () => {
      const account = await bankAccountService.create(
        userId,
        mockAccountData,
        { deferCredentialValidation: true }
      );

      expect(bankScraperService.validateCredentials).not.toHaveBeenCalled();
      expect(account.status).toBe('active');
      expect(eventListeners.accountCreated).toHaveBeenCalledWith(
        expect.objectContaining({ _id: account._id })
      );
    });

    it('should validate and store Isracard last-six credentials', async () => {
      bankScraperService.validateCredentials.mockResolvedValueOnce(true);

      const account = await bankAccountService.create(userId, {
        ...mockAccountData,
        bankId: 'isracard',
        card6Digits: validCredentials.card6Digits
      });

      expect(bankScraperService.validateCredentials).toHaveBeenCalledWith('isracard', {
        id: validCredentials.username,
        card6Digits: validCredentials.card6Digits,
        password: validCredentials.password
      });
      expect((await account.getScraperOptions()).credentials).toEqual({
        id: validCredentials.username,
        card6Digits: validCredentials.card6Digits,
        password: validCredentials.password
      });
    });

    it('should reject Isracard credentials without exactly six card digits', async () => {
      await expect(bankAccountService.create(userId, {
        ...mockAccountData,
        bankId: 'isracard',
        card6Digits: '12345'
      })).rejects.toThrow('Last 6 card digits must be exactly 6 digits');

      expect(bankScraperService.validateCredentials).not.toHaveBeenCalled();
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

  describe('updateCredentials', () => {
    it('can defer validation and queue the credential retry immediately', async () => {
      const account = await BankAccount.create({
        userId,
        bankId: mockAccountData.bankId,
        name: mockAccountData.name,
        credentials: {
          username: mockAccountData.username,
          password: mockAccountData.password
        },
        status: 'error'
      });
      queuedDataSyncService.queueBankAccountSync.mockResolvedValueOnce();

      const updatedAccount = await bankAccountService.updateCredentials(
        account._id,
        userId,
        {
          username: 'new-user',
          password: 'new-password'
        },
        {
          requireQueuedSync: true,
          deferCredentialValidation: true
        }
      );

      expect(bankScraperService.validateCredentials).not.toHaveBeenCalled();
      expect(queuedDataSyncService.queueBankAccountSync)
        .toHaveBeenCalledWith(account._id, { priority: 'high' });
      expect(updatedAccount.status).toBe('active');
      expect((await updatedAccount.getScraperOptions()).credentials).toEqual({
        username: 'new-user',
        password: 'new-password'
      });
    });

    it('surfaces a required retry queue failure without leaving the account active', async () => {
      const account = await BankAccount.create({
        userId,
        bankId: mockAccountData.bankId,
        name: mockAccountData.name,
        credentials: {
          username: mockAccountData.username,
          password: mockAccountData.password
        },
        status: 'error'
      });
      bankScraperService.validateCredentials.mockResolvedValueOnce(true);
      queuedDataSyncService.queueBankAccountSync.mockRejectedValueOnce(new Error('Queue unavailable'));

      await expect(bankAccountService.updateCredentials(
        account._id,
        userId,
        {
          username: 'new-user',
          password: 'new-password'
        },
        { requireQueuedSync: true }
      )).rejects.toMatchObject({
        code: 'SYNC_QUEUE_FAILED',
        message: expect.stringContaining('Queue unavailable')
      });

      const updatedAccount = await BankAccount.findById(account._id);
      expect(updatedAccount.status).toBe('error');
      expect(updatedAccount.lastError.message)
        .toBe('Credentials were updated, but the automatic import retry could not be started');
      expect((await updatedAccount.getScraperOptions()).credentials).toEqual({
        username: 'new-user',
        password: 'new-password'
      });
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
      const DAY_MS = 24 * 60 * 60 * 1000;
      const pastDate = new Date(Date.now() - 60 * DAY_MS);
      const recentDate = new Date(Date.now() - 10 * DAY_MS);
      const futureDate = new Date(Date.now() + 30 * DAY_MS);

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
