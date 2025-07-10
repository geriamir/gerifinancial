const mongoose = require('mongoose');
const { PendingTransaction, Transaction, Category, SubCategory, User } = require('../index');
const { createTestUser } = require('../../test/testUtils');
const { TransactionType, CategorizationMethod } = require('../../constants/enums');

describe('PendingTransaction Model', () => {
  let user, category, subCategory, accountId;

  beforeEach(async () => {
    const result = await createTestUser(User);
    user = result.user;
    category = await Category.create({
      name: 'Food',
      type: 'Expense',
      userId: user._id
    });
    subCategory = await SubCategory.create({
      name: 'Restaurant',
      parentCategory: category._id,
      userId: user._id
    });
    accountId = new mongoose.Types.ObjectId();
  });

  it('should create a pending transaction from scraper data', async () => {
    const scraperData = {
      identifier: 'tx123',
      date: new Date(),
      chargedAmount: -100,
      description: 'Test Restaurant',
      memo: 'Dinner',
      currency: 'ILS'
    };

    const pendingTx = await PendingTransaction.createFromScraperData(
      scraperData,
      accountId,
      'ILS',
      user._id
    );

    expect(pendingTx).toBeTruthy();
    expect(pendingTx.amount).toBe(-100);
    expect(pendingTx.type).toBe(TransactionType.EXPENSE);
    expect(pendingTx.description).toBe('Test Restaurant');
    expect(pendingTx.rawData).toEqual(scraperData);
  });

  it('should generate unique identifier if not provided by scraper', async () => {
    const scraperData = {
      date: new Date(),
      chargedAmount: -100,
      description: 'Test Restaurant',
      currency: 'ILS'
    };

    const pendingTx = await PendingTransaction.createFromScraperData(
      scraperData,
      accountId,
      'ILS',
      user._id
    );

    expect(pendingTx.identifier).toBeTruthy();
    expect(typeof pendingTx.identifier).toBe('string');
    expect(pendingTx.identifier).toContain(accountId.toString());
    expect(pendingTx.identifier).toContain('Test Restaurant');
  });

  it('should enforce amount validation based on transaction type', async () => {
    const expenseData = {
      identifier: 'exp1',
      userId: user._id,
      accountId,
      amount: 100, // Positive amount for expense - should fail
      currency: 'ILS',
      date: new Date(),
      type: TransactionType.EXPENSE,
      description: 'Test',
      rawData: {}
    };

    await expect(PendingTransaction.create(expenseData)).rejects.toThrow();

    const incomeData = {
      ...expenseData,
      identifier: 'inc1',
      amount: -100, // Negative amount for income - should fail
      type: TransactionType.INCOME
    };

    await expect(PendingTransaction.create(incomeData)).rejects.toThrow();
  });

  it('should categorize a pending transaction', async () => {
    const pendingTx = await PendingTransaction.create({
      identifier: 'tx123',
      userId: user._id,
      accountId,
      amount: -100,
      currency: 'ILS',
      date: new Date(),
      type: TransactionType.EXPENSE,
      description: 'Test Restaurant',
      rawData: {}
    });

    await pendingTx.categorize(
      category._id,
      subCategory._id,
      CategorizationMethod.MANUAL
    );

    const updated = await PendingTransaction.findById(pendingTx._id);
    expect(updated.category.toString()).toBe(category._id.toString());
    expect(updated.subCategory.toString()).toBe(subCategory._id.toString());
    expect(updated.categorizationMethod).toBe(CategorizationMethod.MANUAL);
    expect(updated.processedDate).toBeTruthy();
  });

  it('should verify and move to permanent storage', async () => {
    const pendingTx = await PendingTransaction.create({
      identifier: 'tx123',
      userId: user._id,
      accountId,
      amount: -100,
      currency: 'ILS',
      date: new Date(),
      type: TransactionType.EXPENSE,
      description: 'Test Restaurant',
      category: category._id,
      subCategory: subCategory._id,
      rawData: {}
    });

    const verifiedTx = await pendingTx.verify();

    // Check permanent transaction was created
    expect(verifiedTx).toBeTruthy();
    expect(verifiedTx.constructor.modelName).toBe('Transaction');
    expect(verifiedTx.amount).toBe(pendingTx.amount);
    expect(verifiedTx.category.toString()).toBe(category._id.toString());
    expect(verifiedTx.subCategory.toString()).toBe(subCategory._id.toString());

    // Check pending transaction was deleted
    const deletedPending = await PendingTransaction.findById(pendingTx._id);
    expect(deletedPending).toBeNull();
  });

  it('should require categorization before verification', async () => {
    const pendingTx = await PendingTransaction.create({
      identifier: 'tx123',
      userId: user._id,
      accountId,
      amount: -100,
      currency: 'ILS',
      date: new Date(),
      type: TransactionType.EXPENSE,
      description: 'Test Restaurant',
      rawData: {}
    });

    await expect(pendingTx.verify()).rejects.toThrow('Transaction must be categorized before verification');
  });
});
