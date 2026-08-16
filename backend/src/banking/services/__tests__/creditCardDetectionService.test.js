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
    const bankAccount = (bankId, name) => ({
      _id: new mongoose.Types.ObjectId(),
      bankId,
      name
    });

    const card = (providerAccount, suffix) => ({
      _id: new mongoose.Types.ObjectId(),
      displayName: `${providerAccount.name} ${suffix}`,
      cardNumber: `****${suffix}`,
      lastFourDigits: suffix,
      bankAccountId: providerAccount
    });

    const payment = (description, amount, date = '2026-08-09T21:00:00.000Z') => ({
      _id: new mongoose.Types.ObjectId(),
      date: new Date(date),
      description,
      amount: -amount,
      rawData: { description }
    });

    it('uses CAL debit date to select the correct generic payment', async () => {
      const visaCal = bankAccount('visaCal', 'Visa Cal');
      const visaCalCard = card(visaCal, '1111');
      const results = await creditCardDetectionService.matchPaymentsToCards(
        [
          payment('ישראכרט בע"מ-י', 391),
          payment('כרטיסי אשראי-י', 34208.45),
          payment('כרטיסי אשראי-י', 5243.79)
        ],
        [{
          creditCards: [visaCalCard],
          provider: 'visaCal',
          displayName: 'Visa Cal',
          debitDate: new Date('2026-08-10T00:00:00.000Z'),
          debitDateKey: '2026-08-10',
          totalSpent: 31131.79,
          transactionCount: 83
        }]
      );

      expect(results.coveredCount).toBe(1);
      expect(results.uncoveredCount).toBe(2);
      expect(results.matchedPayments[0]).toEqual(expect.objectContaining({
        payment: expect.objectContaining({ amount: 34208.45 }),
        matchedAmount: 31131.79,
        matchType: 'debit_date_match',
        matchConfidence: 91
      }));
      expect(results.uncoveredPayments.map(item => item.description)).toEqual(
        expect.arrayContaining(['ישראכרט בע"מ-י', 'כרטיסי אשראי-י'])
      );
    });

    it('does not match an explicitly named provider to another provider', async () => {
      const visaCal = bankAccount('visaCal', 'Visa Cal');
      const results = await creditCardDetectionService.matchPaymentsToCards(
        [payment('ישראכרט בע"מ-י', 10000)],
        [{
          creditCards: [card(visaCal, '2222')],
          provider: 'visaCal',
          displayName: 'Visa Cal',
          debitDate: new Date('2026-08-10T00:00:00.000Z'),
          debitDateKey: '2026-08-10',
          totalSpent: 10000,
          transactionCount: 1
        }]
      );

      expect(results.coveredCount).toBe(0);
      expect(results.uncoveredCount).toBe(1);
    });

    it('uses each provider debit total only once', async () => {
      const visaCal = bankAccount('visaCal', 'Visa Cal');
      const results = await creditCardDetectionService.matchPaymentsToCards(
        [
          payment('כרטיסי אשראי-י', 10000),
          payment('כרטיסי אשראי-י', 10000)
        ],
        [{
          creditCards: [card(visaCal, '3333')],
          provider: 'visaCal',
          displayName: 'Visa Cal',
          debitDate: new Date('2026-08-10T00:00:00.000Z'),
          debitDateKey: '2026-08-10',
          totalSpent: 10000,
          transactionCount: 1
        }]
      );

      expect(results.coveredCount).toBe(1);
      expect(results.uncoveredCount).toBe(1);
    });

    it('does not assign a provider-wide debit to an arbitrary physical card', async () => {
      const visaCal = bankAccount('visaCal', 'Visa Cal');
      const results = await creditCardDetectionService.matchPaymentsToCards(
        [payment('כרטיסי אשראי-י', 300)],
        [{
          creditCards: [card(visaCal, '4444'), card(visaCal, '5555')],
          provider: 'visaCal',
          displayName: 'Visa Cal',
          debitDate: new Date('2026-08-10T00:00:00.000Z'),
          debitDateKey: '2026-08-10',
          totalSpent: 300,
          transactionCount: 2
        }]
      );

      expect(results.matchedPayments[0].matchedCreditCard).toEqual(expect.objectContaining({
        id: null,
        provider: 'visaCal'
      }));
    });

    it('aggregates all physical cards and categories on the provider debit date', async () => {
      const visaCal = bankAccount('visaCal', 'Visa Cal');
      const firstCard = card(visaCal, '4444');
      const secondCard = card(visaCal, '5555');
      const transfer = await Category.create({
        name: 'Transfer',
        type: 'Transfer',
        userId
      });
      const accountId = new mongoose.Types.ObjectId();

      await Transaction.create([
        {
          identifier: 'cal-first-card',
          userId,
          accountId,
          creditCardId: firstCard._id,
          amount: -100,
          currency: 'ILS',
          date: new Date('2026-08-01T00:00:00.000Z'),
          processedDate: new Date('2026-08-10T00:00:00.000Z'),
          description: 'Purchase one',
          rawData: {}
        },
        {
          identifier: 'cal-second-card',
          userId,
          accountId,
          creditCardId: secondCard._id,
          amount: -200,
          currency: 'ILS',
          date: new Date('2026-08-02T00:00:00.000Z'),
          processedDate: new Date('2026-08-10T00:00:00.000Z'),
          description: 'Purchase two',
          rawData: {}
        },
        {
          identifier: 'cal-transfer-category',
          userId,
          accountId,
          creditCardId: firstCard._id,
          amount: -25,
          currency: 'ILS',
          date: new Date('2026-08-03T00:00:00.000Z'),
          processedDate: new Date('2026-08-10T00:00:00.000Z'),
          description: 'BIT',
          category: transfer._id,
          rawData: {}
        }
      ]);

      const totals = await creditCardDetectionService.getCreditCardDebitTotals(
        [firstCard, secondCard],
        new Date('2026-08-01T00:00:00.000Z')
      );

      expect(totals).toEqual([expect.objectContaining({
        provider: 'visaCal',
        debitDateKey: '2026-08-10',
        totalSpent: 325,
        transactionCount: 3,
        creditCards: expect.arrayContaining([firstCard, secondCard])
      })]);
    });
  });
});
