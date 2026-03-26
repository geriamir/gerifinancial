const logger = require('../../shared/utils/logger');
const Transaction = require('../../banking/models/Transaction');
const Tag = require('../../banking/models/Tag');
const RealEstateInvestment = require('../models/RealEstateInvestment');

class RealEstateTransactionService {
  /**
   * Get all transactions tagged to an investment.
   */
  async getTransactions(investmentId, userId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment || !investment.investmentTag) return [];

    return Transaction.find({
      userId,
      tags: investment.investmentTag
    }).sort({ date: -1 });
  }

  /**
   * Tag a transaction to an investment.
   */
  async tagTransaction(investmentId, userId, transactionId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment || !investment.investmentTag) {
      throw new Error('Investment or tag not found');
    }

    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (!transaction.tags) transaction.tags = [];
    if (!transaction.tags.includes(investment.investmentTag)) {
      transaction.tags.push(investment.investmentTag);
      await transaction.save();
      logger.info(`Tagged transaction ${transactionId} to investment ${investment.name}`);
    }

    return transaction;
  }

  /**
   * Untag a transaction from an investment.
   */
  async untagTransaction(investmentId, userId, transactionId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment || !investment.investmentTag) {
      throw new Error('Investment or tag not found');
    }

    const transaction = await Transaction.findOne({ _id: transactionId, userId });
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.tags = (transaction.tags || []).filter(
      t => t.toString() !== investment.investmentTag.toString()
    );
    await transaction.save();

    // Also remove from any allocated category budgets
    for (const budget of investment.categoryBudgets) {
      budget.allocatedTransactions = budget.allocatedTransactions.filter(
        id => id.toString() !== transactionId
      );
    }
    await investment.save();

    return transaction;
  }

  /**
   * Bulk tag transactions to an investment.
   */
  async bulkTagTransactions(investmentId, userId, transactionIds) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment || !investment.investmentTag) {
      throw new Error('Investment or tag not found');
    }

    const result = { tagged: 0, errors: [] };

    for (const txId of transactionIds) {
      try {
        await this.tagTransaction(investmentId, userId, txId);
        result.tagged++;
      } catch (err) {
        result.errors.push({ transactionId: txId, error: err.message });
      }
    }

    return result;
  }

  /**
   * Auto-tag all transactions from a linked bank account.
   * Called when a bank account is linked to an investment.
   */
  async autoTagLinkedAccountTransactions(investmentId, userId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment || !investment.linkedBankAccountId || !investment.investmentTag) {
      return { tagged: 0 };
    }

    const untaggedTransactions = await Transaction.find({
      userId,
      accountId: investment.linkedBankAccountId,
      tags: { $nin: [investment.investmentTag] }
    });

    let tagged = 0;
    for (const tx of untaggedTransactions) {
      if (!tx.tags) tx.tags = [];
      tx.tags.push(investment.investmentTag);
      await tx.save();
      tagged++;
    }

    if (tagged > 0) {
      logger.info(`Auto-tagged ${tagged} transactions from linked account to investment ${investment.name}`);
    }

    return { tagged };
  }

  /**
   * Get the total invested amount from transactions for an investment,
   * grouped by currency. Transaction amounts are negative for expenses,
   * so we negate to get positive invested totals.
   */
  async getTransactionTotals(investmentId, userId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment || !investment.investmentTag) return {};

    const transactions = await Transaction.find({
      userId,
      tags: investment.investmentTag
    });

    const totalsByCurrency = {};
    for (const txn of transactions) {
      const cur = txn.currency || investment.currency || 'USD';
      totalsByCurrency[cur] = (totalsByCurrency[cur] || 0) + ((txn.amount || 0) * -1);
    }
    return totalsByCurrency;
  }
}

module.exports = new RealEstateTransactionService();
