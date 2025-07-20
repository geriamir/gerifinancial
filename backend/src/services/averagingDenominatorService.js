const logger = require('../utils/logger');

/**
 * AveragingDenominatorService - Smart averaging logic for budget calculations
 * 
 * This service determines the appropriate denominator for calculating averages
 * when analyzing historical transaction data for budget creation. It handles
 * edge cases like limited scraping history vs genuine irregular expenses.
 */
class AveragingDenominatorService {
  
  /**
   * Determine the appropriate denominator for averaging based on category presence patterns
   * 
   * @param {Set} categoryMonths - Set of months where the category appeared
   * @param {number} allDataMonths - Total number of months with any transaction data
   * @param {number} requestedMonths - Number of months originally requested for analysis
   * @returns {number} The denominator to use for averaging
   */
  getAveragingDenominator(categoryMonths, allDataMonths, requestedMonths) {
    // Validate inputs first
    if (!categoryMonths || categoryMonths.size === 0) {
      logger.warn('No category months provided, returning 1 to avoid division by zero');
      return 1;
    }
    
    const categoryMonthsArray = Array.from(categoryMonths).sort((a, b) => a - b);
    
    if (allDataMonths <= 0 || requestedMonths <= 0) {
      logger.warn('Invalid data months or requested months, falling back to category months present');
      return categoryMonths.size;
    }
    
    // If category appears in ALL available data months, it's likely a regular expense
    // and missing months are due to limited scraping history
    if (categoryMonths.size === allDataMonths) {
      logger.info(`Category appears in ALL ${allDataMonths} available months - treating as regular expense, dividing by actual months present`);
      return categoryMonths.size; // Divide by actual months to get true average
    }
    
    // If category is missing from some months but present in most, check if missing months are at the beginning
    const highPresenceThreshold = Math.ceil(allDataMonths * 0.8);
    if (categoryMonths.size >= highPresenceThreshold) {
      return this._analyzeHighPresencePattern(categoryMonths, allDataMonths, requestedMonths);
    }
    
    // If category appears sporadically (less than 80% of available months), divide by actual presence
    logger.info(`Category appears sporadically (${categoryMonths.size}/${allDataMonths} months) - dividing by actual months present`);
    return categoryMonths.size;
  }

  /**
   * Analyze patterns for categories with high presence (>=80% of available months)
   * 
   * @param {Set} categoryMonths - Set of months where the category appeared
   * @param {number} allDataMonths - Total number of months with any transaction data
   * @param {number} requestedMonths - Number of months originally requested for analysis
   * @returns {number} The denominator to use for averaging
   * @private
   */
  _analyzeHighPresencePattern(categoryMonths, allDataMonths, requestedMonths) {
    // This method needs access to the overall month data to determine if missing months
    // are at the beginning (scraping limitation) or scattered (genuine gaps)
    
    // For now, we'll use a conservative approach:
    // If the category appears in most months, treat it as regular and divide by actual presence
    logger.info(`Category has high presence (${categoryMonths.size}/${allDataMonths} months) - treating as regular expense with some gaps, dividing by actual months present`);
    return categoryMonths.size;
  }

