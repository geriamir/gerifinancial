const { BalanceSnapshot, BankAccount } = require('../models');
const logger = require('../../shared/utils/logger');
const currencyExchangeService = require('../../foreign-currency/services/currencyExchangeService');
const User = require('../../auth/models/User');

class BalanceService {
  /**
   * Record a balance snapshot for a bank account.
   * Upserts one snapshot per account per day, computing day-over-day change.
   */
  async recordBalance(bankAccountId, { balance, availableBalance, currency, source }) {
    if (balance == null) return null;

    const bankAccount = await BankAccount.findById(bankAccountId);
    if (!bankAccount) {
      logger.warn(`Cannot record balance: bank account ${bankAccountId} not found`);
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get yesterday's snapshot to calculate day change
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const previousSnapshot = await BalanceSnapshot.findOne({
      bankAccountId,
      date: { $lt: today }
    }).sort({ date: -1 }).lean();

    let dayChange = 0;
    let dayChangePercent = 0;
    if (previousSnapshot && previousSnapshot.balance !== 0) {
      dayChange = balance - previousSnapshot.balance;
      dayChangePercent = (dayChange / Math.abs(previousSnapshot.balance)) * 100;
    }

    // Upsert today's snapshot
    const snapshot = await BalanceSnapshot.findOneAndUpdate(
      { userId: bankAccount.userId, bankAccountId, date: today },
      {
        userId: bankAccount.userId,
        bankAccountId,
        date: today,
        balance,
        availableBalance: availableBalance ?? null,
        currency: currency || bankAccount.defaultCurrency || 'ILS',
        source,
        dayChange,
        dayChangePercent
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update BankAccount's quick-access balance fields
    await BankAccount.findByIdAndUpdate(bankAccountId, {
      currentBalance: balance,
      lastBalanceUpdate: new Date()
    });

    logger.info(`Recorded balance ${balance} ${currency || bankAccount.defaultCurrency} for account ${bankAccountId} (day change: ${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)})`);

    return snapshot;
  }

  /**
   * Get balance history for a specific bank account
   */
  async getBalanceHistory(bankAccountId, days = 30) {
    return BalanceSnapshot.getBalanceHistory(bankAccountId, days);
  }

  /**
   * Get the user's display currency, defaulting to 'ILS'.
   */
  async getUserDisplayCurrency(userId) {
    const user = await User.findById(userId).select('displayCurrency').lean();
    return user?.displayCurrency || 'ILS';
  }

  /**
   * Convert an amount to the target currency using the exchange service.
   * Returns the original amount if conversion fails or currency already matches.
   */
  async convertToTargetCurrency(amount, fromCurrency, targetCurrency) {
    if (!fromCurrency || fromCurrency === targetCurrency) return amount;
    try {
      const rate = await currencyExchangeService.getCurrentRate(fromCurrency, targetCurrency);
      return amount * rate;
    } catch (err) {
      logger.warn(`Currency conversion failed for ${fromCurrency} → ${targetCurrency}: ${err.message}`);
      return amount;
    }
  }

  /**
   * Get current balance summary for all of a user's bank accounts.
   * Balances are converted to the user's display currency.
   */
  async getAccountSummary(userId) {
    const [latestSnapshots, displayCurrency] = await Promise.all([
      BalanceSnapshot.getLatestByUser(userId),
      this.getUserDisplayCurrency(userId)
    ]);

    // Enrich with account details
    const bankAccounts = await BankAccount.find({ userId })
      .select('name bankId defaultCurrency status currentBalance lastBalanceUpdate')
      .lean();

    const accountMap = {};
    for (const account of bankAccounts) {
      accountMap[account._id.toString()] = account;
    }

    const items = [];
    for (const snapshot of latestSnapshots) {
      const account = accountMap[snapshot.bankAccountId.toString()];
      const currency = snapshot.currency || account?.defaultCurrency || displayCurrency;
      const convertedBalance = await this.convertToTargetCurrency(snapshot.balance, currency, displayCurrency);
      const convertedDayChange = await this.convertToTargetCurrency(snapshot.dayChange, currency, displayCurrency);

      items.push({
        ...snapshot,
        convertedBalance,
        convertedDayChange,
        displayCurrency,
        accountName: account?.name,
        bankId: account?.bankId,
        accountStatus: account?.status
      });
    }

    return items;
  }

  /**
   * Get aggregated net worth history across all user accounts
   */
  async getNetWorthHistory(userId, days = 30) {
    return BalanceSnapshot.getNetWorthHistory(userId, days);
  }
}

module.exports = new BalanceService();
