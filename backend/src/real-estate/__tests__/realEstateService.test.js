const mongoose = require('mongoose');
const RealEstateInvestment = require('../models/RealEstateInvestment');
const Tag = require('../../banking/models/Tag');
const Transaction = require('../../banking/models/Transaction');
const BankAccount = require('../../banking/models/BankAccount');
const User = require('../../auth/models/User');
const realEstateService = require('../services/realEstateService');
const realEstateTransactionService = require('../services/realEstateTransactionService');

describe('RealEstateService', () => {
  let user;

  beforeEach(async () => {
    await RealEstateInvestment.deleteMany({});
    await Tag.deleteMany({});
    await Transaction.deleteMany({});
    await BankAccount.deleteMany({});
    await User.deleteMany({});
    user = await global.createTestUser(User, 'realestate-svc');
  });

  afterEach(async () => {
    await RealEstateInvestment.deleteMany({});
    await Tag.deleteMany({});
    await Transaction.deleteMany({});
    await BankAccount.deleteMany({});
    await User.deleteMany({});
  });

  describe('create', () => {
    it('should create an investment and auto-create a tag', async () => {
      const result = await realEstateService.create(user._id, {
        name: 'My Property',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 500000
      });

      expect(result.name).toBe('My Property');
      expect(result.investmentTag).toBeTruthy();

      const tag = await Tag.findById(result.investmentTag);
      expect(tag).toBeTruthy();
      expect(tag.type).toBe('real-estate');
    });

    it('should prevent userId override from request body', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const result = await realEstateService.create(user._id, {
        name: 'Secure Property',
        type: 'flip',
        currency: 'USD',
        userId: otherUserId // should be ignored
      });

      expect(result.userId.toString()).toBe(user._id.toString());
    });
  });

  describe('getAll', () => {
    it('should return investments with actualInvested', async () => {
      const inv = await realEstateService.create(user._id, {
        name: 'List Test',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 1000000
      });

      const results = await realEstateService.getAll(user._id);
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('actualInvested');
      expect(results[0].actualInvested).toBe(0);
    });
  });

  describe('update', () => {
    it('should update fields and prevent userId change', async () => {
      const inv = await realEstateService.create(user._id, {
        name: 'Update Me',
        type: 'rental',
        currency: 'ILS'
      });

      const updated = await realEstateService.update(inv._id, user._id, {
        name: 'Updated Name',
        userId: new mongoose.Types.ObjectId()
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.userId.toString()).toBe(user._id.toString());
    });

    it('should return null for non-existent investment', async () => {
      const result = await realEstateService.update(
        new mongoose.Types.ObjectId(), user._id, { name: 'Nope' }
      );
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an investment', async () => {
      const inv = await realEstateService.create(user._id, {
        name: 'Delete Me',
        type: 'flip',
        currency: 'USD'
      });

      const result = await realEstateService.delete(inv._id, user._id);
      expect(result).toBeTruthy();

      const found = await RealEstateInvestment.findById(inv._id);
      expect(found).toBeNull();
    });
  });

  describe('Installment management', () => {
    let investment;

    beforeEach(async () => {
      investment = await realEstateService.create(user._id, {
        name: 'Installment Prop',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 800000
      });
    });

    it('should add an installment', async () => {
      const result = await realEstateService.addInstallment(investment._id, user._id, {
        description: 'Down payment',
        installmentType: 'investment',
        amount: 160000,
        currency: 'ILS',
        dueDate: new Date('2025-06-01')
      });

      expect(result.installments).toHaveLength(1);
      expect(result.installments[0].description).toBe('Down payment');
      expect(result.installments[0].status).toBe('pending');
    });

    it('should update an installment and set paidDate on paid status', async () => {
      const added = await realEstateService.addInstallment(investment._id, user._id, {
        description: 'Payment',
        installmentType: 'investment',
        amount: 100000,
        currency: 'ILS',
        dueDate: new Date('2025-06-01')
      });

      const installmentId = added.installments[0]._id;
      const result = await realEstateService.updateInstallment(
        investment._id, user._id, installmentId, { status: 'paid' }
      );

      expect(result.installments[0].status).toBe('paid');
      expect(result.installments[0].paidDate).toBeTruthy();
    });

    it('should delete an installment', async () => {
      const added = await realEstateService.addInstallment(investment._id, user._id, {
        description: 'To Delete',
        installmentType: 'other',
        amount: 5000,
        currency: 'ILS',
        dueDate: new Date('2025-06-01')
      });

      const result = await realEstateService.deleteInstallment(
        investment._id, user._id, added.installments[0]._id
      );

      expect(result.installments).toHaveLength(0);
    });

    it('should link a transaction and set status to paid', async () => {
      const added = await realEstateService.addInstallment(investment._id, user._id, {
        description: 'Link Test',
        installmentType: 'investment',
        amount: 100000,
        currency: 'ILS',
        dueDate: new Date('2025-06-01')
      });

      const txId = new mongoose.Types.ObjectId();
      const result = await realEstateService.linkTransactionToInstallment(
        investment._id, user._id, added.installments[0]._id, txId
      );

      expect(result.installments[0].linkedTransactions).toHaveLength(1);
      expect(result.installments[0].status).toBe('paid');
      expect(result.installments[0].paidDate).toBeTruthy();
    });

    it('should not duplicate linked transaction', async () => {
      const added = await realEstateService.addInstallment(investment._id, user._id, {
        description: 'Dedup Test',
        installmentType: 'investment',
        amount: 100000,
        currency: 'ILS',
        dueDate: new Date('2025-06-01')
      });

      const txId = new mongoose.Types.ObjectId();
      await realEstateService.linkTransactionToInstallment(
        investment._id, user._id, added.installments[0]._id, txId
      );
      const result = await realEstateService.linkTransactionToInstallment(
        investment._id, user._id, added.installments[0]._id, txId
      );

      expect(result.installments[0].linkedTransactions).toHaveLength(1);
    });

    it('should unlink transaction and revert status to pending/overdue', async () => {
      const added = await realEstateService.addInstallment(investment._id, user._id, {
        description: 'Unlink Test',
        installmentType: 'investment',
        amount: 100000,
        currency: 'ILS',
        dueDate: new Date('2030-01-01')
      });

      const txId = new mongoose.Types.ObjectId();
      await realEstateService.linkTransactionToInstallment(
        investment._id, user._id, added.installments[0]._id, txId
      );

      const result = await realEstateService.unlinkTransactionFromInstallment(
        investment._id, user._id, added.installments[0]._id, txId
      );

      expect(result.installments[0].linkedTransactions).toHaveLength(0);
      expect(result.installments[0].status).toBe('pending');
      expect(result.installments[0].paidDate).toBeNull();
    });

    it('should revert to overdue when unlinking if due date is past', async () => {
      const added = await realEstateService.addInstallment(investment._id, user._id, {
        description: 'Overdue Unlink',
        installmentType: 'investment',
        amount: 100000,
        currency: 'ILS',
        dueDate: new Date('2020-01-01')
      });

      const txId = new mongoose.Types.ObjectId();
      await realEstateService.linkTransactionToInstallment(
        investment._id, user._id, added.installments[0]._id, txId
      );

      const result = await realEstateService.unlinkTransactionFromInstallment(
        investment._id, user._id, added.installments[0]._id, txId
      );

      expect(result.installments[0].status).toBe('overdue');
    });
  });

  describe('linkBankAccount', () => {
    it('should link a bank account owned by the user', async () => {
      const account = await BankAccount.create({
        userId: user._id,
        bankId: 'hapoalim',
        name: 'Test Account',
        credentials: { username: 'test', password: 'test' },
        type: 'checking'
      });

      const inv = await realEstateService.create(user._id, {
        name: 'Link Account Test',
        type: 'rental',
        currency: 'ILS'
      });

      const result = await realEstateService.linkBankAccount(inv._id, user._id, account._id);
      expect(result.linkedBankAccountId.toString()).toBe(account._id.toString());
    });

    it('should reject linking another user\'s bank account', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherAccount = await BankAccount.create({
        userId: otherUserId,
        bankId: 'leumi',
        name: 'Other Account',
        credentials: { username: 'other', password: 'other' },
        type: 'checking'
      });

      const inv = await realEstateService.create(user._id, {
        name: 'Security Test',
        type: 'rental',
        currency: 'ILS'
      });

      await expect(
        realEstateService.linkBankAccount(inv._id, user._id, otherAccount._id)
      ).rejects.toThrow(/not found or does not belong/);
    });
  });

  describe('markSold', () => {
    it('should mark investment as sold via service', async () => {
      const inv = await realEstateService.create(user._id, {
        name: 'Sell Via Service',
        type: 'flip',
        currency: 'USD',
        totalInvestment: 200000
      });

      const result = await realEstateService.markSold(inv._id, user._id, {
        salePrice: 350000,
        saleDate: new Date('2025-06-15'),
        saleExpenses: 10000
      });

      expect(result.status).toBe('sold');
      expect(result.salePrice).toBe(350000);
    });
  });

  describe('getSummary', () => {
    it('should compute summary with correct counts', async () => {
      await realEstateService.create(user._id, {
        name: 'Rental 1',
        type: 'rental',
        currency: 'ILS',
        estimatedCurrentValue: 1000000,
        installments: [
          { description: 'Payment', installmentType: 'investment', amount: 200000, currency: 'ILS', dueDate: new Date('2030-01-01'), status: 'pending' }
        ]
      });

      await realEstateService.create(user._id, {
        name: 'Flip 1',
        type: 'flip',
        currency: 'ILS',
        estimatedCurrentValue: 500000
      });

      const summary = await realEstateService.getSummary(user._id, 'ILS');

      expect(summary.totalInvestments).toBe(2);
      expect(summary.activeRentals).toBe(1);
      expect(summary.activeFlips).toBe(1);
      expect(summary.totalEstimatedValue).toBeGreaterThanOrEqual(1500000);
      expect(summary.currency).toBe('ILS');
    });

    it('should return zero totals for user with no investments', async () => {
      const summary = await realEstateService.getSummary(user._id, 'ILS');

      expect(summary.totalInvestments).toBe(0);
      expect(summary.totalInvested).toBe(0);
      expect(summary.totalEstimatedValue).toBe(0);
      expect(summary.totalInstallments).toBe(0);
      expect(summary.totalPaidInstallments).toBe(0);
    });
  });
});

