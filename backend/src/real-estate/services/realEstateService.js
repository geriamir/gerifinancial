const logger = require('../../shared/utils/logger');
const RealEstateInvestment = require('../models/RealEstateInvestment');
const { currencyExchangeService } = require('../../foreign-currency');
const realEstateTransactionService = require('./realEstateTransactionService');

class RealEstateService {
  async create(userId, data) {
    // Spread data first, then override userId to prevent privilege escalation
    const investment = await RealEstateInvestment.create({
      ...data,
      userId
    });

    // Auto-create tag for transaction linking
    await investment.createInvestmentTag();

    // Generate auto-installments from mortgage/value/tax settings
    investment.generateAutoInstallments();
    await investment.save();

    logger.info(`Created real estate investment: ${investment.name} (${investment.type})`);
    return investment;
  }

  async getAll(userId, filters = {}) {
    const investments = await RealEstateInvestment.findByUser(userId, filters);

    // Update overdue installments and compute transaction totals
    const results = [];
    for (const inv of investments) {
      if (inv.updateOverdueInstallments()) {
        await inv.save();
      }
      const invObj = inv.toJSON();
      const txnTotals = await realEstateTransactionService.getTransactionTotals(inv._id, userId);
      // Convert all currency totals to investment currency
      let actualInvested = 0;
      for (const [txnCur, amount] of Object.entries(txnTotals)) {
        actualInvested += await this._convertAmount(amount, txnCur, inv.currency || 'USD');
      }
      invObj.actualInvested = actualInvested;
      results.push(invObj);
    }

    return results;
  }

