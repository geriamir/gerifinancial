const mongoose = require('mongoose');
const { RSUGrant } = require('../../models');

describe('RSUGrant Model', () => {
  let mockGrant;

  beforeEach(async () => {
    mockGrant = {
      userId: new mongoose.Types.ObjectId(),
      stockSymbol: 'MSFT',
      name: 'Microsoft Grant 2024',
      company: 'Microsoft Corporation',
      grantDate: new Date('2024-01-15'),
      totalValue: 100000,
      totalShares: 1000,
      pricePerShare: 100,
      currentPrice: 120,
      currentValue: 120000,
      status: 'active',
      notes: 'Initial RSU grant'
    };
  });

  describe('Model Creation and Validation', () => {
    it('should create a valid RSU grant with all fields', async () => {
      // Add required vestingSchedule
      mockGrant.vestingSchedule = [{
        vestDate: new Date('2024-04-15'),
        shares: 250,
        vested: false,
        vestedValue: 0
      }];
      
      const grant = new RSUGrant(mockGrant);
      await grant.save();

      expect(grant.stockSymbol).toBe('MSFT');
      expect(grant.name).toBe('Microsoft Grant 2024');
      expect(grant.company).toBe('Microsoft Corporation');
      expect(grant.totalValue).toBe(100000);
      expect(grant.totalShares).toBe(1000);
      expect(grant.pricePerShare).toBe(100);
      expect(grant.currentPrice).toBe(120);
      expect(grant.status).toBe('active');
    });

    it('should create a grant with minimal required fields', async () => {
      const minimalGrant = {
        userId: new mongoose.Types.ObjectId(),
        stockSymbol: 'AAPL',
        grantDate: new Date('2024-01-01'),
        totalValue: 50000,
        totalShares: 500,
        pricePerShare: 100, // Required field
        vestingSchedule: [{
          vestDate: new Date('2024-04-01'),
          shares: 125,
          vested: false,
          vestedValue: 0
        }]
      };

      const grant = new RSUGrant(minimalGrant);
      await grant.save();

      expect(grant.stockSymbol).toBe('AAPL');
      expect(grant.status).toBe('active'); // Default value
      expect(grant.currentPrice).toBe(0); // Default value
    });

    it('should validate required fields', async () => {
      const invalidGrant = new RSUGrant({
        userId: new mongoose.Types.ObjectId(),
        // Missing required fields
      });

      await expect(invalidGrant.save()).rejects.toThrow();
    });

    it('should uppercase stock symbol', async () => {
      mockGrant.stockSymbol = 'msft';
      mockGrant.vestingSchedule = [{
        vestDate: new Date('2024-04-15'),
        shares: 250,
        vested: false,
        vestedValue: 0
      }];
      const grant = new RSUGrant(mockGrant);
      await grant.save();

      expect(grant.stockSymbol).toBe('MSFT');
    });

    it('should validate total shares as integer', async () => {
      mockGrant.totalShares = 100.5;
      mockGrant.vestingSchedule = [];
      const grant = new RSUGrant(mockGrant);

      await expect(grant.save()).rejects.toThrow();
    });

    it('should validate positive amounts', async () => {
      mockGrant.totalValue = -1000;
      mockGrant.vestingSchedule = [];
      const grant = new RSUGrant(mockGrant);

      await expect(grant.save()).rejects.toThrow();
    });
  });

  describe('Pre-save Middleware', () => {
    beforeEach(() => {
      mockGrant.vestingSchedule = [{
        vestDate: new Date('2024-04-15'),
        shares: 250,
        vested: false,
        vestedValue: 0
      }];
    });

    it('should calculate price per share automatically', async () => {
      const grant = new RSUGrant(mockGrant);
      await grant.save();

      expect(grant.pricePerShare).toBe(100); // 100000 / 1000
    });

    it('should calculate current value automatically', async () => {
      const grant = new RSUGrant(mockGrant);
      await grant.save();

      expect(grant.currentValue).toBe(120000); // 1000 * 120
    });

    it('should handle zero current price', async () => {
      mockGrant.currentPrice = 0;
      const grant = new RSUGrant(mockGrant);
      await grant.save();

      expect(grant.currentValue).toBe(0);
    });
  });

  describe('Virtual Fields', () => {
    let grant;

    beforeEach(async () => {
      // Mock current time to 2024-08-01 for consistent vesting calculations
      jest.useFakeTimers().setSystemTime(new Date('2024-08-01'));
      
      // Create grant with vesting schedule - virtuals use vestDate comparison, not vested boolean
      mockGrant.vestingSchedule = [
        { vestDate: new Date('2024-04-15'), shares: 250, vested: true, vestedValue: 30000 },  // Past date = vested
        { vestDate: new Date('2024-07-15'), shares: 250, vested: true, vestedValue: 32000 },  // Past date = vested
        { vestDate: new Date('2024-10-15'), shares: 250, vested: false, vestedValue: 0 },     // Future date = unvested
        { vestDate: new Date('2025-01-15'), shares: 250, vested: false, vestedValue: 0 }      // Future date = unvested
      ];
      grant = new RSUGrant(mockGrant);
      await grant.save();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate vested shares correctly', () => {
      // Vested shares are calculated by vestDate <= now (2024-08-01)
      // So shares from 2024-04-15 and 2024-07-15 are vested
      expect(grant.vestedShares).toBe(500); // 250 + 250
    });

    it('should calculate unvested shares correctly', () => {
      // Unvested shares are calculated by vestDate > now (2024-08-01)
      // So shares from 2024-10-15 and 2025-01-15 are unvested
      expect(grant.unvestedShares).toBe(500); // 250 + 250
    });

    it('should calculate vesting progress percentage', () => {
      expect(grant.vestingProgress).toBe(50); // 500/1000 * 100
    });

    it('should calculate gain/loss amount', () => {
      expect(grant.gainLoss).toBe(20000); // 120000 - 100000
    });

    it('should calculate gain/loss percentage', () => {
      expect(grant.gainLossPercentage).toBe(20); // (120000 - 100000) / 100000 * 100
    });
  });

  describe('Instance Methods', () => {
    let grant;

    beforeEach(async () => {
      mockGrant.vestingSchedule = [
        { vestDate: new Date('2024-04-15'), shares: 250, vested: false, vestedValue: 0 },
        { vestDate: new Date('2024-07-15'), shares: 250, vested: false, vestedValue: 0 }
      ];
      grant = new RSUGrant(mockGrant);
      await grant.save();
    });

    describe('updateVestingStatus', () => {
      it('should update vesting status for existing date', () => {
        const vestDate = new Date('2024-04-15');
        const result = grant.updateVestingStatus(vestDate, true, 30000);

        expect(result).toBe(true);
        expect(grant.vestingSchedule[0].vested).toBe(true);
        expect(grant.vestingSchedule[0].vestedValue).toBe(30000);
      });

      it('should return false for non-existent vesting date', () => {
        const nonExistentDate = new Date('2024-05-15');
        const result = grant.updateVestingStatus(nonExistentDate, true);

        expect(result).toBe(false);
      });
    });

    describe('getUpcomingVesting', () => {
      it('should return upcoming vesting events', () => {
        const mockDate = new Date('2024-03-01');
        jest.useFakeTimers().setSystemTime(mockDate);

        const upcoming = grant.getUpcomingVesting(60);

        expect(upcoming).toHaveLength(1);
        expect(upcoming[0].shares).toBe(250);

        jest.useRealTimers();
      });
    });

    describe('getAvailableShares', () => {
      it('should return available shares for sale', () => {
        // Set first vesting as vested
        grant.vestingSchedule[0].vested = true;
        
        const mockDate = new Date('2024-05-01');
        jest.useFakeTimers().setSystemTime(mockDate);

        const available = grant.getAvailableShares();
        expect(available).toBe(250);

        jest.useRealTimers();
      });
    });
  });

  describe('Static Methods', () => {
    let testUserId;

    beforeEach(async () => {
      testUserId = new mongoose.Types.ObjectId();
      
      // Create test grants
      await RSUGrant.create({
        userId: testUserId,
        stockSymbol: 'MSFT',
        grantDate: new Date('2024-01-01'),
        totalValue: 100000,
        totalShares: 1000,
        pricePerShare: 100,
        status: 'active',
        vestingSchedule: [{
          vestDate: new Date('2024-04-01'),
          shares: 250,
          vested: false,
          vestedValue: 0
        }]
      });

      await RSUGrant.create({
        userId: testUserId,
        stockSymbol: 'AAPL',
        grantDate: new Date('2024-02-01'),
        totalValue: 50000,
        totalShares: 500,
        pricePerShare: 100,
        status: 'completed',
        vestingSchedule: [{
          vestDate: new Date('2024-05-01'),
          shares: 125,
          vested: true,
          vestedValue: 15000
        }]
      });
    });

    describe('getUserGrants', () => {
      it('should return all grants for user', async () => {
        const grants = await RSUGrant.getUserGrants(testUserId);
        expect(grants).toHaveLength(2);
      });

      it('should filter by status', async () => {
        const activeGrants = await RSUGrant.getUserGrants(testUserId, { status: 'active' });
        expect(activeGrants).toHaveLength(1);
        expect(activeGrants[0].stockSymbol).toBe('MSFT');
      });

      it('should filter by stock symbol', async () => {
        const appleGrants = await RSUGrant.getUserGrants(testUserId, { stockSymbol: 'AAPL' });
        expect(appleGrants).toHaveLength(1);
        expect(appleGrants[0].stockSymbol).toBe('AAPL');
      });
    });

    describe('getUpcomingVestingEvents', () => {
      it('should return upcoming vesting events across all grants', async () => {
        const mockDate = new Date('2024-03-01');
        jest.useFakeTimers().setSystemTime(mockDate);

        const upcomingEvents = await RSUGrant.getUpcomingVestingEvents(testUserId, 90);
        expect(upcomingEvents).toHaveLength(1);
        expect(upcomingEvents[0].stockSymbol).toBe('MSFT');

        jest.useRealTimers();
      });
    });

    describe('getPortfolioSummary', () => {
      it('should return portfolio summary', async () => {
        const summary = await RSUGrant.getPortfolioSummary(testUserId);
        expect(summary).toHaveLength(1);
        expect(summary[0].totalGrants).toBe(2);
        expect(summary[0].totalShares).toBe(1500);
        expect(summary[0].totalOriginalValue).toBe(150000);
      });
    });
  });
});
