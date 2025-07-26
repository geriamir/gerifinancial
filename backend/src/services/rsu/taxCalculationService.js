const { RSUGrant, RSUSale } = require('../../models');

class TaxCalculationService {
  constructor() {
    // Default Israeli tax rates
    this.defaultTaxRates = {
      wageIncome: 0.65,           // 65% on original grant value
      capitalGainsLongTerm: 0.25, // 25% on profit after 2 years
      capitalGainsShortTerm: 0.65, // 65% on profit before 2 years
      twoYearThresholdYears: 2    // 2 years threshold (calculated precisely with Date objects)
    };
  }

  /**
   * Calculate tax for an RSU sale
   * @param {Object} grant - RSU grant object
   * @param {Object} sale - RSU sale object
   * @param {Object} taxRates - Custom tax rates (optional)
   * @returns {Object} Tax calculation breakdown
   */
  async calculateSaleTax(grant, sale, taxRates = null) {
    const rates = taxRates || this.defaultTaxRates;
    
    // Calculate proportional grant value for the shares being sold
    const grantValuePerShare = grant.totalValue / grant.totalShares;
    const originalValue = sale.sharesAmount * grantValuePerShare;
    
    // Calculate profit (can be negative)
    const saleValue = sale.sharesAmount * sale.pricePerShare;
    const profit = saleValue - originalValue;
    
    // Determine if this is a long-term holding (> 2 years from grant date)
    // Use precise date calculation to account for leap years
    const isLongTerm = this.isLongTermHoldingPrecise(grant.grantDate, sale.saleDate, rates.twoYearThresholdYears);
    const holdingPeriodMs = sale.saleDate - grant.grantDate;
    
    // Calculate wage income tax (always applied to original value)
    const wageIncomeTax = originalValue * rates.wageIncome;
    
    // Calculate capital gains tax (only on positive profits)
    let capitalGainsTax = 0;
    if (profit > 0) {
      const capitalGainsRate = isLongTerm ? rates.capitalGainsLongTerm : rates.capitalGainsShortTerm;
      capitalGainsTax = profit * capitalGainsRate;
    }
    
    const totalTax = wageIncomeTax + capitalGainsTax;
    const netValue = saleValue - totalTax;
    const effectiveTaxRate = saleValue > 0 ? totalTax / saleValue : 0;
    
    return {
      originalValue: Math.round(originalValue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      isLongTerm,
      holdingPeriodDays: Math.floor(holdingPeriodMs / (24 * 60 * 60 * 1000)),
      wageIncomeTax: Math.round(wageIncomeTax * 100) / 100,
      capitalGainsTax: Math.round(capitalGainsTax * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      netValue: Math.round(netValue * 100) / 100,
      effectiveTaxRate: Math.round(effectiveTaxRate * 10000) / 100, // Percentage
      taxBasis: {
        grantValue: Math.round(originalValue * 100) / 100,
        saleValue: Math.round(saleValue * 100) / 100,
        profitAmount: Math.round(profit * 100) / 100,
        taxRateApplied: Math.round(effectiveTaxRate * 10000) / 10000
      },
      taxRatesUsed: {
        wageIncome: rates.wageIncome,
        capitalGains: isLongTerm ? rates.capitalGainsLongTerm : rates.capitalGainsShortTerm,
        isLongTermRate: isLongTerm
      }
    };
  }

  /**
   * Preview tax calculation for a potential sale
   * @param {string} grantId - Grant ID
   * @param {number} sharesAmount - Number of shares to sell
   * @param {number} salePrice - Price per share
   * @param {Date} saleDate - Sale date (default: today)
   * @param {Object} taxRates - Custom tax rates (optional)
   * @returns {Object} Tax calculation preview
   */
  async previewTaxCalculation(grantId, sharesAmount, salePrice, saleDate = new Date(), taxRates = null) {
    const grant = await RSUGrant.findById(grantId);
    if (!grant) {
      throw new Error('Grant not found');
    }
    
    // Validate share availability
    const availableShares = grant.getAvailableShares();
    if (sharesAmount > availableShares) {
      throw new Error(`Insufficient shares available. Available: ${availableShares}, Requested: ${sharesAmount}`);
    }
    
    // Create a temporary sale object for calculation
    const tempSale = {
      sharesAmount,
      pricePerShare: salePrice,
      saleDate: new Date(saleDate)
    };
    
    const taxCalculation = await this.calculateSaleTax(grant, tempSale, taxRates);
    
    return {
      ...taxCalculation,
      grantInfo: {
        stockSymbol: grant.stockSymbol,
        company: grant.company,
        grantDate: grant.grantDate,
        totalShares: grant.totalShares,
        availableShares
      },
      saleInfo: {
        sharesAmount,
        pricePerShare: salePrice,
        saleDate: tempSale.saleDate,
        totalSaleValue: sharesAmount * salePrice
      }
    };
  }

  /**
   * Get tax projections for a user for a specific year
   * @param {string} userId - User ID
   * @param {number} year - Year for projections
   * @returns {Object} Tax projections summary
   */
  async getTaxProjections(userId, year) {
    const [taxSummary, monthlyProjections] = await Promise.all([
      RSUSale.getAnnualTaxSummary(userId, year),
      RSUSale.getTaxProjections(userId, year)
    ]);
    
    const summary = taxSummary.length > 0 ? taxSummary[0] : null;
    
    return {
      year,
      summary,
      monthlyBreakdown: monthlyProjections,
      projectedQuarterlyPayments: this.calculateQuarterlyPayments(summary)
    };
  }

  /**
   * Calculate quarterly tax payment schedule
   * @param {Object} annualSummary - Annual tax summary
   * @returns {Array} Quarterly payment schedule
   */
  calculateQuarterlyPayments(annualSummary) {
    if (!annualSummary || !annualSummary.totalTax) {
      return [];
    }
    
    const totalTax = annualSummary.totalTax;
    const quarterlyAmount = totalTax / 4;
    
    const currentYear = annualSummary.year;
    const quarters = [
      { quarter: 'Q1', dueDate: new Date(currentYear + 1, 3, 30), amount: quarterlyAmount }, // April 30
      { quarter: 'Q2', dueDate: new Date(currentYear + 1, 6, 31), amount: quarterlyAmount }, // July 31
      { quarter: 'Q3', dueDate: new Date(currentYear + 1, 9, 31), amount: quarterlyAmount }, // October 31
      { quarter: 'Q4', dueDate: new Date(currentYear + 1, 0, 31), amount: quarterlyAmount }  // January 31 (next year)
    ];
    
    return quarters.map(q => ({
      ...q,
      amount: Math.round(q.amount * 100) / 100
    }));
  }

  /**
   * Calculate tax on wage income component
   * @param {number} originalValue - Original grant value
   * @param {number} taxRate - Wage income tax rate (default: 65%)
   * @returns {number} Wage income tax amount
   */
  calculateWageIncomeTax(originalValue, taxRate = 0.65) {
    return Math.round(originalValue * taxRate * 100) / 100;
  }

  /**
   * Calculate capital gains tax
   * @param {number} profit - Profit amount
   * @param {boolean} isLongTerm - Whether it's long-term holding
   * @param {number} shortTermRate - Short-term capital gains rate (default: 65%)
   * @param {number} longTermRate - Long-term capital gains rate (default: 25%)
   * @returns {number} Capital gains tax amount
   */
  calculateCapitalGainsTax(profit, isLongTerm, shortTermRate = 0.65, longTermRate = 0.25) {
    if (profit <= 0) return 0; // No tax on losses
    
    const rate = isLongTerm ? longTermRate : shortTermRate;
    return Math.round(profit * rate * 100) / 100;
  }

  /**
   * Determine if holding period qualifies for long-term capital gains (legacy method)
   * @param {Date} grantDate - Grant date
   * @param {Date} saleDate - Sale date
   * @param {number} threshold - Threshold in years (default: 2)
   * @returns {boolean} True if long-term holding
   * @deprecated Use isLongTermHoldingPrecise for accurate leap year handling
   */
  isLongTermHolding(grantDate, saleDate, threshold = 2) {
    const holdingPeriodMs = saleDate - grantDate;
    const thresholdMs = threshold * 365 * 24 * 60 * 60 * 1000;
    return holdingPeriodMs >= thresholdMs;
  }

  /**
   * Determine if holding period qualifies for long-term capital gains (precise calculation)
   * Accounts for leap years and uses exact date arithmetic
   * @param {Date} grantDate - Grant date
   * @param {Date} saleDate - Sale date
   * @param {number} thresholdYears - Threshold in years (default: 2)
   * @returns {boolean} True if long-term holding
   */
  isLongTermHoldingPrecise(grantDate, saleDate, thresholdYears = 2) {
    // Create a date that is exactly thresholdYears from the grant date
    const thresholdDate = new Date(grantDate);
    thresholdDate.setFullYear(thresholdDate.getFullYear() + thresholdYears);
    
    // Compare sale date with the precise threshold date
    return saleDate >= thresholdDate;
  }

  /**
   * Get annual tax summary for a user
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @returns {Object} Annual tax summary
   */
  async getAnnualTaxSummary(userId, year) {
    const summary = await RSUSale.getAnnualTaxSummary(userId, year);
    return summary.length > 0 ? summary[0] : null;
  }

  /**
   * Get tax liability breakdown by grant
   * @param {string} grantId - Grant ID
   * @returns {Object} Tax liability by grant
   */
  async getTaxLiabilityByGrant(grantId) {
    const [grant, sales] = await Promise.all([
      RSUGrant.findById(grantId),
      RSUSale.getSalesByGrant(grantId)
    ]);
    
    if (!grant) {
      throw new Error('Grant not found');
    }
    
    let totalSaleValue = 0;
    let totalOriginalValue = 0;
    let totalProfit = 0;
    let totalWageIncomeTax = 0;
    let totalCapitalGainsTax = 0;
    let totalTax = 0;
    let totalNetValue = 0;
    
    sales.forEach(sale => {
      totalSaleValue += sale.totalSaleValue;
      totalOriginalValue += sale.taxCalculation.originalValue;
      totalProfit += sale.taxCalculation.profit;
      totalWageIncomeTax += sale.taxCalculation.wageIncomeTax;
      totalCapitalGainsTax += sale.taxCalculation.capitalGainsTax;
      totalTax += sale.taxCalculation.totalTax;
      totalNetValue += sale.taxCalculation.netValue;
    });
    
    const remainingShares = grant.totalShares - sales.reduce((sum, sale) => sum + sale.sharesAmount, 0);
    const remainingValue = remainingShares * (grant.currentPrice || grant.pricePerShare);
    const potentialProfit = remainingValue - (remainingShares * (grant.totalValue / grant.totalShares));
    
    return {
      grantId,
      stockSymbol: grant.stockSymbol,
      company: grant.company,
      grantDate: grant.grantDate,
      totalShares: grant.totalShares,
      totalSales: sales.length,
      sharesSold: grant.totalShares - remainingShares,
      remainingShares,
      realized: {
        totalSaleValue: Math.round(totalSaleValue * 100) / 100,
        totalOriginalValue: Math.round(totalOriginalValue * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalWageIncomeTax: Math.round(totalWageIncomeTax * 100) / 100,
        totalCapitalGainsTax: Math.round(totalCapitalGainsTax * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalNetValue: Math.round(totalNetValue * 100) / 100,
        effectiveTaxRate: totalSaleValue > 0 ? Math.round((totalTax / totalSaleValue) * 10000) / 100 : 0
      },
      unrealized: {
        remainingShares,
        currentValue: Math.round(remainingValue * 100) / 100,
        potentialProfit: Math.round(potentialProfit * 100) / 100,
        estimatedTaxLiability: this.estimateUnrealizedTaxLiability(grant, remainingShares)
      }
    };
  }

  /**
   * Estimate tax liability for unrealized gains
   * @param {Object} grant - Grant object
   * @param {number} shares - Number of shares to estimate for
   * @returns {Object} Estimated tax liability
   */
  estimateUnrealizedTaxLiability(grant, shares) {
    const grantValuePerShare = grant.totalValue / grant.totalShares;
    const originalValue = shares * grantValuePerShare;
    const currentValue = shares * (grant.currentPrice || grant.pricePerShare);
    const profit = currentValue - originalValue;
    
    // Assume long-term holding for estimation
    const wageIncomeTax = this.calculateWageIncomeTax(originalValue);
    const capitalGainsTax = this.calculateCapitalGainsTax(profit, true); // Assume long-term
    const totalTax = wageIncomeTax + capitalGainsTax;
    const netValue = currentValue - totalTax;
    
    return {
      originalValue: Math.round(originalValue * 100) / 100,
      currentValue: Math.round(currentValue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      estimatedWageIncomeTax: wageIncomeTax,
      estimatedCapitalGainsTax: capitalGainsTax,
      estimatedTotalTax: totalTax,
      estimatedNetValue: Math.round(netValue * 100) / 100,
      assumptions: {
        longTermHolding: true,
        currentPrice: grant.currentPrice || grant.pricePerShare
      }
    };
  }

  /**
   * Estimate tax liability for unrealized gains with specific holding period
   * @param {Object} grant - Grant object
   * @param {number} shares - Number of shares to estimate for
   * @param {boolean} isLongTerm - Whether the holding period qualifies for long-term treatment
   * @returns {Object} Estimated tax liability
   */
  estimateUnrealizedTaxLiabilityWithPeriod(grant, shares, isLongTerm) {
    const grantValuePerShare = grant.totalValue / grant.totalShares;
    const originalValue = shares * grantValuePerShare;
    const currentValue = shares * (grant.currentPrice || grant.pricePerShare);
    const profit = currentValue - originalValue;
    
    // Use appropriate tax rates based on holding period
    const wageIncomeTax = this.calculateWageIncomeTax(originalValue);
    const capitalGainsTax = this.calculateCapitalGainsTax(profit, isLongTerm);
    const totalTax = wageIncomeTax + capitalGainsTax;
    const netValue = currentValue - totalTax;
    
    return {
      originalValue: Math.round(originalValue * 100) / 100,
      currentValue: Math.round(currentValue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      estimatedWageIncomeTax: wageIncomeTax,
      estimatedCapitalGainsTax: capitalGainsTax,
      estimatedTotalTax: totalTax,
      estimatedNetValue: Math.round(netValue * 100) / 100,
      assumptions: {
        longTermHolding: isLongTerm,
        currentPrice: grant.currentPrice || grant.pricePerShare,
        capitalGainsRate: isLongTerm ? 0.25 : 0.65
      }
    };
  }

  /**
   * Calculate optimal sale timing for tax efficiency
   * @param {string} grantId - Grant ID
   * @param {number} sharesAmount - Number of shares to sell
   * @param {number} targetPrice - Target sale price
   * @returns {Object} Optimal timing recommendation
   */
  async calculateOptimalTiming(grantId, sharesAmount, targetPrice) {
    const grant = await RSUGrant.findById(grantId);
    if (!grant) {
      throw new Error('Grant not found');
    }
    
    const today = new Date();
    const twoYearsFromGrant = new Date(grant.grantDate);
    twoYearsFromGrant.setFullYear(twoYearsFromGrant.getFullYear() + 2);
    
    const daysUntilLongTerm = Math.max(0, Math.ceil((twoYearsFromGrant - today) / (24 * 60 * 60 * 1000)));
    
    // Calculate tax if sold today (short-term)
    const shortTermTax = await this.previewTaxCalculation(grantId, sharesAmount, targetPrice, today);
    
    // Calculate tax if sold after 2 years (long-term)
    const longTermTax = await this.previewTaxCalculation(grantId, sharesAmount, targetPrice, twoYearsFromGrant);
    
    const taxSavings = shortTermTax.totalTax - longTermTax.totalTax;
    const netSavings = longTermTax.netValue - shortTermTax.netValue;
    
    return {
      grantId,
      currentDate: today,
      longTermQualificationDate: twoYearsFromGrant,
      daysUntilLongTerm,
      shortTermScenario: {
        saleDate: today,
        totalTax: shortTermTax.totalTax,
        netValue: shortTermTax.netValue,
        effectiveTaxRate: shortTermTax.effectiveTaxRate
      },
      longTermScenario: {
        saleDate: twoYearsFromGrant,
        totalTax: longTermTax.totalTax,
        netValue: longTermTax.netValue,
        effectiveTaxRate: longTermTax.effectiveTaxRate
      },
      taxSavings: Math.round(taxSavings * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      recommendation: daysUntilLongTerm > 0 ? 
        `Consider waiting ${daysUntilLongTerm} days to qualify for long-term capital gains and save $${Math.round(taxSavings * 100) / 100} in taxes.` :
        'This sale already qualifies for long-term capital gains treatment.'
    };
  }

  /**
   * Validate tax calculation parameters
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validateTaxCalculationParams(params) {
    const errors = [];
    
    if (!params.grantDate || !(params.grantDate instanceof Date)) {
      errors.push('Valid grant date is required');
    }
    
    if (!params.saleDate || !(params.saleDate instanceof Date)) {
      errors.push('Valid sale date is required');
    }
    
    if (params.grantDate && params.saleDate && params.saleDate < params.grantDate) {
      errors.push('Sale date cannot be before grant date');
    }
    
    if (!params.sharesAmount || params.sharesAmount <= 0) {
      errors.push('Shares amount must be greater than 0');
    }
    
    if (!Number.isInteger(params.sharesAmount)) {
      errors.push('Shares amount must be a whole number');
    }
    
    if (!params.salePrice || params.salePrice <= 0) {
      errors.push('Sale price must be greater than 0');
    }
    
    if (!params.grantValue || params.grantValue <= 0) {
      errors.push('Grant value must be greater than 0');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new TaxCalculationService();
