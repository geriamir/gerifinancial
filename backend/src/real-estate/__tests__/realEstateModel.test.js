const mongoose = require('mongoose');
const RealEstateInvestment = require('../models/RealEstateInvestment');
const Tag = require('../../banking/models/Tag');
const User = require('../../auth/models/User');

describe('RealEstateInvestment Model', () => {
  let user;

  beforeEach(async () => {
    await RealEstateInvestment.deleteMany({});
    await Tag.deleteMany({});
    await User.deleteMany({});
    user = await global.createTestUser(User, 'realestate-model');
  });

  afterEach(async () => {
    await RealEstateInvestment.deleteMany({});
    await Tag.deleteMany({});
    await User.deleteMany({});
  });

  describe('Validation', () => {
    it('should create an investment with required fields', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Test Property',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 1000000
      });

      expect(inv.name).toBe('Test Property');
      expect(inv.type).toBe('rental');
      expect(inv.status).toBe('active');
      expect(inv.currency).toBe('ILS');
    });

    it('should require name and type', async () => {
      await expect(
        RealEstateInvestment.create({ userId: user._id })
      ).rejects.toThrow();
    });

    it('should enforce unique name per user', async () => {
      await RealEstateInvestment.create({
        userId: user._id,
        name: 'Unique Property',
        type: 'flip',
        currency: 'USD'
      });
      await RealEstateInvestment.ensureIndexes();

      await expect(
        RealEstateInvestment.create({
          userId: user._id,
          name: 'Unique Property',
          type: 'rental',
          currency: 'USD'
        })
      ).rejects.toThrow(/duplicate key/i);
    });
  });

  describe('Virtuals', () => {
    it('totalPendingInstallments should sum pending and overdue installments', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Installment Test',
        type: 'rental',
        currency: 'ILS',
        installments: [
          { description: 'Down payment', installmentType: 'investment', amount: 100000, currency: 'ILS', dueDate: new Date('2025-01-01'), status: 'pending' },
          { description: 'Tax', installmentType: 'tax', amount: 8000, currency: 'ILS', dueDate: new Date('2025-02-01'), status: 'overdue' },
          { description: 'Paid one', installmentType: 'investment', amount: 50000, currency: 'ILS', dueDate: new Date('2025-01-15'), status: 'paid' }
        ]
      });

      expect(inv.totalPendingInstallments).toBe(108000);
    });

    it('totalPaidInstallments should sum paid installments', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Paid Test',
        type: 'rental',
        currency: 'ILS',
        installments: [
          { description: 'First', installmentType: 'investment', amount: 100000, currency: 'ILS', dueDate: new Date(), status: 'paid' },
          { description: 'Second', installmentType: 'investment', amount: 50000, currency: 'ILS', dueDate: new Date(), status: 'paid' },
          { description: 'Third', installmentType: 'tax', amount: 8000, currency: 'ILS', dueDate: new Date(), status: 'pending' }
        ]
      });

      expect(inv.totalPaidInstallments).toBe(150000);
    });

    it('flipGain should calculate sale profit', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Flip Test',
        type: 'flip',
        currency: 'USD',
        totalInvestment: 200000,
        salePrice: 280000,
        saleExpenses: 10000
      });

      expect(inv.flipGain).toBe(70000); // 280000 - 10000 - 200000
    });

    it('flipGain should return null for non-flip or unsold', async () => {
      const rental = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Rental No Flip',
        type: 'rental',
        currency: 'USD'
      });
      expect(rental.flipGain).toBeNull();

      const unsold = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Unsold Flip',
        type: 'flip',
        currency: 'USD'
      });
      expect(unsold.flipGain).toBeNull();
    });

    it('totalRentalIncome should sum received income', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Rental Income Test',
        type: 'rental',
        currency: 'ILS',
        rentalIncome: [
          { month: new Date('2025-01-01'), expectedAmount: 5000, actualAmount: 5200, received: true },
          { month: new Date('2025-02-01'), expectedAmount: 5000, actualAmount: null, received: true },
          { month: new Date('2025-03-01'), expectedAmount: 5000, actualAmount: 4800, received: false }
        ]
      });

      // First: 5200 (actual), Second: 5000 (expected, no actual), Third: not received
      expect(inv.totalRentalIncome).toBe(10200);
    });

    it('estimatedMonthlyMortgage should calculate amortized payment', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Mortgage Test',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 1000000,
        mortgagePercentage: 75,
        mortgageInterestRate: 4,
        mortgageTermYears: 30
      });

      // Principal = 750,000, monthly rate = 0.04/12, n = 360
      expect(inv.estimatedMonthlyMortgage).toBeCloseTo(3580.16, 0);
    });

    it('estimatedMonthlyMortgage should return null when fields missing', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'No Mortgage',
        type: 'rental',
        currency: 'ILS'
      });
      expect(inv.estimatedMonthlyMortgage).toBeNull();
    });

    it('estimatedMonthlyMortgage should handle zero interest rate', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Zero Rate Mortgage',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 1000000,
        mortgagePercentage: 50,
        mortgageInterestRate: 0,
        mortgageTermYears: 25
      });

      // principal / (years * 12) = 500000 / 300
      expect(inv.estimatedMonthlyMortgage).toBeCloseTo(1666.67, 0);
    });
  });

  describe('createInvestmentTag', () => {
    it('should create a tag and link it to the investment', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Tag Property',
        type: 'rental',
        currency: 'ILS'
      });

      const tag = await inv.createInvestmentTag();

      expect(tag.name).toBe('realestate:tag-property');
      expect(tag.type).toBe('real-estate');
      expect(tag.userId.toString()).toBe(user._id.toString());

      const updated = await RealEstateInvestment.findById(inv._id);
      expect(updated.investmentTag.toString()).toBe(tag._id.toString());
    });

    it('should truncate tag name to 50 chars for long investment names', async () => {
      const longName = 'A'.repeat(100);
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: longName,
        type: 'flip',
        currency: 'USD'
      });

      const tag = await inv.createInvestmentTag();
      expect(tag.name.length).toBeLessThanOrEqual(50);
    });
  });

  describe('markSold', () => {
    it('should set sale fields and update status', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Sell Me',
        type: 'flip',
        currency: 'USD',
        totalInvestment: 200000
      });
      await inv.createInvestmentTag();

      await inv.markSold(350000, new Date('2025-06-15'), 15000);

      const updated = await RealEstateInvestment.findById(inv._id);
      expect(updated.status).toBe('sold');
      expect(updated.salePrice).toBe(350000);
      expect(updated.saleExpenses).toBe(15000);
      expect(updated.saleDate).toEqual(new Date('2025-06-15'));
    });

    it('should update tag status to sold', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Tag Sold',
        type: 'flip',
        currency: 'USD'
      });
      const tag = await inv.createInvestmentTag();
      await inv.markSold(500000);

      const updatedTag = await Tag.findById(tag._id);
      expect(updatedTag.projectMetadata.status).toBe('sold');
    });
  });

  describe('updateOverdueInstallments', () => {
    it('should mark past-due pending installments as overdue', async () => {
      const pastDate = new Date('2020-01-01');
      const futureDate = new Date('2030-01-01');

      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Overdue Test',
        type: 'rental',
        currency: 'ILS',
        installments: [
          { description: 'Past due', installmentType: 'investment', amount: 50000, currency: 'ILS', dueDate: pastDate, status: 'pending' },
          { description: 'Future', installmentType: 'investment', amount: 30000, currency: 'ILS', dueDate: futureDate, status: 'pending' },
          { description: 'Already paid', installmentType: 'tax', amount: 8000, currency: 'ILS', dueDate: pastDate, status: 'paid' }
        ]
      });

      const changed = inv.updateOverdueInstallments();
      expect(changed).toBe(true);
      expect(inv.installments[0].status).toBe('overdue');
      expect(inv.installments[1].status).toBe('pending');
      expect(inv.installments[2].status).toBe('paid');
    });

    it('should return false when nothing changes', async () => {
      const futureDate = new Date('2030-01-01');
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'No Change',
        type: 'rental',
        currency: 'ILS',
        installments: [
          { description: 'Future', installmentType: 'investment', amount: 50000, currency: 'ILS', dueDate: futureDate, status: 'pending' }
        ]
      });

      expect(inv.updateOverdueInstallments()).toBe(false);
    });
  });

  describe('JSON serialization', () => {
    it('should include virtuals in JSON output', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'JSON Test',
        type: 'rental',
        currency: 'ILS',
        installments: [
          { description: 'Pending', installmentType: 'investment', amount: 100000, currency: 'ILS', dueDate: new Date(), status: 'pending' }
        ]
      });

      const json = inv.toJSON();
      expect(json).toHaveProperty('totalPendingInstallments');
      expect(json).toHaveProperty('totalPaidInstallments');
      expect(json).toHaveProperty('totalRentalIncome');
    });
  });

  describe('generateAutoInstallments', () => {
    it('should create mortgage and final payment installments', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Auto Installment Test',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 1000000,
        mortgagePercentage: 75,
        purchaseTaxRate: 8
      });

      inv.generateAutoInstallments();

      const mortgage = inv.installments.find(i => i.autoGenerated === 'mortgage');
      const finalPay = inv.installments.find(i => i.autoGenerated === 'final-payment');

      expect(mortgage).toBeTruthy();
      expect(mortgage.amount).toBe(750000);
      expect(mortgage.percentage).toBe(75);
      expect(mortgage.installmentType).toBe('investment');

      // Final = (1M + 80K tax) - 750K mortgage = 330K
      expect(finalPay).toBeTruthy();
      expect(finalPay.amount).toBe(330000);
      expect(finalPay.includeTax).toBe(true);
      expect(finalPay.taxPercentage).toBe(8);
    });

    it('should subtract manual investment installments from final payment', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Manual Deduct Test',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 1000000,
        mortgagePercentage: 50,
        purchaseTaxRate: 8,
        installments: [
          { description: 'Down payment', installmentType: 'investment', amount: 100000, currency: 'ILS', dueDate: new Date('2025-06-01') },
          { description: 'Lawyer fees', installmentType: 'lawyer', amount: 20000, currency: 'ILS', dueDate: new Date('2025-06-01') }
        ]
      });

      inv.generateAutoInstallments();

      const mortgage = inv.installments.find(i => i.autoGenerated === 'mortgage');
      const finalPay = inv.installments.find(i => i.autoGenerated === 'final-payment');

      expect(mortgage.amount).toBe(500000);
      // Total required = 1M + 80K tax = 1,080K
      // Investment installments = 500K mortgage + 100K down payment = 600K
      // (lawyer 20K is NOT investment type, so excluded)
      // Final = 1,080K - 600K = 480K
      expect(finalPay.amount).toBe(480000);
    });

    it('should create only final payment when no mortgage', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'No Mortgage Auto',
        type: 'flip',
        currency: 'USD',
        estimatedCurrentValue: 500000,
        purchaseTaxRate: 5
      });

      inv.generateAutoInstallments();

      const mortgage = inv.installments.find(i => i.autoGenerated === 'mortgage');
      const finalPay = inv.installments.find(i => i.autoGenerated === 'final-payment');

      expect(mortgage).toBeUndefined();
      expect(finalPay).toBeTruthy();
      expect(finalPay.amount).toBe(525000); // 500K + 25K tax
    });

    it('should preserve paid auto-generated installments and not duplicate', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Preserve Paid',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 1000000,
        mortgagePercentage: 50
      });

      inv.generateAutoInstallments();
      const originalFinalPay = inv.installments.find(i => i.autoGenerated === 'final-payment');
      const originalFinalAmount = originalFinalPay.amount;

      // Mark mortgage as paid
      const mortgage = inv.installments.find(i => i.autoGenerated === 'mortgage');
      mortgage.status = 'paid';
      mortgage.paidDate = new Date();
      await inv.save();

      // Regenerate — paid mortgage preserved, no duplicate created
      inv.generateAutoInstallments();

      const mortgages = inv.installments.filter(i => i.autoGenerated === 'mortgage');
      expect(mortgages).toHaveLength(1);
      expect(mortgages[0].status).toBe('paid');

      // Final payment should still be correct
      const finalPay = inv.installments.find(i => i.autoGenerated === 'final-payment');
      expect(finalPay).toBeTruthy();
      expect(finalPay.amount).toBe(originalFinalAmount);
    });

    it('should not create installments when value is 0', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'Zero Value',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 0
      });

      inv.generateAutoInstallments();
      expect(inv.installments).toHaveLength(0);
    });
  });
});
