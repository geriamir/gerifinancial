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

/**
 * Parse a Clal formatted number string like "925,313.75" or "   1,696.00" to a number.
 */
function parseClalNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
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

  /**
   * Process detail data for a Clal account (from GetPensionPolicy or GetLifePolicy).
   * Enriches the existing PensionAccount with owner, employer, investment routes, fees, etc.
   */
  async processAccountDetail(detailData, category, policyId, userId) {
    const account = await PensionAccount.findOne({ userId, provider: 'clal', policyId });
    if (!account) {
      throw new Error(`PensionAccount not found for clal policyId: ${policyId}`);
    }

    const update = {};

    if (category === 'PortfolioDataPensionFundation') {
      this._extractPensionDetail(detailData, update);
    } else {
      this._extractLifeDetail(detailData, update);
    }

    // Owner name (available in both detail types)
    const fullName = detailData.PersonalDetails?.FullName
      || detailData.MainInsured?.PersonalDetails?.FullName;
    if (fullName) update.owner = fullName;

    // Store full detail as rawData
    update.rawData = detailData;

    await PensionAccount.updateOne(
      { _id: account._id },
      { $set: update }
    );

    logger.info(`Clal: enriched account ${policyId} with detail data`);
  }

  _extractPensionDetail(data, update) {
    const details = data.PolicyDetails || {};

    // Employer
    if (details.EmployerName) {
      update.employerName = details.EmployerName;
    }

    // Investment tracks
    if (data.InvestmentTracks?.InvestmentTracksRows?.length) {
      update.investmentRoutes = data.InvestmentTracks.InvestmentTracksRows.map(track => ({
        name: track.TrackName,
        allocationPercent: 100, // single-track pension defaults to 100%
        yieldPercent: null,
        amount: 0,
        currency: 'ILS',
        isActive: true
      }));
    }

    // Management fees
    if (data.ManagementFee?.ManagementFeeRows?.length) {
      const fees = data.ManagementFee.ManagementFeeRows;
      const depositFee = fees.find(f => f.Title?.includes('גמולים'));
      const savingFee = fees.find(f => f.Title?.includes('נכסים'));
      update.managementFee = {
        fromDeposit: depositFee ? parseFloat(depositFee.Percent) : null,
        fromSaving: savingFee ? parseFloat(savingFee.Percent) : null,
        validUntil: data.ManagementFee.Date ? parseClalDate(data.ManagementFee.Date) : null
      };
    }

    // Expected payments (insurance coverages → pension at retirement, disability, etc.)
    if (data.PolicyInsCoverages) {
      const cov = data.PolicyInsCoverages;
      update.expectedPayments = [
        { title: 'Estimated Monthly Pension', amount: parseClalNumber(cov.PensiaPrisha) },
        { title: 'Disability Pension', amount: parseClalNumber(cov.NehutPension) },
        { title: 'Survivor Pension', amount: parseClalNumber(cov.AlmanPension) },
        { title: 'Orphan Pension', amount: parseClalNumber(cov.YatomPension) },
        { title: 'Payment Release', amount: parseClalNumber(cov.PaymentReleaseTotal) }
      ].filter(p => p.amount != null && p.amount > 0);
    }

    // Proceeds breakdown as yearly transaction
    if (data.Proceeds) {
      const p = data.Proceeds;
      update.yearlyTransactions = [{
        year: new Date().getFullYear(),
        items: [
          { title: 'Employee Contributions', amount: parseClalNumber(p.Employe) },
          { title: 'Employer Contributions', amount: parseClalNumber(p.Employer) },
          { title: 'Compensation', amount: parseClalNumber(p.Compesation) },
          { title: 'Total', amount: parseClalNumber(p.Total) }
        ].filter(i => i.amount != null)
      }];
    }
  }

  _extractLifeDetail(data, update) {
    const insured = data.MainInsured || {};

    // Investment funds/tracks
    if (data.Funds?.length) {
      update.investmentRoutes = data.Funds.map(fund => ({
        name: fund.FundName,
        allocationPercent: null,
        yieldPercent: null,
        amount: parseClalNumber(fund.AmountValue),
        currency: 'ILS',
        isActive: true
      }));
    }

    // Yearly transactions from TransactionsReport
    if (data.TransactionsReport?.Transactions?.length) {
      const yearMatch = data.TransactionsReport.Title?.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
      update.yearlyTransactions = [{
        year,
        items: data.TransactionsReport.Transactions.map(t => ({
          title: t.SeifText,
          amount: parseClalNumber(t.Total)
        })).filter(i => i.amount != null)
      }];
    }

    // Expected payments from insurance summary
    if (insured.InsuranceSummary) {
      const s = insured.InsuranceSummary;
      update.expectedPayments = [
        { title: 'Death Insurance', amount: s.SumInsDeath },
        { title: 'Predicted Economy', amount: s.SumPredictedEconomy },
        { title: 'Monthly Pension', amount: s.SumMonthPension }
      ].filter(p => p.amount != null && p.amount > 0);
    }

    // Employer breakdown from AlicePidion
    if (data.AlicePidion?.length) {
      const employers = [...new Set(
        data.AlicePidion
          .map(a => a.OwnerName?.trim())
          .filter(n => n && n !== 'סה"כ' && !n.startsWith('יתרת'))
      )];
      if (employers.length) {
        update.employerName = employers.join(', ');
      }
    }

    // Investment paths yield
    if (data.InvestmentPaths?.length) {
      const paths = data.InvestmentPaths.filter(p => p.TsuaBruto !== '0');
      if (paths.length && update.investmentRoutes) {
        for (const path of paths) {
          const route = update.investmentRoutes.find(r => r.name === path.Maslul);
          if (route) route.yieldPercent = parseFloat(path.TsuaBruto) || null;
        }
      }
    }
  }
}

module.exports = new ClalDataMapper();
