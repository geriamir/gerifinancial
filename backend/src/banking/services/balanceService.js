const { BalanceSnapshot, BankAccount } = require('../models');
const logger = require('../../shared/utils/logger');

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
   * Get current balance summary for all of a user's bank accounts
   */
  async getAccountSummary(userId) {
    const latestSnapshots = await BalanceSnapshot.getLatestByUser(userId);

    // Enrich with account details
    const bankAccounts = await BankAccount.find({ userId })
      .select('name bankId defaultCurrency status currentBalance lastBalanceUpdate')
      .lean();

    const accountMap = {};
    for (const account of bankAccounts) {
      accountMap[account._id.toString()] = account;
    }

    return latestSnapshots.map(snapshot => {
      const account = accountMap[snapshot.bankAccountId.toString()];
      return {
        ...snapshot,
        accountName: account?.name,
        bankId: account?.bankId,
        accountStatus: account?.status
      };
    });
  }

  /**
   * Get aggregated net worth history across all user accounts
   */
  async getNetWorthHistory(userId, days = 30) {
    return BalanceSnapshot.getNetWorthHistory(userId, days);
  }
}

module.exports = new BalanceService();