  /**
   * Enhanced version that takes into account the overall data pattern
   * 
   * @param {Set} categoryMonths - Set of months where the category appeared
   * @param {Set} allDataMonths - Set of all months with any transaction data
   * @param {number} requestedMonths - Number of months originally requested for analysis
   * @returns {number} The denominator to use for averaging
   */
  getAveragingDenominatorEnhanced(categoryMonths, allDataMonths, requestedMonths) {
    const categoryMonthsArray = Array.from(categoryMonths).sort((a, b) => a - b);
    const allDataMonthsArray = Array.from(allDataMonths).sort((a, b) => a - b);
    
    // Validate inputs
    if (!categoryMonths || categoryMonths.size === 0) {
      logger.warn('No category months provided, returning 1 to avoid division by zero');
      return 1;
    }
    
    if (!allDataMonths || allDataMonths.size === 0 || requestedMonths <= 0) {
      logger.warn('Invalid data months or requested months, falling back to category months present');
      return categoryMonths.size;
    }
    
    // If category appears in ALL available data months, check if it's a regular expense 
    // that should occur in the missing months too
    if (categoryMonths.size === allDataMonths.size) {
      // Check if this looks like a regular monthly expense that might extend beyond our data window
      if (this._isLikelyRegularMonthlyExpense(categoryMonths, allDataMonths, requestedMonths)) {
        logger.info(`Category appears to be regular monthly expense - using requested analysis period (${requestedMonths}) for proper averaging`);
        return requestedMonths;
      } else {
        logger.info(`Category appears in ALL ${allDataMonths.size} available months - treating as regular expense, dividing by actual months present`);
        return categoryMonths.size; // Divide by actual months to get true average
      }
    }
    
    // If category is missing from some months but present in most, check if missing months are at the beginning
    const highPresenceThreshold = Math.ceil(allDataMonths.size * 0.8);
    if (categoryMonths.size >= highPresenceThreshold) {
      // Check if the missing months are at the beginning (scraping limitation) or scattered (genuine gaps)
      const firstDataMonth = allDataMonthsArray[0];
      const firstCategoryMonth = categoryMonthsArray[0];
      
      if (firstCategoryMonth === firstDataMonth) {
        // Category starts from the first available month - missing months are likely at the beginning
        logger.info(`Category starts from first available month - treating as regular expense with limited history, dividing by actual months present`);
        return categoryMonths.size;
      } else {
        // Category has gaps from the beginning - could be regular expense starting mid-period
        if (this._isLikelyRegularExpenseStartingMidPeriod(categoryMonths, allDataMonths, requestedMonths)) {
          logger.info(`Category appears to be regular expense starting mid-analysis period - using requested period (${requestedMonths}) for proper averaging`);
          return requestedMonths;
        } else {
          logger.info(`Category has gaps from beginning of data period - treating as irregular, dividing by actual months present`);
          return categoryMonths.size;
        }
      }
    }
    
    // If category appears sporadically (less than 80% of available months), divide by actual presence
    logger.info(`Category appears sporadically (${categoryMonths.size}/${allDataMonths.size} months) - dividing by actual months present`);
    return categoryMonths.size;
  }

  /**
   * Check if this looks like a regular monthly expense based on patterns
   * @param {Set} categoryMonths - Months where category appeared
   * @param {Set} allDataMonths - All months with data
   * @param {number} requestedMonths - Requested analysis period
   * @returns {boolean} True if likely regular monthly expense
   * @private
   */
  _isLikelyRegularMonthlyExpense(categoryMonths, allDataMonths, requestedMonths) {
    const categoryArray = Array.from(categoryMonths).sort((a, b) => a - b);
    const dataArray = Array.from(allDataMonths).sort((a, b) => a - b);
    
    // Only apply this logic if:
    // 1. We have 4+ consecutive months AND
    // 2. Available data is less than requested AND  
    // 3. The pattern looks like it could continue beyond the data window
    if (categoryArray.length >= 4 && allDataMonths.size < requestedMonths) {
      
      // Check if months are consecutive
      for (let i = 1; i < categoryArray.length; i++) {
        if (categoryArray[i] !== categoryArray[i-1] + 1) {
          return false; // Not consecutive
        }
      }
      
      // Additional check: make sure this pattern could logically extend
      // (e.g., not a pattern that clearly ended)
      const lastCategoryMonth = categoryArray[categoryArray.length - 1];
      const lastDataMonth = Math.max(...dataArray);
      
      // If category continues to the end of available data, likely to continue beyond
      const continuesUntilEnd = lastCategoryMonth === lastDataMonth;
      
      // Also check if the missing months would be outside our data window
      const missingMonths = requestedMonths - allDataMonths.size;
      const significantGap = missingMonths >= 1; // At least 1 month missing
      
      return continuesUntilEnd && significantGap;
    }
    
    return false;
  }

  /**
   * Check if this looks like a regular expense that started mid-analysis period
   * @param {Set} categoryMonths - Months where category appeared  
   * @param {Set} allDataMonths - All months with data
   * @param {number} requestedMonths - Requested analysis period
   * @returns {boolean} True if likely regular expense starting mid-period
   * @private
   */
  _isLikelyRegularExpenseStartingMidPeriod(categoryMonths, allDataMonths, requestedMonths) {
    const categoryArray = Array.from(categoryMonths).sort((a, b) => a - b);
    
    // If we have 3+ consecutive months ending at or near the end of data period,
    // it might be a regular expense that started mid-analysis
    if (categoryArray.length >= 3) {
      // Check if months are consecutive from some point onward
      for (let i = 1; i < categoryArray.length; i++) {
        if (categoryArray[i] !== categoryArray[i-1] + 1) {
          return false; // Not consecutive
        }
      }
      
      // If consecutive and represents a significant portion, likely regular
      const coverageRatio = categoryArray.length / requestedMonths;
      return coverageRatio >= 0.5; // At least half the requested period
    }
    
    return false;
  }

