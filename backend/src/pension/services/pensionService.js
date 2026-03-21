const logger = require('../../shared/utils/logger');
const { PensionAccount, PensionSnapshot } = require('../models');

/**
 * Maps Phoenix product category names to our productType enum.
 */
const PRODUCT_TYPE_MAP = {
  gemel: 'gemel',
  gemelInvestment: 'gemel',
  hishtalmut: 'hishtalmut',
  pension: 'pension',
  lifeSaving: 'lifeSaving',
  life: 'life',
  pizuim: 'pizuim',
  health: 'health',
  eachChildSavings: 'other',
  financial: 'other'
};

/**
 * Parse Israeli date strings like "17.03.2026" to Date objects.
 */
function parseHebrewDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return new Date(`${fullYear}-${month}-${day}`);
}

class PensionService {
  /**
   * Process all products from the Phoenix API response.
   * Upserts PensionAccount records and creates daily snapshots.
   *
   * @param {Object} allProducts - Response from getAllProducts()
   * @param {string} userId - MongoDB user ID
   * @param {string} bankAccountId - MongoDB bankAccount ID for Phoenix connection
   * @returns {Object} { synced: number, errors: string[] }
   */
  async processAllProducts(allProducts, userId, bankAccountId, ownerName = null) {
    const results = { synced: 0, errors: [] };

    for (const [category, products] of Object.entries(allProducts)) {
      const productType = PRODUCT_TYPE_MAP[category];
      if (!productType || !Array.isArray(products)) continue;

      for (const product of products) {
        try {
          await this.upsertAccount(product, productType, userId, bankAccountId, ownerName);
          results.synced++;
        } catch (err) {
          const msg = `Failed to sync ${category}/${product.policyNumber || 'unknown'}: ${err.message}`;
          logger.error(msg);
          results.errors.push(msg);
        }
      }
    }

    return results;
  }

  /**
   * Upsert a single pension account from an allUserProducts list item.
   * These items contain basic info: policyNumber, policyName, balance, status.
   */
  async upsertAccount(product, productType, userId, bankAccountId, ownerName = null) {
    const policyId = product.policyNumber || product.policyId;
    if (!policyId) throw new Error('Product has no policyNumber');

    const balance = product.totalSaving?.value ?? product.balance ?? 0;

    const data = {
      userId,
      bankAccountId,
      provider: 'phoenix',
      productType,
      policyName: product.policyName || product.name || 'Unknown',
      policyNickname: product.policyNickname || null,
      owner: ownerName,
      balance,
      currency: product.totalSaving?.currency === '₪' ? 'ILS' : (product.totalSaving?.currency || 'ILS'),
      status: 'active',
      lastSynced: new Date(),
      rawData: product
    };

    const account = await PensionAccount.findOneAndUpdate(
      { userId, policyId },
      { $set: data },
      { upsert: true, new: true }
    );

    // Record daily snapshot
    await PensionSnapshot.recordSnapshot({
      userId,
      pensionAccountId: account._id,
      totalBalance: balance,
      currency: data.currency
    });

    return account;
  }

  /**
   * Process detailed account data from findExcellenceSavingById.
   * Updates investment routes, management fees, yearly transactions, etc.
   *
   * @param {Object} detail - Response from getAccountDetail()
   * @param {string} policyId - The policy number
   */
  async processAccountDetail(detail, policyId, userId) {
    const account = await PensionAccount.findOne({ userId, policyId });
    if (!account) {
      throw new Error(`PensionAccount not found for policyId: ${policyId}`);
    }

    // Investment routes
    if (detail.investmentRoutesTransferConcentration?.investmentRoutes?.list) {
      account.investmentRoutes = detail.investmentRoutesTransferConcentration.investmentRoutes.list.map(route => ({
        name: route.investmentRouteTitle || 'Unknown',
        allocationPercent: route.investmentPercent?.value ?? 0,
        yieldPercent: route.yieldPercentage?.value ?? null,
        amount: route.investmentSum?.value ?? 0,
        currency: route.investmentSum?.currency === '₪' ? 'ILS' : (route.investmentSum?.currency || 'ILS'),
        updateDate: parseHebrewDate(route.updateDate),
        isActive: route.isExistRoute !== false
      }));
    }

    // Management fees
    if (detail.managementFee?.percentageMngFee) {
      const fees = detail.managementFee.percentageMngFee;
      account.managementFee = {
        fromDeposit: fees.fromDeposit?.percentageData?.value ?? null,
        fromSaving: fees.fromSaving?.percentageData?.value ?? null,
        validUntil: null
      };

      // Check for fee validity dates
      const updatedFee = detail.managementFee.updatedMngFee;
      if (updatedFee?.fromSaving?.popupData?.list) {
        const feeItem = updatedFee.fromSaving.popupData.list.find(f => f.fromSaving?.value != null);
        if (feeItem?.dateTo) {
          account.managementFee.validUntil = parseHebrewDate(feeItem.dateTo);
        }
      }
    }

    // Yearly transactions
    if (detail.accountTransactions?.list) {
      account.yearlyTransactions = detail.accountTransactions.list.map(yearData => ({
        year: parseInt(yearData.year),
        updateDate: parseHebrewDate(yearData.updateDate),
        items: (yearData.list || []).map(item => ({
          title: item.title,
          subTitle: item.subTitle || null,
          amount: item.sum?.value ?? null,
          currency: item.sum?.currency === '₪' ? 'ILS' : (item.sum?.currency || 'ILS')
        }))
      }));
    }

    // Expected payments
    if (detail.expectedPayments?.list) {
      account.expectedPayments = detail.expectedPayments.list.map(p => ({
        title: p.title,
        subTitle: p.subTitle || null,
        amount: p.sum?.value ?? null,
        currency: p.sum?.currency === '₪' ? 'ILS' : (p.sum?.currency || 'ILS')
      }));
    }

    // General details
    if (detail.noticeUpdate?.generalDetails) {
      const gen = detail.noticeUpdate.generalDetails;
      if (gen.startDate) account.startDate = parseHebrewDate(gen.startDate);
      if (gen.employerName) account.employerName = gen.employerName;
      if (gen.oldAccountNumber) account.accountNumber = gen.oldAccountNumber;
    }

    // Balance from accountTransactions (most recent total)
    if (detail.accountTransactions?.totalSum?.value != null) {
      account.balance = detail.accountTransactions.totalSum.value;
    }

    // Update snapshot with route breakdown
    const routeBreakdown = (account.investmentRoutes || [])
      .filter(r => r.isActive && r.amount > 0)
      .map(r => ({
        name: r.name,
        allocationPercent: r.allocationPercent,
        amount: r.amount,
        yieldPercent: r.yieldPercent
      }));

    await PensionSnapshot.recordSnapshot({
      userId: account.userId,
      pensionAccountId: account._id,
      totalBalance: account.balance,
      currency: account.currency,
      routeBreakdown
    });

    account.lastSynced = new Date();
    account.rawData = detail;
    await account.save();

    return account;
  }
}

module.exports = new PensionService();
