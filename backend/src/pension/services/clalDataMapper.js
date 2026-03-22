const logger = require('../../shared/utils/logger');
const { PensionAccount, PensionSnapshot } = require('../models');

/**
 * Maps Clal portfolio categories to our productType enum.
 */
const CLAL_CATEGORY_MAP = {
  PortfolioDataLifeInsList: 'lifeSaving',
  PortfolioDataPensionFundation: 'pension',
  PortfolioDataGemelList: 'gemel',
  PortfolioDataGemelHichudList: 'gemel',
  PortfolioDataHealthList: 'health'
};

/**
 * Parse Clal date strings like "01.07.2010" or "30/06/2026" to Date objects.
 */
function parseClalDate(dateStr) {
  if (!dateStr) return null;
  const normalized = dateStr.replace(/\//g, '.');
  const parts = normalized.split('.');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return new Date(`${year}-${month}-${day}`);
}

/**
 * Extract balance from a Clal account object.
 * Different categories use different field names.
 */
function extractBalance(item) {
  return item.BalanceTotalSum ?? item.RevenueSum ?? item.DisposalValue_Num ?? 0;
}

/**
 * Extract policy name from a Clal account object.
 */
function extractPolicyName(item, category) {
  if (category === 'PortfolioDataPensionFundation') {
    return item.PensionPlanName || item.FoundationName || 'Clal Pension';
  }
  return item.InsuranceTypeName || item.PolicyTypeName || 'Clal Policy';
}

class ClalDataMapper {
  /**
   * Process Clal's GetPortfolioHomeData response into PensionAccount records.
   */
  async processPortfolioData(portfolioData, userId, bankAccountId, ownerName = null) {
    const results = { synced: 0, errors: [] };

    for (const [category, productType] of Object.entries(CLAL_CATEGORY_MAP)) {
      const items = portfolioData[category];
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        try {
          await this.upsertAccount(item, productType, category, userId, bankAccountId, ownerName);
          results.synced++;
        } catch (err) {
          const policyId = item.PolicyId || 'unknown';
          const msg = `Failed to sync Clal ${category}/${policyId}: ${err.message}`;
          logger.error(msg);
          results.errors.push(msg);
        }
      }
    }

    return results;
  }

  async upsertAccount(item, productType, category, userId, bankAccountId, ownerName) {
    const rawPolicyId = item.PolicyId;
    if (rawPolicyId == null || rawPolicyId === '') {
      throw new Error('Clal item has no PolicyId');
    }
    const policyId = String(rawPolicyId);

    const balance = extractBalance(item);
    const policyName = extractPolicyName(item, category);

    const data = {
      userId,
      bankAccountId,
      provider: 'clal',
      productType,
      policyName,
      policyNickname: null,
      owner: ownerName,
      balance,
      currency: 'ILS',
      status: item.Status === 'פעילה' || !item.Status ? 'active' : 'inactive',
      startDate: parseClalDate(item.StartDate || item.LastJoinDate || item.PolicyStartDate),
      employerName: null,
      accountNumber: item.ProductNumber || item.FundCode || null,
      lastSynced: new Date(),
      rawData: item
    };

    const account = await PensionAccount.findOneAndUpdate(
      { userId, provider: 'clal', policyId },
      { $set: data },
      { upsert: true, new: true }
    );

    // Record daily snapshot
    await PensionSnapshot.recordSnapshot({
      userId,
      pensionAccountId: account._id,
      totalBalance: balance,
      currency: 'ILS'
    });

    logger.info(`Clal: upserted ${productType} account ${policyId} (balance: ${balance})`);
    return account;
  }
}

module.exports = new ClalDataMapper();
