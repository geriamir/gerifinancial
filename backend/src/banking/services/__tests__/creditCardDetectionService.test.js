const mongoose = require('mongoose');
const creditCardDetectionService = require('../creditCardDetectionService');
const creditCardOnboardingService = require('../creditCardOnboardingService');
const { Category, Transaction } = require('../../models');

describe('CreditCardDetectionService', () => {
  let userId;

  beforeEach(async () => {
    await Promise.all([
      Category.deleteMany({}),
      Transaction.deleteMany({})
    ]);
    userId = new mongoose.Types.ObjectId();
  });

  it('recognizes a card settlement even when AI assigned an expense category', async () => {
    const financialServices = await Category.create({
      name: 'Financial Services',
      type: 'Expense',
      userId
    });
    const descriptions = [
      'כרטיסי אשראי-י',
      'ישראכרט בע"מ-י',
      'דיינרס קלוב-י',
      'Isracard monthly payment',
      'CAL monthly payment',
      'MAX monthly payment'
    ];
    await Transaction.create(descriptions.map((description, index) => ({
      identifier: `miscategorized-card-payment-${index}`,
      userId,
      accountId: new mongoose.Types.ObjectId(),
      amount: -10009.46,
      currency: 'ILS',
      date: new Date(),
      description,
      type: 'Expense',
      category: financialServices._id,
      categorizationMethod: 'ai',
      rawData: { description }
    })));

    const analysis = await creditCardDetectionService.analyzeCreditCardUsage(userId, 2);
    const paymentMonths = await creditCardOnboardingService.getCreditCardPaymentTransactions(
      userId,
      new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    );

    expect(analysis.transactionCount).toBe(6);
    expect(analysis.recommendation).toBe('connect');
    expect(analysis.suggestedProviders).toEqual([
      { bankId: 'isracard', paymentCount: 2 },
      { bankId: 'visaCal', paymentCount: 2 },
      { bankId: 'max', paymentCount: 1 }
    ]);
    expect(paymentMonths).toEqual([
      expect.objectContaining({
        transactionCount: 6,
        transactions: expect.arrayContaining(
          descriptions.map(description => expect.objectContaining({ description }))
        )
      })
    ]);
  });

  it('still recognizes transactions categorized as Credit Card transfers', async () => {
    const creditCard = await Category.create({
      name: 'Credit Card',
      type: 'Transfer',
      userId
    });
    await Transaction.create({
      identifier: 'categorized-card-payment',
      userId,
      accountId: new mongoose.Types.ObjectId(),
      amount: -1234,
      currency: 'ILS',
      date: new Date(),
      description: 'Monthly settlement',
      type: 'Transfer',
      category: creditCard._id,
      rawData: { description: 'Monthly settlement' }
    });

    expect((await creditCardDetectionService.analyzeCreditCardUsage(userId, 2)).transactionCount)
      .toBe(1);
  });

  it('does not treat an unrelated financial-services expense as a card payment', async () => {
    const financialServices = await Category.create({
      name: 'Financial Services',
      type: 'Expense',
      userId
    });
    await Transaction.create({
      identifier: 'ordinary-financial-service',
      userId,
      accountId: new mongoose.Types.ObjectId(),
      amount: -50,
      currency: 'ILS',
      date: new Date(),
      description: 'Account service fee',
      type: 'Expense',
      category: financialServices._id,
      rawData: { description: 'Account service fee' }
    });

    expect((await creditCardDetectionService.analyzeCreditCardUsage(userId, 2)).transactionCount)
      .toBe(0);
  });

  it('does not mistake a provider-like merchant name for a card settlement', async () => {
    await Transaction.create({
      identifier: 'max-stock-purchase',
      userId,
      accountId: new mongoose.Types.ObjectId(),
      amount: -150,
      currency: 'ILS',
      date: new Date(),
      description: 'מקס סטוק',
      type: 'Expense',
      rawData: { description: 'מקס סטוק' }
    });

    expect((await creditCardDetectionService.analyzeCreditCardUsage(userId, 2)).transactionCount)
      .toBe(0);
  });

  it('does not mistake a credit-card fee for a card settlement', async () => {
    await Transaction.create({
      identifier: 'credit-card-fee',
      userId,
      accountId: new mongoose.Types.ObjectId(),
      amount: -20,
      currency: 'ILS',
      date: new Date(),
      description: 'עמלת כרטיס אשראי',
      type: 'Expense',
      rawData: { description: 'עמלת כרטיס אשראי' }
    });

    expect((await creditCardDetectionService.analyzeCreditCardUsage(userId, 2)).transactionCount)
      .toBe(0);
  });

  describe('payment coverage matching', () => {
    const card = (bankId, suffix) => ({
      _id: new mongoose.Types.ObjectId(),
      displayName: `${bankId} ${suffix}`,
      cardNumber: `****${suffix}`,
      lastFourDigits: suffix,
      bankAccountId: { bankId }
    });

    const monthlyTotal = (creditCard, year, month, totalSpent, source = 'transactions') => ({
      creditCard,
      year,
      month,
      monthString: `${year}-${String(month).padStart(2, '0')}`,
      totalSpent,
      transactionCount: 1,
      source
    });

    const payment = (description, amount) => ({
      _id: new mongoose.Types.ObjectId(),
      date: new Date('2026-08-10T00:00:00.000Z'),
      description,
      amount: -amount,
      rawData: { description }
    });

    it('matches the production-shaped Visa Cal statement to the exact month', async () => {
      const visaCalCard = card('visaCal', '1111');
      const results = await creditCardDetectionService.matchPaymentsToCards(
        [
          payment('ישראכרט בע"מ-י', 391),
          payment('כרטיסי אשראי-י', 34208.45),
          payment('כרטיסי אשראי-י', 5243.79)
        ],
        [
          monthlyTotal(visaCalCard, 2026, 7, 33226.51),
          monthlyTotal(visaCalCard, 2026, 8, 34208.45, 'statement')
        ]
      );

      expect(results.coveredCount).toBe(1);
      expect(results.uncoveredCount).toBe(2);
      expect(results.matchedPayments[0]).toEqual(expect.objectContaining({
        matchedMonth: '2026-08',
        matchType: 'statement_date_match',
        matchConfidence: 100
      }));
      expect(results.uncoveredPayments.map(item => item.description)).toEqual(
        expect.arrayContaining(['ישראכרט בע"מ-י', 'כרטיסי אשראי-י'])
      );
    });

    it('does not match an explicitly named provider to a different provider', async () => {
      const results = await creditCardDetectionService.matchPaymentsToCards(
        [payment('ישראכרט בע"מ-י', 10000)],
        [monthlyTotal(card('visaCal', '2222'), 2026, 8, 10000)]
      );

      expect(results.coveredCount).toBe(0);
      expect(results.uncoveredCount).toBe(1);
    });

    it('uses each monthly statement total only once', async () => {
      const results = await creditCardDetectionService.matchPaymentsToCards(
        [
          payment('כרטיסי אשראי-י', 10000),
          payment('כרטיסי אשראי-י', 10000)
        ],
        [monthlyTotal(card('visaCal', '3333'), 2026, 8, 10000)]
      );

      expect(results.coveredCount).toBe(1);
      expect(results.uncoveredCount).toBe(1);
    });

    it('uses an imported statement total instead of reconstructing that month from transactions', async () => {
      const visaCalCard = card('visaCal', '4444');
      visaCalCard.bankAccountId.defaultCurrency = 'ILS';
      visaCalCard.statements = [{
        date: new Date('2026-08-10T00:00:00.000Z'),
        amount: -34208.45,
        currency: '₪',
        transactionAmount: -31131.79
      }];

      const totals = await creditCardDetectionService.getCreditCardMonthlyTotals(
        [visaCalCard],
        new Date('2026-07-01T00:00:00.000Z')
      );

      expect(totals).toEqual([expect.objectContaining({
        monthString: '2026-08',
        totalSpent: 34208.45,
        transactionTotal: 31131.79,
        source: 'statement'
      })]);
    });
  });
});
