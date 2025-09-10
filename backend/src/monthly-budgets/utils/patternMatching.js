const logger = require('../../shared/utils/logger');

/**
 * Pattern Matching Utilities for Budget Planning
 * 
 * This module provides robust utilities for calculating pattern occurrences
 * across different recurrence types with proper handling of edge cases
 * and year boundaries.
 */

class PatternMatchingUtils {
  /**
   * Calculate the normalized month difference between two months, handling year boundaries
   * 
   * @param {number} targetMonth - The target month (1-12)
   * @param {number} baseMonth - The base month to calculate from (1-12)
   * @returns {number} The normalized difference (0-11)
   * 
   * @example
   * // January to March = 2 months
   * calculateMonthDifference(3, 1) // returns 2
   * 
   * // December to February (next year) = 2 months
   * calculateMonthDifference(2, 12) // returns 2
   * 
   * // March to January (previous year) = 10 months
   * calculateMonthDifference(1, 3) // returns 10
   */
  static calculateMonthDifference(targetMonth, baseMonth) {
    // Validate input parameters
    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      throw new Error(`Invalid target month: ${targetMonth}. Must be integer between 1-12.`);
    }
    if (!Number.isInteger(baseMonth) || baseMonth < 1 || baseMonth > 12) {
      throw new Error(`Invalid base month: ${baseMonth}. Must be integer between 1-12.`);
    }

    // Calculate difference with year boundary handling
    // Adding 12 ensures we get a positive result, then modulo 12 normalizes to 0-11
    const difference = (targetMonth - baseMonth + 12) % 12;
    