  /**
   * Analyze spending pattern regularity
   * 
   * @param {Set} categoryMonths - Set of months where the category appeared
   * @param {Set} allDataMonths - Set of all months with any transaction data
   * @returns {object} Analysis results with pattern type and confidence
   */
  analyzeSpendingPattern(categoryMonths, allDataMonths) {
    const categoryMonthsArray = Array.from(categoryMonths).sort((a, b) => a - b);
    const allDataMonthsArray = Array.from(allDataMonths).sort((a, b) => a - b);
    
    const coveragePercentage = (categoryMonths.size / allDataMonths.size) * 100;
    
    let patternType;
    let confidence;
    let recommendedDenominator;
    
    if (categoryMonths.size === allDataMonths.size) {
      patternType = 'REGULAR';
      confidence = 95;
      recommendedDenominator = categoryMonths.size;
    } else if (coveragePercentage >= 80) {
      patternType = 'MOSTLY_REGULAR';
      confidence = 80;
      recommendedDenominator = categoryMonths.size;
    } else if (coveragePercentage >= 50) {
      patternType = 'SEMI_REGULAR';
      confidence = 60;
      recommendedDenominator = categoryMonths.size;
    } else {
      patternType = 'IRREGULAR';
      confidence = 40;
      recommendedDenominator = categoryMonths.size;
    }
    
    return {
      patternType,
      confidence,
      coveragePercentage: Math.round(coveragePercentage),
      monthsPresent: categoryMonths.size,
      totalMonthsAnalyzed: allDataMonths.size,
      recommendedDenominator,
      categoryMonths: categoryMonthsArray,
      allDataMonths: allDataMonthsArray
    };
  }

  /**
   * Get averaging strategy based on pattern analysis
   * 
   * @param {Set} categoryMonths - Set of months where the category appeared
   * @param {Set} allDataMonths - Set of all months with any transaction data
   * @param {number} requestedMonths - Number of months originally requested for analysis
   * @returns {object} Strategy with denominator and reasoning
   */
  getAveragingStrategy(categoryMonths, allDataMonths, requestedMonths) {
    const analysis = this.analyzeSpendingPattern(categoryMonths, allDataMonths);
    const denominator = this.getAveragingDenominatorEnhanced(categoryMonths, allDataMonths, requestedMonths);
    
    return {
      denominator,
      analysis,
      reasoning: this._generateReasoning(analysis, denominator, requestedMonths)
    };
  }

  /**
   * Generate human-readable reasoning for the averaging strategy
   * 
   * @param {object} analysis - Pattern analysis results
   * @param {number} denominator - Chosen denominator
   * @param {number} requestedMonths - Originally requested months
   * @returns {string} Human-readable reasoning
   * @private
   */
  _generateReasoning(analysis, denominator, requestedMonths) {
    const { patternType, coveragePercentage, monthsPresent } = analysis;
    
    switch (patternType) {
      case 'REGULAR':
        return `Regular expense appearing in all ${monthsPresent} available months. Using actual months (${denominator}) for true average.`;
      
      case 'MOSTLY_REGULAR':
        return `Mostly regular expense (${coveragePercentage}% coverage). Missing months likely due to limited data history. Using actual months present (${denominator}).`;
      
      case 'SEMI_REGULAR':
        return `Semi-regular expense (${coveragePercentage}% coverage). Using actual months present (${denominator}) to avoid over-averaging.`;
      
      case 'IRREGULAR':
        return `Irregular expense (${coveragePercentage}% coverage). Using actual months present (${denominator}) to reflect true spending pattern.`;
      
      default:
        return `Using ${denominator} months for averaging based on spending pattern analysis.`;
    }
  }
}

module.exports = new AveragingDenominatorService();
