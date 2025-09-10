const rsuService = require('../rsuService');
const taxCalculationService = require('../taxCalculationService');
const vestingService = require('../vestingService');
const { RSUGrant, RSUSale } = require('../../models');
const { User } = require('../../../auth');
const { createTestUser } = require('../../../test/testUtils');

// Mock external services
const stockPriceService = require('../stockPriceService');
jest.mock('../stockPriceService');
jest.mock('../taxCalculationService');
jest.mock('../vestingService');

describe('RSU Service', () => {
  let testUser;
  let testUserId;

  beforeEach(async () => {
    // Create test user
    const userData = await createTestUser(User, {
      email: 'rsu-test@example.com',
      name: 'RSU Test User'
    });
    testUser = userData.user;
    testUserId = testUser._id;

    // Reset mocks
    jest.clearAllMocks();
    
    // Mock stock price service for any symbol
    stockPriceService.handleNewGrant.mockImplementation((symbol, price) => {
      return Promise.resolve({
        symbol: symbol,
        price: price || 120,
        lastUpdated: new Date()
      });
    });
    
    // Mock populateHistoricalPrices to prevent API calls for any symbol
    stockPriceService.populateHistoricalPrices.mockImplementation((symbol) => {
      return Promise.resolve({
        symbol: symbol,
        recordsProcessed: 100,
        upsertedCount: 100,
        modifiedCount: 0
      });
    });
    
    // Mock tax calculation service
    taxCalculationService.calculateSaleTax.mockResolvedValue({
      originalValue: 10000,
      profit: 5000,
      isLongTerm: true,
      wageIncomeTax: 6500,
      capitalGainsTax: 1250,
      totalTax: 7750,
      netValue: 7250,
      taxBasis: {
        grantValue: 10000,
        saleValue: 15000,
        profitAmount: 5000,
        taxRateApplied: 0.517
      }
    });

    taxCalculationService.previewTaxCalculation.mockImplementation((grantId, sharesAmount, salePrice) => {
      // Mock validation - reject if grantId is fake or shares > 250 (available vested)
      if (grantId === '507f1f77bcf86cd799439011') {
        return Promise.reject(new Error('Grant not found'));
      }
      if (sharesAmount > 250) {
        return Promise.reject(new Error('Insufficient shares available'));
      }
      
      return Promise.resolve({
        originalValue: 10000,
        profit: 5000,
        totalTax: 7750,
        netValue: 7250,
        grantInfo: { stockSymbol: 'MSFT' },
        saleInfo: { sharesAmount, pricePerShare: salePrice },
        taxCalculation: {
          originalValue: 10000,
          profit: 5000,
          totalTax: 7750,
          netValue: 7250
        }
      });
    });

    taxCalculationService.estimateUnrealizedTaxLiabilityWithPeriod.mockReturnValue({
      estimatedTotalTax: 5000,
      estimatedNetValue: 10000
    });
    
    // Mock vesting service
    vestingService.generateQuarterlySchedule.mockImplementation((grantDate, totalShares, years) => {
      // Generate a simple quarterly vesting schedule
      const schedule = [];
      const sharesPerQuarter = Math.floor(totalShares / (years * 4));
      const remainder = totalShares % (years * 4);
      
      for (let i = 0; i < years * 4; i++) {
        const vestDate = new Date(grantDate);
        vestDate.setMonth(vestDate.getMonth() + (i + 1) * 3);
        
        schedule.push({
          vestDate,
          shares: sharesPerQuarter + (i < remainder ? 1 : 0),
          vested: false,
          vestedValue: 0
        });
      }
      
      return schedule;
    });

    // Mock the new generateVestingSchedule method that the RSUService actually calls
    vestingService.generateVestingSchedule.mockImplementation((planType, grantDate, totalShares) => {
      // Default to quarterly-5yr behavior (20 periods)
      let periods = 20;
      if (planType === 'quarterly-4yr') periods = 16;
      if (planType === 'semi-annual-4yr') periods = 8;
      
      const schedule = [];
      const sharesPerPeriod = Math.floor(totalShares / periods);
      const remainder = totalShares % periods;
      
      for (let i = 0; i < periods; i++) {
        const vestDate = new Date(grantDate);
        if (planType === 'semi-annual-4yr') {
          vestDate.setMonth(vestDate.getMonth() + (i + 1) * 6); // 6 months for semi-annual
        } else {
          vestDate.setMonth(vestDate.getMonth() + (i + 1) * 3); // 3 months for quarterly
        }
        
        schedule.push({
          vestDate,
          shares: sharesPerPeriod + (i < remainder ? 1 : 0),
          vested: false,
          vestedValue: 0
        });
      }
      
      return schedule;
    });
    
    vestingService.validateVestingSchedule.mockReturnValue({
      isValid: true,
      errors: []
    });
    
    vestingService.getVestingStatistics.mockResolvedValue({
      totalVested: 0,
      totalUnvested: 0,
      nextVestingDate: new Date(),
      overallProgress: 0
    });
    
    vestingService.getUpcomingVestings.mockResolvedValue([
      { shares: 250, vestDate: new Date('2024-04-01'), stockSymbol: 'MSFT' },
      { shares: 125, vestDate: new Date('2024-06-01'), stockSymbol: 'AAPL' }
    ]);
  });

  describe('Grant Management', () => {
    describe('createGrant', () => {
      it('should create a new RSU grant with vesting schedule', async () => {
        const grantData = {
          stockSymbol: 'MSFT',
          name: 'Microsoft Grant 2024',
          company: 'Microsoft Corporation',
          grantDate: '2024-01-15',
          totalValue: 100000,
          totalShares: 1000,
          notes: 'Initial grant'
        };

        const grant = await rsuService.createGrant(testUserId, grantData);

        expect(grant).toBeDefined();
        expect(grant.stockSymbol).toBe('MSFT');
        expect(grant.name).toBe('Microsoft Grant 2024');
        expect(grant.totalValue).toBe(100000);
        expect(grant.totalShares).toBe(1000);
        expect(grant.vestingSchedule).toHaveLength(20); // 5 years * 4 quarters
        expect(stockPriceService.handleNewGrant).toHaveBeenCalledWith('MSFT', 100);
        expect(grant.pricePerShare).toBe(100); // totalValue / totalShares
      });

      it('should create vesting schedule with proper distribution', async () => {
        const grantData = {
          stockSymbol: 'AAPL',
          grantDate: '2024-01-01',
          totalValue: 50000,
          totalShares: 500
        };

        const grant = await rsuService.createGrant(testUserId, grantData);

        const totalVestingShares = grant.vestingSchedule.reduce((sum, vest) => sum + vest.shares, 0);
        expect(totalVestingShares).toBe(500);
        
        // First vesting should be 3 months after grant (quarterly)
        const firstVesting = grant.vestingSchedule[0];
        const expectedFirstVestDate = new Date('2024-04-01'); // 3 months after 2024-01-01
        expect(firstVesting.vestDate.toDateString()).toBe(expectedFirstVestDate.toDateString());
      });

      it('should handle remainder shares properly', async () => {
        const grantData = {
          stockSymbol: 'GOOGL',
          grantDate: '2024-01-01',
          totalValue: 100000,
          totalShares: 1003 // Not evenly divisible by 20
        };

        const grant = await rsuService.createGrant(testUserId, grantData);

        const totalVestingShares = grant.vestingSchedule.reduce((sum, vest) => sum + vest.shares, 0);
        expect(totalVestingShares).toBe(1003);
        
        // Check that remainder is distributed among early vesting events
        const firstFewVestings = grant.vestingSchedule.slice(0, 3);
        const hasExtraShares = firstFewVestings.some(vest => vest.shares > 50); // Base would be 50
        expect(hasExtraShares).toBe(true);
      });

      it('should validate input data', async () => {
        const invalidData = {
          stockSymbol: '', // Invalid
          grantDate: '2024-01-01',
          totalValue: -1000, // Invalid
          totalShares: 0 // Invalid
        };

        await expect(rsuService.createGrant(testUserId, invalidData)).rejects.toThrow();
      });
    });

    describe('updateGrant', () => {
      let existingGrant;

      beforeEach(async () => {
        existingGrant = await RSUGrant.create({
          userId: testUserId,
          stockSymbol: 'MSFT',
          grantDate: new Date('2024-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100, // Required field
          currentPrice: 120,
          status: 'active',
          vestingSchedule: [{
            vestDate: new Date('2025-01-01'),
            shares: 250,
            vested: false,
            vestedValue: 0
          }]
        });
      });

      it('should update grant basic information', async () => {
        const updates = {
          name: 'Updated Grant Name',
          company: 'Updated Company',
          notes: 'Updated notes'
        };

        const updatedGrant = await rsuService.updateGrant(existingGrant._id, updates);

        expect(updatedGrant.name).toBe('Updated Grant Name');
        expect(updatedGrant.company).toBe('Updated Company');
        expect(updatedGrant.notes).toBe('Updated notes');
        expect(updatedGrant.stockSymbol).toBe('MSFT'); // Unchanged
      });

      it('should update grant status', async () => {
        const updates = { status: 'completed' };

        const updatedGrant = await rsuService.updateGrant(existingGrant._id, updates);

        expect(updatedGrant.status).toBe('completed');
      });

      it('should handle non-existent grant', async () => {
        const fakeId = '507f1f77bcf86cd799439011';
        const updates = { name: 'Test' };

        await expect(rsuService.updateGrant(fakeId, updates)).rejects.toThrow('Grant not found');
      });
    });

    describe('deleteGrant', () => {
      let existingGrant;
      let existingSale;

      beforeEach(async () => {
        existingGrant = await RSUGrant.create({
          userId: testUserId,
          stockSymbol: 'MSFT',
          grantDate: new Date('2024-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100,
          currentPrice: 120,
          status: 'active',
          vestingSchedule: [{
            vestDate: new Date('2025-01-01'),
            shares: 250,
            vested: true,
            vestedValue: 30000
          }]
        });

        existingSale = await RSUSale.create({
          userId: testUserId,
          grantId: existingGrant._id,
          saleDate: new Date('2024-06-01'),
          sharesAmount: 100,
          pricePerShare: 120,
          totalSaleValue: 12000,
          taxCalculation: {
            originalValue: 10000,
            profit: 2000,
            isLongTerm: false,
            wageIncomeTax: 6500,
            capitalGainsTax: 1300,
            totalTax: 7800,
            netValue: 4200,
            taxBasis: {
              grantValue: 10000,
              saleValue: 12000,
              profitAmount: 2000,
              taxRateApplied: 0.65
            }
          }
        });
      });

      it('should delete grant and associated sales', async () => {
        const result = await rsuService.deleteGrant(existingGrant._id);

        expect(result.deletedGrant).toBeDefined();
        expect(result.deletedSales).toBe(1);
        expect(result.stockSymbol).toBe('MSFT');

        // Verify deletion
        const deletedGrant = await RSUGrant.findById(existingGrant._id);
        const deletedSale = await RSUSale.findById(existingSale._id);
        expect(deletedGrant).toBeNull();
        expect(deletedSale).toBeNull();
      });

      it('should handle non-existent grant', async () => {
        const fakeId = '507f1f77bcf86cd799439011';

        await expect(rsuService.deleteGrant(fakeId)).rejects.toThrow('Grant not found');
      });
    });

    describe('getUserGrants', () => {
      beforeEach(async () => {
        // Create test grants
        await RSUGrant.create([
          {
            userId: testUserId,
            stockSymbol: 'MSFT',
            grantDate: new Date('2024-01-01'),
            totalValue: 100000,
            totalShares: 1000,
            pricePerShare: 100,
            currentPrice: 120,
            status: 'active',
            vestingSchedule: [{
              vestDate: new Date('2024-04-01'),
              shares: 250,
              vested: false,
              vestedValue: 0
            }]
          },
          {
            userId: testUserId,
            stockSymbol: 'AAPL',
            grantDate: new Date('2024-02-01'),
            totalValue: 50000,
            totalShares: 500,
            pricePerShare: 100,
            currentPrice: 180,
            status: 'completed',
            vestingSchedule: [{
              vestDate: new Date('2024-05-01'),
              shares: 125,
              vested: false,
              vestedValue: 0
            }]
          }
        ]);
      });

      it('should return all grants for user', async () => {
        const grants = await rsuService.getUserGrants(testUserId);

        expect(grants).toHaveLength(2);
        expect(grants[0].stockSymbol).toBe('AAPL'); // Sorted by grant date descending
        expect(grants[1].stockSymbol).toBe('MSFT');
      });

      it('should filter by status', async () => {
        const activeGrants = await rsuService.getUserGrants(testUserId, { status: 'active' });

        expect(activeGrants).toHaveLength(1);
        expect(activeGrants[0].stockSymbol).toBe('MSFT');
      });

      it('should filter by stock symbol', async () => {
        const appleGrants = await rsuService.getUserGrants(testUserId, { stockSymbol: 'AAPL' });

        expect(appleGrants).toHaveLength(1);
        expect(appleGrants[0].stockSymbol).toBe('AAPL');
      });
    });
  });

  describe('Sales Management', () => {
    let testGrant;

    beforeEach(async () => {
      testGrant = await RSUGrant.create({
        userId: testUserId,
        stockSymbol: 'MSFT',
        grantDate: new Date('2022-01-01'), // 2+ years ago for long-term testing
        totalValue: 100000,
        totalShares: 1000,
        pricePerShare: 100,
        currentPrice: 150,
        status: 'active',
        vestingSchedule: [
          {
            vestDate: new Date('2023-01-01'),
            shares: 250,
            vested: true,
            vestedValue: 30000
          },
          {
            vestDate: new Date('2023-04-01'),
            shares: 250,
            vested: true,
            vestedValue: 32000
          }
        ]
      });
    });

    describe('recordSale', () => {
      it('should record a new RSU sale with tax calculations', async () => {
        const saleData = {
          grantId: testGrant._id,
          saleDate: '2024-01-15',
          sharesAmount: 100,
          pricePerShare: 150,
          notes: 'First sale'
        };

        const sale = await rsuService.recordSale(testUserId, saleData);

        expect(sale).toBeDefined();
        expect(sale.sharesAmount).toBe(100);
        expect(sale.pricePerShare).toBe(150);
        expect(sale.totalSaleValue).toBe(15000);
        expect(sale.taxCalculation).toBeDefined();
        expect(sale.notes).toBe('First sale');
        expect(taxCalculationService.calculateSaleTax).toHaveBeenCalled();
      });

      it('should validate share availability', async () => {
        const saleData = {
          grantId: testGrant._id,
          saleDate: '2024-01-15',
          sharesAmount: 1000, // More than available (500 vested)
          pricePerShare: 150
        };

        await expect(rsuService.recordSale(testUserId, saleData)).rejects.toThrow('Insufficient shares available');
      });

      it('should validate sale date against grant date', async () => {
        const saleData = {
          grantId: testGrant._id,
          saleDate: '2021-01-01', // Before grant date
          sharesAmount: 100,
          pricePerShare: 150
        };

        await expect(rsuService.recordSale(testUserId, saleData)).rejects.toThrow('Sale date cannot be before grant date');
      });

      it('should handle non-existent grant', async () => {
        const fakeGrantId = '507f1f77bcf86cd799439011';
        const saleData = {
          grantId: fakeGrantId,
          saleDate: '2024-01-15',
          sharesAmount: 100,
          pricePerShare: 150
        };

        await expect(rsuService.recordSale(testUserId, saleData)).rejects.toThrow('Grant not found');
      });
    });

    describe('getUserSales', () => {
      beforeEach(async () => {
        // Create test sales
        await RSUSale.create([
          {
            userId: testUserId,
            grantId: testGrant._id,
            saleDate: new Date('2024-01-15'),
            sharesAmount: 100,
            pricePerShare: 150,
            totalSaleValue: 15000,
            taxCalculation: {
              originalValue: 10000,
              profit: 5000,
              isLongTerm: true,
              wageIncomeTax: 6500,
              capitalGainsTax: 1250,
              totalTax: 7750,
              netValue: 7250,
              taxBasis: {
                grantValue: 10000,
                saleValue: 15000,
                profitAmount: 5000,
                taxRateApplied: 0.517
              }
            }
          },
          {
            userId: testUserId,
            grantId: testGrant._id,
            saleDate: new Date('2024-02-15'),
            sharesAmount: 50,
            pricePerShare: 160,
            totalSaleValue: 8000,
            taxCalculation: {
              originalValue: 5000,
              profit: 3000,
              isLongTerm: true,
              wageIncomeTax: 3250,
              capitalGainsTax: 750,
              totalTax: 4000,
              netValue: 4000,
              taxBasis: {
                grantValue: 5000,
                saleValue: 8000,
                profitAmount: 3000,
                taxRateApplied: 0.50
              }
            }
          }
        ]);
      });

      it('should return all sales for user', async () => {
        const sales = await rsuService.getUserSales(testUserId);

        expect(sales).toHaveLength(2);
        expect(sales[0].saleDate).toEqual(new Date('2024-02-15')); // Sorted by date descending
        expect(sales[1].saleDate).toEqual(new Date('2024-01-15'));
      });

      it('should filter by grant ID', async () => {
        const grantSales = await rsuService.getUserSales(testUserId, { grantId: testGrant._id });

        expect(grantSales).toHaveLength(2);
      });

      it('should filter by date range', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        
        const januarySales = await rsuService.getUserSales(testUserId, { startDate, endDate });

        expect(januarySales).toHaveLength(1);
        expect(januarySales[0].sharesAmount).toBe(100);
      });
    });
  });

  describe('Portfolio Analytics', () => {
    beforeEach(async () => {
      // Create test grants with different statuses
      await RSUGrant.create([
        {
          userId: testUserId,
          stockSymbol: 'MSFT',
          grantDate: new Date('2023-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100,
          currentPrice: 120,
          status: 'active',
          vestingSchedule: [
            { vestDate: new Date('2024-01-01'), shares: 250, vested: true, vestedValue: 30000 },
            { vestDate: new Date('2024-04-01'), shares: 250, vested: false, vestedValue: 0 }
          ]
        },
        {
          userId: testUserId,
          stockSymbol: 'AAPL',
          grantDate: new Date('2023-06-01'),
          totalValue: 50000,
          totalShares: 500,
          pricePerShare: 100,
          currentPrice: 180,
          status: 'active',
          vestingSchedule: [
            { vestDate: new Date('2024-06-01'), shares: 125, vested: false, vestedValue: 0 }
          ]
        }
      ]);
    });

    describe('getPortfolioSummary', () => {
      it('should return comprehensive portfolio summary', async () => {
        const summary = await rsuService.getPortfolioSummary(testUserId);

        expect(summary).toBeDefined();
        expect(summary.grants).toBeDefined();
        expect(summary.vesting).toBeDefined();
        expect(summary.sales).toBeDefined();
        expect(summary.summary).toBeDefined();

        expect(summary.grants.totalGrants).toBe(2);
        expect(summary.grants.totalShares).toBe(1500);
        expect(summary.grants.totalOriginalValue).toBe(150000);
        expect(summary.grants.totalCurrentValue).toBe(210000); // (1000*120) + (500*180)
      });
    });

    describe('getPortfolioPerformance', () => {
      it('should return performance metrics for specified timeframe', async () => {
        const performance = await rsuService.getPortfolioPerformance(testUserId, '1Y');

        expect(performance).toBeDefined();
        expect(performance.timeframe).toBe('1Y');
        expect(performance.period).toBeDefined();
        expect(performance.performance).toBeDefined();
      });
    });

    describe('getUpcomingVesting', () => {
      it('should return upcoming vesting events', async () => {
        const mockDate = new Date('2024-03-01');
        jest.useFakeTimers().setSystemTime(mockDate);

        const upcomingVesting = await rsuService.getUpcomingVesting(testUserId, 90);

        expect(upcomingVesting).toHaveLength(2); // One from each grant
        expect(upcomingVesting[0].shares).toBe(250);
        expect(upcomingVesting[1].shares).toBe(125);

        jest.useRealTimers();
      });
    });
  });

  describe('Tax Preview', () => {
    let testGrant;

    beforeEach(async () => {
      testGrant = await RSUGrant.create({
        userId: testUserId,
        stockSymbol: 'MSFT',
        grantDate: new Date('2022-01-01'),
        totalValue: 100000,
        totalShares: 1000,
        pricePerShare: 100,
        currentPrice: 150,
        status: 'active',
        vestingSchedule: [
          { vestDate: new Date('2023-01-01'), shares: 250, vested: true, vestedValue: 30000 }
        ]
      });
    });

    describe('getTaxPreview', () => {
      it('should return tax preview for potential sale', async () => {
        const preview = await rsuService.getTaxPreview(testUserId, testGrant._id, 100, 150);

        expect(preview).toBeDefined();
        expect(preview.grantInfo).toBeDefined();
        expect(preview.saleInfo).toBeDefined();
        expect(preview.taxCalculation).toBeDefined();
        expect(taxCalculationService.previewTaxCalculation).toHaveBeenCalled();
      });

      it('should handle non-existent grant', async () => {
        const fakeGrantId = '507f1f77bcf86cd799439011';

        await expect(rsuService.getTaxPreview(testUserId, fakeGrantId, 100, 150)).rejects.toThrow('Grant not found');
      });

      it('should validate share availability for preview', async () => {
        await expect(rsuService.getTaxPreview(testUserId, testGrant._id, 1000, 150)).rejects.toThrow('Insufficient shares available');
      });
    });
  });
});