    logger.debug(`Month difference calculation: target=${targetMonth}, base=${baseMonth}, difference=${difference}`);
    return difference;
  }

  /**
   * Check if a target month matches a bi-monthly pattern from any base month
   * 
   * Bi-monthly patterns occur every 2 months from the base occurrence.
   * This method handles multiple base months and year boundary crossings.
   * 
   * @param {number[]} scheduledMonths - Array of base months when pattern occurred (1-12)
   * @param {number} targetMonth - Month to check for pattern occurrence (1-12)
   * @returns {Object} Result object with match status and details
   * 
   * @example
   * // Pattern occurred in January and July
   * isBiMonthlyMatch([1, 7], 3) 
   * // Returns: { matches: true, baseMonth: 1, monthsFromBase: 2, reasoning: "..." }
   * 
   * // Pattern occurred in February, checking for December
   * isBiMonthlyMatch([2], 12) 
   * // Returns: { matches: true, baseMonth: 2, monthsFromBase: 10, reasoning: "..." }
   */
  static isBiMonthlyMatch(scheduledMonths, targetMonth) {
    // Validate inputs
    if (!Array.isArray(scheduledMonths) || scheduledMonths.length === 0) {
      return {
        matches: false,
        reasoning: 'No scheduled months provided for bi-monthly pattern matching'
      };
    }

    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return {
        matches: false,
        reasoning: `Invalid target month: ${targetMonth}. Must be integer between 1-12.`
      };
    }

    // Validate all scheduled months
    const invalidMonths = scheduledMonths.filter(month => 
      !Number.isInteger(month) || month < 1 || month > 12
    );
    if (invalidMonths.length > 0) {
      return {
        matches: false,
        reasoning: `Invalid scheduled months: [${invalidMonths.join(', ')}]. All must be integers between 1-12.`
      };
    }

    // Check each base month for bi-monthly pattern match
    for (const baseMonth of scheduledMonths) {
      try {
        const monthDifference = this.calculateMonthDifference(targetMonth, baseMonth);
        
        // Bi-monthly pattern: occurs every 2 months (0, 2, 4, 6, 8, 10)
        if (monthDifference % 2 === 0) {
          const result = {
            matches: true,
            baseMonth,
            monthsFromBase: monthDifference,
            reasoning: `Bi-monthly pattern match: month ${targetMonth} is ${monthDifference} months from base month ${baseMonth} (divisible by 2)`
          };
          
          logger.info(`Bi-monthly pattern match found: ${result.reasoning}`);
          return result;
        }
      } catch (error) {
        logger.error(`Error calculating bi-monthly match for base month ${baseMonth}:`, error);
        continue; // Try next base month
      }
    }

    // No match found
    const result = {
      matches: false,
      reasoning: `No bi-monthly pattern match for month ${targetMonth} from scheduled months [${scheduledMonths.join(', ')}]. Checked differences: ${scheduledMonths.map(base => this.calculateMonthDifference(targetMonth, base)).join(', ')}`
    };
    
    logger.debug(`Bi-monthly pattern check failed: ${result.reasoning}`);
    return result;
  }

  /**
   * Check if a target month matches a quarterly pattern from any base month
   * 
   * Quarterly patterns occur every 3 months from the base occurrence.
   * This method handles multiple base months and year boundary crossings.
   * 
   * @param {number[]} scheduledMonths - Array of base months when pattern occurred (1-12)
   * @param {number} targetMonth - Month to check for pattern occurrence (1-12)
   * @returns {Object} Result object with match status and details
   * 
   * @example
   * // Pattern occurred in January, checking for April (Q2)
   * isQuarterlyMatch([1], 4) 
   * // Returns: { matches: true, baseMonth: 1, monthsFromBase: 3, reasoning: "..." }
   * 
   * // Pattern occurred in November, checking for February (next year)
   * isQuarterlyMatch([11], 2) 
   * // Returns: { matches: true, baseMonth: 11, monthsFromBase: 3, reasoning: "..." }
   */
  static isQuarterlyMatch(scheduledMonths, targetMonth) {
    // Validate inputs (same validation as bi-monthly)
    if (!Array.isArray(scheduledMonths) || scheduledMonths.length === 0) {
      return {
        matches: false,
        reasoning: 'No scheduled months provided for quarterly pattern matching'
      };
    }

    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return {
        matches: false,
        reasoning: `Invalid target month: ${targetMonth}. Must be integer between 1-12.`
      };
    }

    const invalidMonths = scheduledMonths.filter(month => 
      !Number.isInteger(month) || month < 1 || month > 12
    );
    if (invalidMonths.length > 0) {
      return {
        matches: false,
        reasoning: `Invalid scheduled months: [${invalidMonths.join(', ')}]. All must be integers between 1-12.`
      };
    }

    // Check each base month for quarterly pattern match
    for (const baseMonth of scheduledMonths) {
      try {
        const monthDifference = this.calculateMonthDifference(targetMonth, baseMonth);
        
        // Quarterly pattern: occurs every 3 months (0, 3, 6, 9)
        if (monthDifference % 3 === 0) {
          const result = {
            matches: true,
            baseMonth,
            monthsFromBase: monthDifference,
            reasoning: `Quarterly pattern match: month ${targetMonth} is ${monthDifference} months from base month ${baseMonth} (divisible by 3)`
          };
          
          logger.info(`Quarterly pattern match found: ${result.reasoning}`);
          return result;
        }
      } catch (error) {
        logger.error(`Error calculating quarterly match for base month ${baseMonth}:`, error);
        continue; // Try next base month
      }
    }

    // No match found
    const result = {
      matches: false,
      reasoning: `No quarterly pattern match for month ${targetMonth} from scheduled months [${scheduledMonths.join(', ')}]. Checked differences: ${scheduledMonths.map(base => this.calculateMonthDifference(targetMonth, base)).join(', ')}`
    };
    
    logger.debug(`Quarterly pattern check failed: ${result.reasoning}`);
    return result;
  }

  /**
   * Check if a target month matches a yearly pattern
   * 
   * Yearly patterns occur on specific months each year.
   * This is a direct match - no complex calculations needed.
   * 
   * @param {number[]} scheduledMonths - Array of months when pattern occurs yearly (1-12)
   * @param {number} targetMonth - Month to check for pattern occurrence (1-12)
   * @returns {Object} Result object with match status and details
   */
  static isYearlyMatch(scheduledMonths, targetMonth) {
    // Validate inputs
    if (!Array.isArray(scheduledMonths) || scheduledMonths.length === 0) {
      return {
        matches: false,
        reasoning: 'No scheduled months provided for yearly pattern matching'
      };
    }

    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return {
        matches: false,
        reasoning: `Invalid target month: ${targetMonth}. Must be integer between 1-12.`
      };
    }

    const invalidMonths = scheduledMonths.filter(month => 
      !Number.isInteger(month) || month < 1 || month > 12
    );
    if (invalidMonths.length > 0) {
      return {
        matches: false,
        reasoning: `Invalid scheduled months: [${invalidMonths.join(', ')}]. All must be integers between 1-12.`
      };
    }

    // Direct match check
    const matches = scheduledMonths.includes(targetMonth);
    const result = {
      matches,
      reasoning: matches 
        ? `Yearly pattern match: month ${targetMonth} is explicitly scheduled in [${scheduledMonths.join(', ')}]`
        : `Yearly pattern mismatch: month ${targetMonth} not found in scheduled months [${scheduledMonths.join(', ')}]`
    };

    logger.debug(`Yearly pattern check: ${result.reasoning}`);
    return result;
  }

  /**
   * Check if a target month matches a monthly pattern
   * 
   * Monthly patterns occur every month - always true.
   * 
   * @param {number[]} scheduledMonths - Array of months (for consistency, not used)
   * @param {number} targetMonth - Month to check (always matches)
   * @returns {Object} Result object with match status (always true)
   */
  static isMonthlyMatch(scheduledMonths, targetMonth) {
    // Validate target month for consistency
    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      return {
        matches: false,
        reasoning: `Invalid target month: ${targetMonth}. Must be integer between 1-12.`
      };
    }

    const result = {
      matches: true,
      reasoning: `Monthly pattern: occurs every month, including month ${targetMonth}`
    };

    logger.debug(`Monthly pattern check: ${result.reasoning}`);
    return result;
  }

  /**
   * Generic pattern matching method that routes to specific pattern type handlers
   * 
   * @param {string} patternType - Type of pattern (MONTHLY, BI_MONTHLY, QUARTERLY, YEARLY)
   * @param {number[]} scheduledMonths - Array of base months when pattern occurred
   * @param {number} targetMonth - Month to check for pattern occurrence
   * @returns {Object} Result object with match status and details
   */
  static checkPatternMatch(patternType, scheduledMonths, targetMonth) {
    const PATTERN_TYPES = {
      MONTHLY: 'monthly',
      BI_MONTHLY: 'bi-monthly', 
      QUARTERLY: 'quarterly',
      YEARLY: 'yearly'
    };

    switch (patternType) {
      case PATTERN_TYPES.MONTHLY:
        return this.isMonthlyMatch(scheduledMonths, targetMonth);
      
      case PATTERN_TYPES.BI_MONTHLY:
        return this.isBiMonthlyMatch(scheduledMonths, targetMonth);
      
      case PATTERN_TYPES.QUARTERLY:
        return this.isQuarterlyMatch(scheduledMonths, targetMonth);
      
      case PATTERN_TYPES.YEARLY:
        return this.isYearlyMatch(scheduledMonths, targetMonth);
      
      default:
        return {
          matches: false,
          reasoning: `Unknown pattern type: ${patternType}. Supported types: ${Object.values(PATTERN_TYPES).join(', ')}`
        };
    }
  }
}

module.exports = PatternMatchingUtils;
