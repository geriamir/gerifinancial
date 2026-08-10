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
});
