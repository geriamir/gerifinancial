const logger = require('../../shared/utils/logger');
const RealEstateInvestment = require('../models/RealEstateInvestment');
const { currencyExchangeService } = require('../../foreign-currency');

class RealEstateService {
  async create(userId, data) {
    const investment = await RealEstateInvestment.create({
      userId,
      ...data
    });

    // Auto-create tag for transaction linking
    await investment.createInvestmentTag();

    logger.info(`Created real estate investment: ${investment.name} (${investment.type})`);
    return investment;
  }

  async getAll(userId, filters = {}) {
    const investments = await RealEstateInvestment.findByUser(userId, filters);

    // Update overdue commitments on read
    for (const inv of investments) {
      if (inv.updateOverdueCommitments()) {
        await inv.save();
      }
    }

    return investments;
  }

  async getById(investmentId, userId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId })
      .populate('investmentTag', 'name')
      .populate('linkedBankAccountId', 'name bankId')
      .populate('categoryBudgets.categoryId', 'name')
      .populate('categoryBudgets.subCategoryId', 'name');

    if (!investment) return null;

    if (investment.updateOverdueCommitments()) {
      await investment.save();
    }

    return investment;
  }

  async update(investmentId, userId, updates) {
    // Prevent changing userId
    delete updates.userId;

    const investment = await RealEstateInvestment.findOneAndUpdate(
      { _id: investmentId, userId },
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('investmentTag', 'name')
      .populate('linkedBankAccountId', 'name bankId');

    return investment;
  }

  async delete(investmentId, userId) {
    const investment = await RealEstateInvestment.findOneAndDelete({ _id: investmentId, userId });
    if (investment) {
      logger.info(`Deleted real estate investment: ${investment.name}`);
    }
    return investment;
  }

  // Commitment management
  async addCommitment(investmentId, userId, commitmentData) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    investment.commitments.push(commitmentData);
    await investment.save();
    return investment;
  }

  async updateCommitment(investmentId, userId, commitmentId, updates) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    const commitment = investment.commitments.id(commitmentId);
    if (!commitment) return null;

    Object.assign(commitment, updates);
    if (updates.status === 'paid' && !commitment.paidDate) {
      commitment.paidDate = new Date();
    }
    await investment.save();
    return investment;
  }

  async deleteCommitment(investmentId, userId, commitmentId) {
    const investment = await RealEstateInvestment.findOne({ _id: investmentId, userId });
    if (!investment) return null;

    investment.commitments.pull(commitmentId);
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
      totalCommitments: 0,
      totalRentalIncome: 0,
      totalFlipGains: 0,
      currency: displayCurrency
    };

    for (const inv of investments) {
      const cur = inv.currency || 'USD';
      if (inv.status === 'active' && inv.type === 'flip') summary.activeFlips++;
      if (inv.status === 'active' && inv.type === 'rental') summary.activeRentals++;
      summary.totalInvested += await this._convertAmount(inv.totalInvestment || 0, cur, displayCurrency);
      summary.totalEstimatedValue += await this._convertAmount(inv.estimatedCurrentValue || 0, cur, displayCurrency);
      summary.totalCommitments += await this._convertAmount(inv.totalCommitted || 0, cur, displayCurrency);
      summary.totalRentalIncome += await this._convertAmount(inv.totalRentalIncome || 0, cur, displayCurrency);
      if (inv.type === 'flip' && inv.flipGain != null) {
        summary.totalFlipGains += await this._convertAmount(inv.flipGain, cur, displayCurrency);
      }
    }

    return summary;
  }
}

module.exports = new RealEstateService();