  async getById(investmentId, userId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId })
      .populate('investmentTag', 'name')
      .populate('linkedBankAccountId', 'name bankId')
      .populate('categoryBudgets.categoryId', 'name')
      .populate('categoryBudgets.subCategoryId', 'name');

    if (!investment) return null;

    if (investment.updateOverdueInstallments()) {
      await investment.save();
    }

    return investment;
  }

  async update(investmentId, userId, updates) {
    // Prevent changing userId
    delete updates.userId;

    const autoInstallmentFields = ['estimatedCurrentValue', 'mortgagePercentage', 'purchaseTaxRate', 'currency'];
    const shouldRegenerate = autoInstallmentFields.some(f => updates[f] !== undefined);

    const investment = await RealEstateInvestment.findOneAndUpdate(
      { _id: investmentId, userId },
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('investmentTag', 'name')
      .populate('linkedBankAccountId', 'name bankId');

    if (investment && shouldRegenerate) {
      investment.generateAutoInstallments();
      await investment.save();
    }

    return investment;
  }

  async delete(investmentId, userId) {
    const investment = await RealEstateInvestment.findOneAndDelete({ _id: investmentId, userId });
    if (investment) {
      logger.info(`Deleted real estate investment: ${investment.name}`);
    }
    return investment;
  }

  // Installment management
  async addInstallment(investmentId, userId, installmentData) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    investment.installments.push(installmentData);
    await investment.save();
    return investment;
  }

  async updateInstallment(investmentId, userId, installmentId, updates) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    const installment = investment.installments.id(installmentId);
    if (!installment) return null;

    Object.assign(installment, updates);
    if (updates.status === 'paid' && !installment.paidDate) {
      installment.paidDate = new Date();
    }
    await investment.save();
    return investment;
  }

  async deleteInstallment(investmentId, userId, installmentId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    investment.installments.pull(installmentId);
    await investment.save();
    return investment;
  }

  async linkTransactionToInstallment(investmentId, userId, installmentId, transactionId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    const installment = investment.installments.id(installmentId);
    if (!installment) return null;

    if (!installment.linkedTransactions.some(id => id.toString() === transactionId.toString())) {
      installment.linkedTransactions.push(transactionId);
      if (installment.status !== 'paid') {
        installment.status = 'paid';
        if (!installment.paidDate) {
          installment.paidDate = new Date();
        }
      }
      await investment.save();
    }
    return investment;
  }

  async unlinkTransactionFromInstallment(investmentId, userId, installmentId, transactionId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    const installment = investment.installments.id(installmentId);
    if (!installment) return null;

    installment.linkedTransactions = installment.linkedTransactions.filter(
      id => id.toString() !== transactionId.toString()
    );
    // Revert to pending/overdue if no transactions remain
    if (installment.linkedTransactions.length === 0 && installment.status === 'paid') {
      const now = new Date();
      installment.status = installment.dueDate < now ? 'overdue' : 'pending';
      installment.paidDate = null;
    }
    await investment.save();
    return investment;
  }

  // Rental income management
  async addRentalIncome(investmentId, userId, incomeData) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    investment.rentalIncome.push(incomeData);
    await investment.save();
    return investment;
  }

  async updateRentalIncome(investmentId, userId, incomeId, updates) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    const income = investment.rentalIncome.id(incomeId);
    if (!income) return null;

    Object.assign(income, updates);
    await investment.save();
    return investment;
  }

  // Mark as sold (flip)
  async markSold(investmentId, userId, saleData) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    await investment.markSold(saleData.salePrice, saleData.saleDate, saleData.saleExpenses);
    return investment;
  }

  // Link/unlink bank account
  async linkBankAccount(investmentId, userId, bankAccountId) {
    // Verify bank account belongs to this user
    const BankAccount = require('../../banking/models/BankAccount');
    const account = await BankAccount.findOne({ _id: bankAccountId, userId });
    if (!account) {
      throw new Error('Bank account not found or does not belong to user');
    }

    const investment = await RealEstateInvestment.findOneAndUpdate(
      { _id: investmentId, userId },
      { $set: { linkedBankAccountId: bankAccountId } },
      { new: true }
    );
    return investment;
  }

  async unlinkBankAccount(investmentId, userId) {
    const investment = await RealEstateInvestment.findOneAndUpdate(
      { _id: investmentId, userId },
      { $set: { linkedBankAccountId: null } },
      { new: true }
    );
    return investment;
  }

  // Convert amount to target currency, returns original if conversion fails
  async _convertAmount(amount, fromCurrency, toCurrency) {
    if (!amount || fromCurrency === toCurrency) return amount;
    try {
      const result = await currencyExchangeService.convertAmount(
        Math.abs(amount), fromCurrency, toCurrency, new Date(), true
      );
      return amount < 0 ? -result.convertedAmount : result.convertedAmount;
    } catch (err) {
      logger.warn(`Real estate: failed to convert ${fromCurrency} → ${toCurrency}: ${err.message}`);
      return amount;
    }
  }

  // Summary across all investments, converted to a common display currency
  async getSummary(userId, displayCurrency = 'USD') {
    const investments = await RealEstateInvestment.find({ userId, status: { $in: ['active', 'sold'] } });

    const summary = {
      totalInvestments: investments.length,
      activeFlips: 0,
      activeRentals: 0,
      totalInvested: 0,
      totalEstimatedValue: 0,
      totalInstallments: 0,
      totalPaidInstallments: 0,
      totalRentalIncome: 0,
      totalFlipGains: 0,
      currency: displayCurrency
    };

    for (const inv of investments) {
      const cur = inv.currency || 'USD';
      if (inv.status === 'active' && inv.type === 'flip') summary.activeFlips++;
      if (inv.status === 'active' && inv.type === 'rental') summary.activeRentals++;

      // Compute actual invested from transactions
      const txnTotals = await realEstateTransactionService.getTransactionTotals(inv._id, userId);
      let investedForThis = 0;
      for (const [txnCur, amount] of Object.entries(txnTotals)) {
        investedForThis += await this._convertAmount(amount, txnCur, displayCurrency);
      }
      summary.totalInvested += investedForThis;

      summary.totalEstimatedValue += await this._convertAmount(inv.estimatedCurrentValue || 0, cur, displayCurrency);
      summary.totalInstallments += await this._convertAmount(inv.totalPendingInstallments || 0, cur, displayCurrency);
      summary.totalPaidInstallments += await this._convertAmount(inv.totalPaidInstallments || 0, cur, displayCurrency);
      summary.totalRentalIncome += await this._convertAmount(inv.totalRentalIncome || 0, cur, displayCurrency);
      if (inv.type === 'flip' && inv.flipGain != null) {
        summary.totalFlipGains += await this._convertAmount(inv.flipGain, cur, displayCurrency);
      }
    }

    return summary;
  }
}

module.exports = new RealEstateService();
