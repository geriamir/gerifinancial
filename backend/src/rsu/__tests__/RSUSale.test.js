const mongoose = require('mongoose');
const { RSUSale, RSUGrant } = require('../models');

describe('RSUSale Model', () => {
  let mockSale;
  let testGrant;
  let testUserId;

  beforeEach(async () => {
    testUserId = new mongoose.Types.ObjectId();
    
    // Create a test grant
    testGrant = await RSUGrant.create({
      userId: testUserId,
      stockSymbol: 'MSFT',
      grantDate: new Date('2022-01-15'), // More than 2 years ago for long-term testing
      totalValue: 100000,
      totalShares: 1000,
      pricePerShare: 100,
      currentPrice: 150,
      status: 'active',
      vestingSchedule: [{
        vestDate: new Date('2022-04-15'),
        shares: 250,
        vested: true,
        vestedValue: 37500
      }]
    });

    mockSale = {
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
      },
      notes: 'Test sale'
    };
  });

  describe('Model Creation and Validation', () => {
    it('should create a valid RSU sale', async () => {
      const sale = new RSUSale(mockSale);
      await sale.save();

      expect(sale.sharesAmount).toBe(100);
      expect(sale.pricePerShare).toBe(150);
      expect(sale.totalSaleValue).toBe(15000);
      expect(sale.taxCalculation.isLongTerm).toBe(true);
      expect(sale.notes).toBe('Test sale');
    });

    it('should validate required fields', async () => {
      const invalidSale = new RSUSale({
        userId: testUserId,
        // Missing required fields
      });

      await expect(invalidSale.save()).rejects.toThrow();
    });

    it('should validate shares amount as integer', async () => {
      mockSale.sharesAmount = 100.5;
      const sale = new RSUSale(mockSale);

      await expect(sale.save()).rejects.toThrow();
    });

    it('should validate positive amounts', async () => {
      mockSale.pricePerShare = -50;
      const sale = new RSUSale(mockSale);

      await expect(sale.save()).rejects.toThrow();
    });
  });

  describe('Pre-save Middleware', () => {
    it('should calculate total sale value automatically', async () => {
      mockSale.totalSaleValue = 0; // Will be recalculated
      const sale = new RSUSale(mockSale);
      await sale.save();

      expect(sale.totalSaleValue).toBe(15000); // 100 * 150
    });
  });

  describe('Virtual Fields', () => {
    let sale;

    beforeEach(async () => {
      sale = new RSUSale(mockSale);
      await sale.save();
    });

    it('should calculate effective tax rate', () => {
      expect(sale.effectiveTaxRate).toBeCloseTo(51.67, 1); // 7750/15000 * 100
    });

    it('should calculate profit margin', () => {
      expect(sale.profitMargin).toBeCloseTo(33.33, 1); // 5000/15000 * 100
    });
  });

  describe('Instance Methods', () => {
    describe('recalculateTaxes', () => {
      it('should recalculate taxes for long-term holding', () => {
        const sale = new RSUSale({
          ...mockSale,
          saleDate: new Date('2024-02-01'), // 2+ years after grant
          taxCalculation: {} // Will be recalculated
        });

        const taxCalc = sale.recalculateTaxes(testGrant);

        expect(taxCalc.isLongTerm).toBe(true);
        expect(taxCalc.wageIncomeTax).toBe(6500); // 10000 * 0.65
        expect(taxCalc.capitalGainsTax).toBe(1250); // 5000 * 0.25 (long-term rate)
        expect(taxCalc.totalTax).toBe(7750);
        expect(taxCalc.netValue).toBe(7250); // 15000 - 7750
      });

      it('should recalculate taxes for short-term holding', async () => {
        // Create a recent grant for short-term testing
        const recentGrant = await RSUGrant.create({
          userId: testUserId,
          stockSymbol: 'AAPL',
          grantDate: new Date('2023-06-01'), // Less than 2 years ago
          totalValue: 50000,
          totalShares: 500,
          pricePerShare: 100,
          status: 'active',
          vestingSchedule: [{
            vestDate: new Date('2023-09-01'),
            shares: 125,
            vested: true,
            vestedValue: 15000
          }]
        });

        const sale = new RSUSale({
          ...mockSale,
          grantId: recentGrant._id,
          saleDate: new Date('2024-01-01'), // Less than 2 years after grant
          taxCalculation: {}
        });

        const taxCalc = sale.recalculateTaxes(recentGrant);

        expect(taxCalc.isLongTerm).toBe(false);
        expect(taxCalc.wageIncomeTax).toBe(6500); // 10000 * 0.65
        expect(taxCalc.capitalGainsTax).toBe(3250); // 5000 * 0.65 (short-term rate)
        expect(taxCalc.totalTax).toBe(9750);
      });

      it('should handle negative profit (loss)', () => {
        const sale = new RSUSale({
          ...mockSale,
          pricePerShare: 80, // Selling at loss
          totalSaleValue: 8000,
          taxCalculation: {}
        });

        const taxCalc = sale.recalculateTaxes(testGrant);

        expect(taxCalc.profit).toBe(-2000); // 8000 - 10000
        expect(taxCalc.capitalGainsTax).toBe(0); // No tax on losses
        expect(taxCalc.wageIncomeTax).toBe(6500); // Still pay wage income tax
        expect(taxCalc.totalTax).toBe(6500);
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test sales
      await RSUSale.create({
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
      });

      await RSUSale.create({
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
      });
    });

    describe('getUserSales', () => {
      it('should return all sales for user', async () => {
        const sales = await RSUSale.getUserSales(testUserId);
        expect(sales).toHaveLength(2);
      });

      it('should filter by grant ID', async () => {
        const grantSales = await RSUSale.getUserSales(testUserId, { grantId: testGrant._id });
        expect(grantSales).toHaveLength(2);
      });

      it('should filter by date range', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        
        const januarySales = await RSUSale.getUserSales(testUserId, { startDate, endDate });
        expect(januarySales).toHaveLength(1);
        expect(januarySales[0].sharesAmount).toBe(100);
      });
    });

    describe('getSalesByGrant', () => {
      it('should return sales for specific grant', async () => {
        const grantSales = await RSUSale.getSalesByGrant(testGrant._id);
        expect(grantSales).toHaveLength(2);
      });
    });

    describe('getAnnualTaxSummary', () => {
      it('should return annual tax summary', async () => {
        const summary = await RSUSale.getAnnualTaxSummary(testUserId, 2024);
        expect(summary).toHaveLength(1);
        
        const annualData = summary[0];
        expect(annualData.year).toBe(2024);
        expect(annualData.totalSales).toBe(2);
        expect(annualData.totalSharesSold).toBe(150);
        expect(annualData.totalSaleValue).toBe(23000);
        expect(annualData.totalTax).toBe(11750);
        expect(annualData.longTermSales).toBe(2);
        expect(annualData.shortTermSales).toBe(0);
      });
    });

    describe('validateSaleAgainstGrant', () => {
      it('should validate sale against available shares', async () => {
        const validation = await RSUSale.validateSaleAgainstGrant(testGrant._id, 50, new Date('2024-03-01'));
        
        expect(validation.availableShares).toBe(250);
        expect(validation.soldShares).toBe(150); // From existing sales
        expect(validation.remainingShares).toBe(100);
        expect(validation.grant).toBeDefined();
      });

      it('should throw error when selling more than available', async () => {
        await expect(
          RSUSale.validateSaleAgainstGrant(testGrant._id, 200, new Date('2024-03-01'))
        ).rejects.toThrow('Insufficient shares available');
      });

      it('should throw error when sale date is before grant date', async () => {
        await expect(
          RSUSale.validateSaleAgainstGrant(testGrant._id, 50, new Date('2021-01-01'))
        ).rejects.toThrow('Sale date cannot be before grant date');
      });

      it('should throw error for non-existent grant', async () => {
        const fakeGrantId = new mongoose.Types.ObjectId();
        await expect(
          RSUSale.validateSaleAgainstGrant(fakeGrantId, 50, new Date('2024-03-01'))
        ).rejects.toThrow('Grant not found');
      });
    });
  });
});
