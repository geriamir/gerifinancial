const taxCalculationService = require('../taxCalculationService');
const { RSUGrant, User } = require('../../../models');
const { createTestUser } = require('../../../test/testUtils');

describe('Tax Calculation Service', () => {
  let testUser;
  let testUserId;
  let testGrant;

  beforeEach(async () => {
    // Create test user
    const userData = await createTestUser(User, {
      email: 'tax-test@example.com',
      name: 'Tax Test User'
    });
    testUser = userData.user;
    testUserId = testUser._id;

    // Create test grant
    testGrant = await RSUGrant.create({
      userId: testUserId,
      stockSymbol: 'AAPL',
      grantDate: new Date('2022-01-01'),
      totalValue: 100000,
      totalShares: 1000,
      pricePerShare: 100,
      currentPrice: 150,
      status: 'active',
      vestingSchedule: [
        {
          vestDate: new Date('2022-04-01'),
          shares: 250,
          vested: true,
          vestedValue: 37500
        },
        {
          vestDate: new Date('2022-07-01'),
          shares: 250,
          vested: true,
          vestedValue: 40000
        }
      ]
    });
  });

  describe('Sale Tax Calculations', () => {
    describe('calculateSaleTax', () => {
      it('should calculate long-term capital gains tax (2+ years)', async () => {
        const sale = {
          sharesAmount: 100,
          pricePerShare: 150,
          saleDate: new Date('2024-06-01') // 2.4 years later
        };

        const result = await taxCalculationService.calculateSaleTax(testGrant, sale);

        expect(result.isLongTerm).toBe(true);
        expect(result.holdingPeriodDays).toBeGreaterThan(730); // 2+ years
        expect(result.originalValue).toBe(10000); // 100 * 100
        expect(result.profit).toBe(5000); // (100 * 150) - 10000
        expect(result.wageIncomeTax).toBe(6500); // 10000 * 0.65
        expect(result.capitalGainsTax).toBe(1250); // 5000 * 0.25 (long-term rate)
        expect(result.totalTax).toBe(7750);
        expect(result.netValue).toBe(7250); // 15000 - 7750
        expect(result.effectiveTaxRate).toBeCloseTo(51.67, 1); // 7750/15000 * 100
      });

      it('should calculate short-term capital gains tax (less than 2 years)', async () => {
        // Create a grant with more recent date
        const recentGrant = await RSUGrant.create({
          userId: testUserId,
          stockSymbol: 'MSFT',
          grantDate: new Date('2023-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100,
          currentPrice: 150,
          status: 'active',
          vestingSchedule: [
            {
              vestDate: new Date('2023-04-01'),
              shares: 250,
              vested: true,
              vestedValue: 37500
            }
          ]
        });

        const sale = {
          sharesAmount: 100,
          pricePerShare: 150,
          saleDate: new Date('2024-06-01') // 1.4 years later
        };

        const result = await taxCalculationService.calculateSaleTax(recentGrant, sale);

        expect(result.isLongTerm).toBe(false);
        expect(result.holdingPeriodDays).toBeLessThan(730); // Less than 2 years
        expect(result.wageIncomeTax).toBe(6500); // 10000 * 0.65
        expect(result.capitalGainsTax).toBe(3250); // 5000 * 0.65 (short-term rate)
        expect(result.totalTax).toBe(9750);
        expect(result.netValue).toBe(5250); // 15000 - 9750
        expect(result.effectiveTaxRate).toBeCloseTo(65.0, 1); // 9750/15000 * 100
      });

      it('should handle capital losses (negative profit)', async () => {
        const sale = {
          sharesAmount: 150, // More shares for higher original value
          pricePerShare: 67, // Lower price to create loss
          saleDate: new Date('2024-06-01')
        };

        const result = await taxCalculationService.calculateSaleTax(testGrant, sale);

        expect(result.profit).toBeLessThan(0); // Should be negative (loss)
        expect(result.wageIncomeTax).toBe(9750); // 15000 * 0.65 (still owe wage tax)
        expect(result.capitalGainsTax).toBe(0); // No tax on losses
        expect(result.totalTax).toBe(9750);
        expect(result.netValue).toBeLessThan(result.originalValue); // Net loss after taxes
      });

      it('should calculate exact 2-year threshold', async () => {
        const sale = {
          sharesAmount: 100,
          pricePerShare: 120,
          saleDate: new Date('2024-01-01') // Exactly 2 years from grant
        };

        const result = await taxCalculationService.calculateSaleTax(testGrant, sale);

        expect(result.isLongTerm).toBe(true); // Exactly 2 years should be long-term
        expect(result.holdingPeriodDays).toBeGreaterThanOrEqual(730); // At least 2 years
        expect(result.capitalGainsTax).toBe(500); // 2000 * 0.25 (long-term rate)
      });

      it('should handle zero profit scenario', async () => {
        const sale = {
          sharesAmount: 100,
          pricePerShare: 100, // Same as original price
          saleDate: new Date('2024-06-01')
        };

        const result = await taxCalculationService.calculateSaleTax(testGrant, sale);

        expect(result.profit).toBe(0);
        expect(result.wageIncomeTax).toBe(6500); // 10000 * 0.65
        expect(result.capitalGainsTax).toBe(0); // No capital gains
        expect(result.totalTax).toBe(6500);
        expect(result.netValue).toBe(3500); // 10000 - 6500
      });
    });

    describe('calculateSaleTax with custom rates', () => {
      it('should use custom tax rates when provided', async () => {
        const sale = {
          sharesAmount: 100,
          pricePerShare: 150,
          saleDate: new Date('2024-06-01')
        };

        const customRates = {
          wageIncome: 0.50,
          capitalGainsLongTerm: 0.20,
          capitalGainsShortTerm: 0.50
        };

        const result = await taxCalculationService.calculateSaleTax(testGrant, sale, customRates);

        expect(result.wageIncomeTax).toBe(5000); // 10000 * 0.50
        expect(result.capitalGainsTax).toBe(1000); // 5000 * 0.20
        expect(result.totalTax).toBe(6000);
        expect(result.taxRatesUsed.wageIncome).toBe(0.50);
        expect(result.taxRatesUsed.capitalGains).toBe(0.20);
      });

      it('should use custom rates for short-term gains', async () => {
        // Create a grant with more recent date
        const recentGrant = await RSUGrant.create({
          userId: testUserId,
          stockSymbol: 'GOOGL',
          grantDate: new Date('2023-01-01'),
          totalValue: 100000,
          totalShares: 1000,
          pricePerShare: 100,
          currentPrice: 150,
          status: 'active',
          vestingSchedule: [
            {
              vestDate: new Date('2023-04-01'),
              shares: 250,
              vested: true,
              vestedValue: 37500
            }
          ]
        });

        const sale = {
          sharesAmount: 100,
          pricePerShare: 150,
          saleDate: new Date('2024-01-01') // 1 year
        };

        const customRates = {
          wageIncome: 0.45,
          capitalGainsLongTerm: 0.15,
          capitalGainsShortTerm: 0.35
        };

        const result = await taxCalculationService.calculateSaleTax(recentGrant, sale, customRates);

        expect(result.isLongTerm).toBe(false);
        expect(result.wageIncomeTax).toBe(4500); // 10000 * 0.45
        expect(result.capitalGainsTax).toBe(1750); // 5000 * 0.35
        expect(result.taxRatesUsed.capitalGains).toBe(0.35);
      });
    });
  });

  describe('Tax Preview Calculations', () => {
    describe('previewTaxCalculation', () => {
      it('should provide tax preview for potential sale', async () => {
        const preview = await taxCalculationService.previewTaxCalculation(
          testGrant._id,
          100, // shares
          150, // price
          new Date('2024-06-01')
        );

        expect(preview.grantInfo).toBeDefined();
        expect(preview.grantInfo.stockSymbol).toBe('AAPL');
        expect(preview.saleInfo).toBeDefined();
        expect(preview.saleInfo.sharesAmount).toBe(100);
        expect(preview.saleInfo.pricePerShare).toBe(150);
        expect(preview.totalTax).toBeGreaterThan(0);
      });

      it('should throw error for insufficient shares', async () => {
        await expect(taxCalculationService.previewTaxCalculation(
          testGrant._id,
          2000, // More than total shares
          150
        )).rejects.toThrow('Insufficient shares available');
      });

      it('should throw error for non-existent grant', async () => {
        const fakeId = '507f1f77bcf86cd799439011';
        
        await expect(taxCalculationService.previewTaxCalculation(
          fakeId,
          100,
          150
        )).rejects.toThrow('Grant not found');
      });
    });
  });

  describe('Holding Period Calculations', () => {
    describe('isLongTermHoldingPrecise', () => {
      it('should correctly identify long-term holdings', () => {
        const grantDate = new Date('2022-01-01');
        const saleDate = new Date('2024-06-01'); // 2.4 years later

        const isLongTerm = taxCalculationService.isLongTermHoldingPrecise(grantDate, saleDate);
        expect(isLongTerm).toBe(true);
      });

      it('should correctly identify short-term holdings', () => {
        const grantDate = new Date('2023-01-01');
        const saleDate = new Date('2024-06-01'); // 1.4 years later

        const isLongTerm = taxCalculationService.isLongTermHoldingPrecise(grantDate, saleDate);
        expect(isLongTerm).toBe(false);
      });

      it('should handle exact 2-year threshold', () => {
        const grantDate = new Date('2022-01-01');
        const saleDate = new Date('2024-01-01'); // Exactly 2 years

        const isLongTerm = taxCalculationService.isLongTermHoldingPrecise(grantDate, saleDate);
        expect(isLongTerm).toBe(true);
      });

      it('should handle leap years correctly', () => {
        const grantDate = new Date('2020-01-01'); // Leap year
        const saleDate = new Date('2022-01-01'); // 2 years including leap day

        const isLongTerm = taxCalculationService.isLongTermHoldingPrecise(grantDate, saleDate);
        expect(isLongTerm).toBe(true);
      });
    });
  });

  describe('Individual Tax Calculations', () => {
    describe('calculateWageIncomeTax', () => {
      it('should calculate wage income tax with default rate', () => {
        const tax = taxCalculationService.calculateWageIncomeTax(10000);
        expect(tax).toBe(6500); // 10000 * 0.65
      });

      it('should calculate wage income tax with custom rate', () => {
        const tax = taxCalculationService.calculateWageIncomeTax(10000, 0.50);
        expect(tax).toBe(5000); // 10000 * 0.50
      });
    });

    describe('calculateCapitalGainsTax', () => {
      it('should calculate long-term capital gains tax', () => {
        const tax = taxCalculationService.calculateCapitalGainsTax(5000, true);
        expect(tax).toBe(1250); // 5000 * 0.25
      });

      it('should calculate short-term capital gains tax', () => {
        const tax = taxCalculationService.calculateCapitalGainsTax(5000, false);
        expect(tax).toBe(3250); // 5000 * 0.65
      });

      it('should return 0 for losses', () => {
        const tax = taxCalculationService.calculateCapitalGainsTax(-1000, true);
        expect(tax).toBe(0);
      });

      it('should use custom rates', () => {
        const tax = taxCalculationService.calculateCapitalGainsTax(5000, true, 0.60, 0.20);
        expect(tax).toBe(1000); // 5000 * 0.20 (long-term custom rate)
      });
    });
  });

  describe('Optimal Timing Analysis', () => {
    describe('calculateOptimalTiming', () => {
      it('should recommend waiting for long-term treatment', async () => {
        // Create a grant that's not yet 2 years old (use current date - 1 year)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const recentGrant = await RSUGrant.create({
          userId: testUserId,
          stockSymbol: 'NVDA',
          grantDate: oneYearAgo,
          totalValue: 50000,
          totalShares: 500,
          pricePerShare: 100,
          currentPrice: 200,
          status: 'active',
          vestingSchedule: [
            {
              vestDate: new Date(oneYearAgo.getTime() + (90 * 24 * 60 * 60 * 1000)), // +3 months
              shares: 125,
              vested: true,
              vestedValue: 25000
            }
          ]
        });

        const analysis = await taxCalculationService.calculateOptimalTiming(
          recentGrant._id,
          100,
          200
        );

        expect(analysis.daysUntilLongTerm).toBeGreaterThan(0);
        expect(analysis.taxSavings).toBeGreaterThan(0);
        expect(analysis.recommendation).toContain('Consider waiting');
      });
    });
  });

  describe('Tax Liability Analysis', () => {
    describe('getTaxLiabilityByGrant', () => {
      it('should calculate tax liability for a grant', async () => {
        const liability = await taxCalculationService.getTaxLiabilityByGrant(testGrant._id);

        expect(liability.grantId).toBe(testGrant._id);
        expect(liability.stockSymbol).toBe('AAPL');
        expect(liability.totalShares).toBe(1000);
        expect(liability.realized).toBeDefined();
        expect(liability.unrealized).toBeDefined();
      });

      it('should throw error for non-existent grant', async () => {
        const fakeId = '507f1f77bcf86cd799439011';
        
        await expect(taxCalculationService.getTaxLiabilityByGrant(fakeId))
          .rejects.toThrow('Grant not found');
      });
    });

    describe('estimateUnrealizedTaxLiability', () => {
      it('should estimate tax liability for unrealized gains', () => {
        const estimate = taxCalculationService.estimateUnrealizedTaxLiability(testGrant, 100);

        expect(estimate.originalValue).toBe(10000); // 100 * 100
        expect(estimate.currentValue).toBe(15000); // 100 * 150
        expect(estimate.profit).toBe(5000);
        expect(estimate.estimatedTotalTax).toBeGreaterThan(0);
        expect(estimate.assumptions).toBeDefined();
      });

      it('should estimate with specific holding period', () => {
        const estimate = taxCalculationService.estimateUnrealizedTaxLiabilityWithPeriod(
          testGrant, 
          100, 
          false // short-term
        );

        expect(estimate.assumptions.longTermHolding).toBe(false);
        expect(estimate.assumptions.capitalGainsRate).toBe(0.65);
      });
    });
  });

  describe('Validation', () => {
    describe('validateTaxCalculationParams', () => {
      it('should validate correct parameters', () => {
        const params = {
          grantDate: new Date('2022-01-01'),
          saleDate: new Date('2024-01-01'),
          sharesAmount: 100,
          salePrice: 150,
          grantValue: 10000
        };

        const result = taxCalculationService.validateTaxCalculationParams(params);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect invalid dates', () => {
        const params = {
          grantDate: new Date('2024-01-01'),
          saleDate: new Date('2023-01-01'), // Before grant date
          sharesAmount: 100,
          salePrice: 150,
          grantValue: 10000
        };

        const result = taxCalculationService.validateTaxCalculationParams(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Sale date cannot be before grant date');
      });

      it('should detect invalid share amounts', () => {
        const params = {
          grantDate: new Date('2022-01-01'),
          saleDate: new Date('2024-01-01'),
          sharesAmount: 100.5, // Not a whole number
          salePrice: 150,
          grantValue: 10000
        };

        const result = taxCalculationService.validateTaxCalculationParams(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Shares amount must be a whole number');
      });

      it('should detect negative values', () => {
        const params = {
          grantDate: new Date('2022-01-01'),
          saleDate: new Date('2024-01-01'),
          sharesAmount: -100,
          salePrice: 150,
          grantValue: 10000
        };

        const result = taxCalculationService.validateTaxCalculationParams(params);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Shares amount must be greater than 0');
      });
    });
  });
});
