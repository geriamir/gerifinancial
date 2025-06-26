const mongoose = require('mongoose');
const scrapingSchedulerService = require('../scrapingSchedulerService');
const transactionService = require('../transactionService');
const { BankAccount, User } = require('../../models');
const logger = require('../../utils/logger');

let testUser;

beforeAll(async () => {
  testUser = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123'
  });
});

// Mock dependencies
jest.mock('../transactionService');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));
// Mock node-cron
const mockCronCallback = jest.fn();
const mockStop = jest.fn();
jest.mock('node-cron', () => ({
  schedule: jest.fn((_, callback) => {
    mockCronCallback.mockImplementation(callback);
    return {
      stop: mockStop,
      callback: mockCronCallback
    };
  })
}));

describe('ScrapingSchedulerService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mocks
    logger.info.mockReset();
    logger.error.mockReset();
    // Clear database
    await BankAccount.deleteMany({});
    // Clear scheduler jobs
    scrapingSchedulerService.stopAll();
    scrapingSchedulerService.jobs.clear();
  });

  // Move afterAll inside the describe block to ensure proper order
  afterAll(async () => {
    // Wait for all operations to complete
    await Promise.all([
      User.deleteMany({}),
      BankAccount.deleteMany({})
    ]);
  });

  describe('initialize', () => {
    it('should schedule jobs for all active accounts', async () => {
      // Create test accounts in MongoDB
      const accounts = await BankAccount.create([
        { 
          userId: testUser._id,
          bankId: 'hapoalim',
          name: 'Test Account 1',
          credentials: { username: 'test1', password: 'pass1' },
          status: 'active'
        },
        { 
          userId: testUser._id,
          bankId: 'leumi',
          name: 'Test Account 2',
          credentials: { username: 'test2', password: 'pass2' },
          status: 'active'
        }
      ]);

      await scrapingSchedulerService.initialize();

      // Verify jobs were scheduled
      expect(scrapingSchedulerService.jobs.size).toBe(2);
      accounts.forEach(account => {
        expect(scrapingSchedulerService.jobs.has(account._id.toString())).toBe(true);
      });
      expect(logger.info).toHaveBeenCalledWith('Initialized scraping scheduler with 2 accounts');
    });

    it('should handle initialization errors', async () => {
      // Simulate a DB error by forcing find to reject
      jest.spyOn(BankAccount, 'find').mockRejectedValueOnce(new Error('DB Error'));

      await expect(scrapingSchedulerService.initialize())
        .rejects
        .toThrow('DB Error');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('scheduleAccount', () => {
    it('should create a new scraping job for an account', () => {
      const mockAccount = { 
        _id: '1', 
        bankId: 'hapoalim',
        userId: testUser._id,
        name: 'Test Account',
        credentials: { username: 'test', password: 'pass' },
        status: 'active'
      };
      
      scrapingSchedulerService.scheduleAccount(mockAccount);

      expect(scrapingSchedulerService.jobs.has('1')).toBeTruthy();
      expect(logger.info).toHaveBeenCalledWith('Scheduled scraping job for account 1');
    });
  });

  describe('stopAccount', () => {
    it('should stop and remove a specific job', () => {
      const mockAccount = { 
        _id: '1', 
        bankId: 'hapoalim',
        userId: testUser._id,
        name: 'Test Account',
        credentials: { username: 'test', password: 'pass' },
        status: 'active'
      };
      scrapingSchedulerService.scheduleAccount(mockAccount);
      
      scrapingSchedulerService.stopAccount('1');

      expect(scrapingSchedulerService.jobs.has('1')).toBeFalsy();
      expect(logger.info).toHaveBeenCalledWith('Stopped scraping job for account 1');
    });
  });

  describe('stopAll', () => {
    it('should stop all scheduled jobs', () => {
      const mockAccounts = [
        { 
          _id: '1', 
          bankId: 'hapoalim',
          userId: testUser._id,
          name: 'Test Account 1',
          credentials: { username: 'test1', password: 'pass1' },
          status: 'active'
        },
        { 
          _id: '2', 
          bankId: 'leumi',
          userId: testUser._id,
          name: 'Test Account 2',
          credentials: { username: 'test2', password: 'pass2' },
          status: 'active'
        }
      ];

      mockAccounts.forEach(account => scrapingSchedulerService.scheduleAccount(account));
      
      scrapingSchedulerService.stopAll();

      expect(scrapingSchedulerService.jobs.size).toBe(0);
      expect(logger.info).toHaveBeenCalledTimes(4); // 2 for scheduling, 2 for stopping
    });
  });

  describe('job execution', () => {
    it('should handle scraping errors gracefully', async () => {
      // Setup test data
      const mockAccount = { 
        _id: '1', 
        bankId: 'hapoalim',
        userId: testUser._id,
        name: 'Test Account',
        credentials: { username: 'test', password: 'pass' },
        status: 'active'
      };
      const error = new Error('Scraping failed');
      transactionService.scrapeTransactions.mockRejectedValue(error);

      // Schedule and execute job
      scrapingSchedulerService.scheduleAccount(mockAccount);
      await mockCronCallback();

      expect(logger.error).toHaveBeenCalledWith('Failed to scrape account 1:', error);
    });
  });
});
