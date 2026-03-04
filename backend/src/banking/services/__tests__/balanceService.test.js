const mongoose = require('mongoose');
const { BankAccount, BalanceSnapshot } = require('../../models');
const balanceService = require('../balanceService');

describe('BalanceService', () => {
  let testUser;
  let testAccount;

  beforeEach(async () => {
    await BalanceSnapshot.deleteMany({});
    await BankAccount.deleteMany({});

    testUser = await global.createTestUser();
    testAccount = await BankAccount.create({
      userId: testUser._id,
      bankId: 'hapoalim',
      name: 'Test Checking',
      credentials: { username: 'testuser', password: 'testpass' },
      defaultCurrency: 'ILS',
      status: 'active'
    });
  });

  describe('recordBalance', () => {
    test('should create a balance snapshot', async () => {
      const result = await balanceService.recordBalance(testAccount._id, {
        balance: 10000,
        currency: 'ILS',
        source: 'scraper'
      });

      expect(result).not.toBeNull();
      expect(result.balance).toBe(10000);
      expect(result.currency).toBe('ILS');
      expect(result.source).toBe('scraper');
      expect(result.bankAccountId.toString()).toBe(testAccount._id.toString());
    });

    test('should update BankAccount currentBalance', async () => {
      await balanceService.recordBalance(testAccount._id, {
        balance: 5000,
        currency: 'ILS',
        source: 'scraper'
      });

      const updated = await BankAccount.findById(testAccount._id);
      expect(updated.currentBalance).toBe(5000);
      expect(updated.lastBalanceUpdate).toBeTruthy();
    });

    test('should upsert on same day', async () => {
      await balanceService.recordBalance(testAccount._id, {
        balance: 1000,
        currency: 'ILS',
        source: 'scraper'
      });
      await balanceService.recordBalance(testAccount._id, {
        balance: 2000,
        currency: 'ILS',
        source: 'scraper'
      });

      const snapshots = await BalanceSnapshot.find({ bankAccountId: testAccount._id });
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].balance).toBe(2000);
    });

    test('should calculate day change from previous snapshot', async () => {
      // Insert a previous day's snapshot directly
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await BalanceSnapshot.create({
        userId: testUser._id,
        bankAccountId: testAccount._id,
        date: yesterday,
        balance: 8000,
        currency: 'ILS',
        source: 'scraper'
      });

      const result = await balanceService.recordBalance(testAccount._id, {
        balance: 10000,
        currency: 'ILS',
        source: 'scraper'
      });

      expect(result.dayChange).toBe(2000);
      expect(result.dayChangePercent).toBe(25);
    });

    test('should skip if balance is null', async () => {
      const result = await balanceService.recordBalance(testAccount._id, {
        balance: null,
        currency: 'ILS',
        source: 'scraper'
      });

      expect(result).toBeNull();
    });

    test('should store availableBalance for Mercury accounts', async () => {
      const mercuryAccount = await BankAccount.create({
        userId: testUser._id,
        bankId: 'mercury',
        name: 'Mercury Business',
        credentials: { apiToken: 'test-token-123' },
        defaultCurrency: 'USD',
        status: 'active'
      });

      const result = await balanceService.recordBalance(mercuryAccount._id, {
        balance: 50000,
        availableBalance: 48000,
        currency: 'USD',
        source: 'api'
      });

      expect(result.balance).toBe(50000);
      expect(result.availableBalance).toBe(48000);
      expect(result.source).toBe('api');
    });
  });

  describe('getBalanceHistory', () => {
    test('should return balance history sorted by date', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 5; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await BalanceSnapshot.create({
          userId: testUser._id,
          bankAccountId: testAccount._id,
          date,
          balance: 10000 + (5 - i) * 100,
          currency: 'ILS',
          source: 'scraper'
        });
      }

      const history = await balanceService.getBalanceHistory(testAccount._id, 30);
      expect(history).toHaveLength(6);
      expect(history[0].balance).toBeLessThan(history[5].balance);
    });

    test('should filter by days parameter', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create snapshots going back 60 days
      for (let i = 60; i >= 0; i -= 10) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await BalanceSnapshot.create({
          userId: testUser._id,
          bankAccountId: testAccount._id,
          date,
          balance: 10000,
          currency: 'ILS',
          source: 'scraper'
        });
      }

      const last30 = await balanceService.getBalanceHistory(testAccount._id, 30);
      const last7 = await balanceService.getBalanceHistory(testAccount._id, 7);

      expect(last30.length).toBeGreaterThan(last7.length);
    });
  });

  describe('getAccountSummary', () => {
    test('should return latest balance per account', async () => {
      const account2 = await BankAccount.create({
        userId: testUser._id,
        bankId: 'leumi',
        name: 'Leumi Checking',
        credentials: { username: 'user2', password: 'pass2' },
        defaultCurrency: 'ILS',
        status: 'active'
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await BalanceSnapshot.create({
        userId: testUser._id,
        bankAccountId: testAccount._id,
        date: today,
        balance: 15000,
        currency: 'ILS',
        source: 'scraper'
      });
      await BalanceSnapshot.create({
        userId: testUser._id,
        bankAccountId: account2._id,
        date: today,
        balance: 25000,
        currency: 'ILS',
        source: 'scraper'
      });

      const summary = await balanceService.getAccountSummary(testUser._id);
      expect(summary).toHaveLength(2);
      
      const balances = summary.map(s => s.balance).sort();
      expect(balances).toEqual([15000, 25000]);
    });

    test('should enrich with account name and bank ID', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await BalanceSnapshot.create({
        userId: testUser._id,
        bankAccountId: testAccount._id,
        date: today,
        balance: 10000,
        currency: 'ILS',
        source: 'scraper'
      });

      const summary = await balanceService.getAccountSummary(testUser._id);
      expect(summary[0].accountName).toBe('Test Checking');
      expect(summary[0].bankId).toBe('hapoalim');
    });
  });

  describe('getNetWorthHistory', () => {
    test('should aggregate balances across accounts by date', async () => {
      const account2 = await BankAccount.create({
        userId: testUser._id,
        bankId: 'leumi',
        name: 'Leumi Checking',
        credentials: { username: 'user2', password: 'pass2' },
        defaultCurrency: 'ILS',
        status: 'active'
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await BalanceSnapshot.create({
        userId: testUser._id,
        bankAccountId: testAccount._id,
        date: today,
        balance: 10000,
        currency: 'ILS',
        source: 'scraper'
      });
      await BalanceSnapshot.create({
        userId: testUser._id,
        bankAccountId: account2._id,
        date: today,
        balance: 20000,
        currency: 'ILS',
        source: 'scraper'
      });

      const history = await balanceService.getNetWorthHistory(testUser._id, 30);
      expect(history).toHaveLength(1);
      expect(history[0].totalBalance).toBe(30000);
      expect(history[0].accountCount).toBe(2);
    });
  });
});
