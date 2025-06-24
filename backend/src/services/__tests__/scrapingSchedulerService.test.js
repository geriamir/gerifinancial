const scrapingSchedulerService = require('../scrapingSchedulerService');
const transactionService = require('../transactionService');
const { BankAccount } = require('../../models');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('../transactionService');
jest.mock('../../models');
jest.mock('../../utils/logger');
jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    stop: jest.fn()
  })
}));

describe('ScrapingSchedulerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should schedule jobs for all active accounts', async () => {
      const mockAccounts = [
        { _id: '1', bankId: 'bank1', isActive: true },
        { _id: '2', bankId: 'bank2', isActive: true }
      ];

      BankAccount.find.mockResolvedValue(mockAccounts);

      await scrapingSchedulerService.initialize();

      expect(BankAccount.find).toHaveBeenCalledWith({ isActive: true });
      expect(scrapingSchedulerService.jobs.size).toBe(2);
      expect(logger.info).toHaveBeenCalledWith('Initialized scraping scheduler with 2 accounts');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('DB Error');
      BankAccount.find.mockRejectedValue(error);

      await expect(scrapingSchedulerService.initialize()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize scraping scheduler:', error);
    });
  });

  describe('scheduleAccount', () => {
    it('should create a new scraping job for an account', () => {
      const mockAccount = { _id: '1', bankId: 'bank1' };
      
      scrapingSchedulerService.scheduleAccount(mockAccount);

      expect(scrapingSchedulerService.jobs.has('1')).toBeTruthy();
      expect(logger.info).toHaveBeenCalledWith('Scheduled scraping job for account 1');
    });
  });

  describe('stopAccount', () => {
    it('should stop and remove a specific job', () => {
      const mockAccount = { _id: '1', bankId: 'bank1' };
      scrapingSchedulerService.scheduleAccount(mockAccount);
      
      scrapingSchedulerService.stopAccount('1');

      expect(scrapingSchedulerService.jobs.has('1')).toBeFalsy();
      expect(logger.info).toHaveBeenCalledWith('Stopped scraping job for account 1');
    });
  });

  describe('stopAll', () => {
    it('should stop all scheduled jobs', () => {
      const mockAccounts = [
        { _id: '1', bankId: 'bank1' },
        { _id: '2', bankId: 'bank2' }
      ];

      mockAccounts.forEach(account => scrapingSchedulerService.scheduleAccount(account));
      
      scrapingSchedulerService.stopAll();

      expect(scrapingSchedulerService.jobs.size).toBe(0);
      expect(logger.info).toHaveBeenCalledTimes(4); // 2 for scheduling, 2 for stopping
    });
  });

  describe('job execution', () => {
    it('should handle scraping errors gracefully', async () => {
      const mockAccount = { _id: '1', bankId: 'bank1' };
      const error = new Error('Scraping failed');
      
      transactionService.scrapeTransactions.mockRejectedValue(error);
      
      // Manually trigger the job callback
      const job = scrapingSchedulerService.scheduleAccount(mockAccount);
      await job.callback();

      expect(logger.error).toHaveBeenCalledWith('Failed to scrape account 1:', error);
    });
  });
});
