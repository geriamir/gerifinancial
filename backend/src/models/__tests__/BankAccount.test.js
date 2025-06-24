const mongoose = require('mongoose');
const { BankAccount } = require('../../models');
const scrapingSchedulerService = require('../../services/scrapingSchedulerService');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('../../services/scrapingSchedulerService');
jest.mock('../../utils/logger');

describe('BankAccount Model', () => {
  let mockAccount;

  beforeEach(async () => {
    mockAccount = {
      userId: new mongoose.Types.ObjectId(),
      bankId: 'hapoalim',
      name: 'Test Account',
      credentials: {
        username: 'testuser',
        password: 'testpass'
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

  describe('Schedule Management', () => {
    it('should schedule scraping when account is created with active status', async () => {
      const account = await BankAccount.create(mockAccount);
      
      expect(scrapingSchedulerService.scheduleAccount).toHaveBeenCalledWith(
        expect.objectContaining({ _id: account._id })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Scheduled scraping for bank account: ${account._id}`)
      );
    });

    it('should not schedule scraping for non-active accounts', async () => {
      mockAccount.status = 'pending';
      await BankAccount.create(mockAccount);
      
      expect(scrapingSchedulerService.scheduleAccount).not.toHaveBeenCalled();
    });

    it('should stop scheduling when account is disabled', async () => {
      const account = await BankAccount.create(mockAccount);
      
      await BankAccount.findByIdAndUpdate(account._id, {
        $set: { status: 'disabled' }
      });

      expect(scrapingSchedulerService.stopAccount).toHaveBeenCalledWith(account._id);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Stopped scraping for bank account: ${account._id}`)
      );
    });

    it('should handle scheduling errors gracefully', async () => {
      scrapingSchedulerService.scheduleAccount.mockRejectedValueOnce(new Error('Scheduling failed'));
      
      await BankAccount.create(mockAccount);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to schedule scraping for bank account'),
        expect.any(Error)
      );
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
      if (now.getHours() >= 3) {
        expect(nextTime.getDate()).toBe(now.getDate() + 1);
      } else {
        expect(nextTime.getDate()).toBe(now.getDate());
      }
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
      const options = account.getScraperOptions();

      expect(options).toEqual({
        companyId: 'hapoalim',
        credentials: {
          username: 'testuser',
          password: 'testpass'
        },
        startDate: expect.any(Date),
        showBrowser: false,
        verbose: false
      });
    });
  });

  describe('JSON Transformation', () => {
    it('should remove sensitive data when converting to JSON', async () => {
      const account = await BankAccount.create(mockAccount);
      const json = account.toJSON();

      expect(json.credentials).toBeUndefined();
      expect(json.bankId).toBe(mockAccount.bankId);
      expect(json.name).toBe(mockAccount.name);
    });
  });
});