describe('RealEstateTransactionService', () => {
  let user, account;

  beforeEach(async () => {
    await RealEstateInvestment.deleteMany({});
    await Tag.deleteMany({});
    await Transaction.deleteMany({});
    await BankAccount.deleteMany({});
    await User.deleteMany({});
    user = await global.createTestUser(User, 'realestate-txn');
    account = await BankAccount.create({
      userId: user._id,
      bankId: 'hapoalim',
      name: 'Test Account',
      credentials: { username: 'test', password: 'test' },
      type: 'checking'
    });
  });

  afterEach(async () => {
    await RealEstateInvestment.deleteMany({});
    await Tag.deleteMany({});
    await Transaction.deleteMany({});
    await BankAccount.deleteMany({});
    await User.deleteMany({});
  });

  async function createInvestmentWithTag(name = 'Test Investment') {
    const inv = await RealEstateInvestment.create({
      userId: user._id,
      name,
      type: 'rental',
      currency: 'ILS',
      linkedBankAccountId: account._id
    });
    await inv.createInvestmentTag();
    return RealEstateInvestment.findById(inv._id);
  }

  async function createTransaction(overrides = {}) {
    return Transaction.create({
      userId: user._id,
      accountId: account._id,
      date: new Date(),
      description: 'Test transaction',
      amount: -50000,
      currency: 'ILS',
      identifier: `tx-${Date.now()}-${Math.random()}`,
      rawData: { source: 'test' },
      ...overrides
    });
  }

  describe('tagTransaction', () => {
    it('should tag a transaction to an investment', async () => {
      const inv = await createInvestmentWithTag();
      const tx = await createTransaction();

      const result = await realEstateTransactionService.tagTransaction(inv._id, user._id, tx._id);

      expect(result.tags.map(t => t.toString())).toContain(inv.investmentTag.toString());
    });

    it('should not duplicate tags', async () => {
      const inv = await createInvestmentWithTag();
      const tx = await createTransaction();

      await realEstateTransactionService.tagTransaction(inv._id, user._id, tx._id);
      const result = await realEstateTransactionService.tagTransaction(inv._id, user._id, tx._id);

      const tagCount = result.tags.filter(t => t.toString() === inv.investmentTag.toString()).length;
      expect(tagCount).toBe(1);
    });

    it('should throw when investment not found', async () => {
      const tx = await createTransaction();
      await expect(
        realEstateTransactionService.tagTransaction(new mongoose.Types.ObjectId(), user._id, tx._id)
      ).rejects.toThrow(/not found/);
    });

    it('should throw when transaction not found', async () => {
      const inv = await createInvestmentWithTag();
      await expect(
        realEstateTransactionService.tagTransaction(inv._id, user._id, new mongoose.Types.ObjectId())
      ).rejects.toThrow(/not found/);
    });
  });

  describe('untagTransaction', () => {
    it('should remove the investment tag from a transaction', async () => {
      const inv = await createInvestmentWithTag();
      const tx = await createTransaction();

      await realEstateTransactionService.tagTransaction(inv._id, user._id, tx._id);
      const result = await realEstateTransactionService.untagTransaction(inv._id, user._id, tx._id);

      expect(result.tags.map(t => t.toString())).not.toContain(inv.investmentTag.toString());
    });
  });

  describe('getTransactions', () => {
    it('should return tagged transactions', async () => {
      const inv = await createInvestmentWithTag();
      const tx1 = await createTransaction({ description: 'Tagged', identifier: 'tagged-1' });
      const tx2 = await createTransaction({ description: 'Untagged', identifier: 'untagged-1' });

      await realEstateTransactionService.tagTransaction(inv._id, user._id, tx1._id);

      const results = await realEstateTransactionService.getTransactions(inv._id, user._id);
      expect(results).toHaveLength(1);
      expect(results[0]._id.toString()).toBe(tx1._id.toString());
    });

    it('should return empty array for investment without tag', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'No Tag',
        type: 'rental',
        currency: 'ILS'
      });

      const results = await realEstateTransactionService.getTransactions(inv._id, user._id);
      expect(results).toEqual([]);
    });
  });

  describe('autoTagLinkedAccountTransactions', () => {
    it('should bulk-tag all untagged transactions from linked account', async () => {
      const inv = await createInvestmentWithTag();
      await createTransaction({ identifier: 'auto-1' });
      await createTransaction({ identifier: 'auto-2' });
      await createTransaction({ identifier: 'auto-3' });

      const result = await realEstateTransactionService.autoTagLinkedAccountTransactions(inv._id, user._id);
      expect(result.tagged).toBe(3);

      const transactions = await Transaction.find({ tags: inv.investmentTag });
      expect(transactions).toHaveLength(3);
    });

    it('should not re-tag already tagged transactions', async () => {
      const inv = await createInvestmentWithTag();
      const tx = await createTransaction({ identifier: 'already-tagged' });
      await realEstateTransactionService.tagTransaction(inv._id, user._id, tx._id);

      const result = await realEstateTransactionService.autoTagLinkedAccountTransactions(inv._id, user._id);
      expect(result.tagged).toBe(0);
    });

    it('should return tagged: 0 when no linked account', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'No Account',
        type: 'rental',
        currency: 'ILS'
      });
      await inv.createInvestmentTag();

      const result = await realEstateTransactionService.autoTagLinkedAccountTransactions(inv._id, user._id);
      expect(result.tagged).toBe(0);
    });
  });

  describe('getTransactionTotals', () => {
    it('should group totals by currency with negated amounts', async () => {
      const inv = await createInvestmentWithTag();
      const tx1 = await createTransaction({ amount: -100000, currency: 'ILS', identifier: 'total-1' });
      const tx2 = await createTransaction({ amount: -50000, currency: 'ILS', identifier: 'total-2' });
      const tx3 = await createTransaction({ amount: -5000, currency: 'USD', identifier: 'total-3' });

      await realEstateTransactionService.tagTransaction(inv._id, user._id, tx1._id);
      await realEstateTransactionService.tagTransaction(inv._id, user._id, tx2._id);
      await realEstateTransactionService.tagTransaction(inv._id, user._id, tx3._id);

      const totals = await realEstateTransactionService.getTransactionTotals(inv._id, user._id);
      expect(totals['ILS']).toBe(150000);
      expect(totals['USD']).toBe(5000);
    });

    it('should return empty object for investment without tag', async () => {
      const inv = await RealEstateInvestment.create({
        userId: user._id,
        name: 'No Tag Totals',
        type: 'rental',
        currency: 'ILS'
      });

      const totals = await realEstateTransactionService.getTransactionTotals(inv._id, user._id);
      expect(totals).toEqual({});
    });
  });

  describe('bulkTagTransactions', () => {
    it('should tag multiple transactions and count results', async () => {
      const inv = await createInvestmentWithTag();
      const tx1 = await createTransaction({ identifier: 'bulk-1' });
      const tx2 = await createTransaction({ identifier: 'bulk-2' });

      const result = await realEstateTransactionService.bulkTagTransactions(
        inv._id, user._id, [tx1._id, tx2._id]
      );

      expect(result.tagged).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for invalid transaction IDs', async () => {
      const inv = await createInvestmentWithTag();
      const fakeId = new mongoose.Types.ObjectId();

      const result = await realEstateTransactionService.bulkTagTransactions(
        inv._id, user._id, [fakeId]
      );

      expect(result.tagged).toBe(0);
      expect(result.errors).toHaveLength(1);
    });
  });
});
