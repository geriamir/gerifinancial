const { CategoryBudget, TransactionPattern } = require('../models');
const { Transaction } = require('../../banking');
const logger = require('../../shared/utils/logger');
const averagingDenominatorService = require('./averagingDenominatorService');
const PatternMatchingUtils = require('../utils/patternMatching');
const { PATTERN_TYPES } = require('../constants/patternTypes');

class BudgetCalculationService {
  /**
   * Calculate monthly budget from historical transaction data using CategoryBudget system with pattern detection
   * Simplified approach: base amounts + patterns per category per month
   */
  async calculateMonthlyBudgetFromHistory(userId, year, month, monthsToAnalyze = 6) {
    try {
      logger.info(`Calculating pattern-aware budgets for all months of ${year} using ${monthsToAnalyze} months of history`);

      // STEP 1: GET APPROVED PATTERNS
      logger.info('Step 1: Getting approved patterns...');
      const allApprovedPatterns = await TransactionPattern.getActivePatterns(userId);
      logger.info(`Found ${allApprovedPatterns.length} active patterns`);

      // STEP 2: ANALYZE TRANSACTIONS
      const { nonPatternedTransactions, patternedTransactionIds } = await this._analyzeTransactionsForBudget(
        userId, year, month, monthsToAnalyze, allApprovedPatterns
      );

      // STEP 3: CALCULATE CATEGORY AVERAGES
      const categoryAverages = await this._calculateCategoryAverages(
        nonPatternedTransactions, monthsToAnalyze
      );

      // STEP 4: CREATE BUDGETS
      const { updatedBudgets, monthlyBudgetBreakdown } = await this._createBudgetsForCategories(
        userId, categoryAverages, allApprovedPatterns
      );

      logger.info(`\nCompleted budget calculation: Updated ${updatedBudgets} category budgets`);
      logger.info(`Using ${allApprovedPatterns.length} existing approved patterns`);
      
      return {
        success: true,
        updatedBudgets,
        monthlyBudgetBreakdown,
        patternDetection: {
          totalPatternsUsed: allApprovedPatterns.length,
          patternsForRequestedMonth: monthlyBudgetBreakdown[month]?.patterns?.length || 0
        }
      };
    } catch (error) {
      logger.error('Error calculating monthly budget from history:', error);
      throw error;
    }
  }

  /**
   * STEP 2: Analyze transactions and separate patterned vs non-patterned
   */
  async _analyzeTransactionsForBudget(userId, year, month, monthsToAnalyze, allApprovedPatterns) {
    logger.info('Step 2: Analyzing transactions...');
    
    const endDate = new Date(year, month - 1, 0); // Last day of previous month
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - monthsToAnalyze);

    const transactions = await Transaction.find({
      userId,
      processedDate: { $gte: startDate, $lte: endDate },
      category: { $ne: null },
      excludeFromBudgetCalculation: { $ne: true }
    })
    .populate('category', 'name type')
    .populate('subCategory', 'name');

    logger.info(`Found ${transactions.length} transactions for analysis`);

    // Separate patterned vs non-patterned transactions
    const nonPatternedTransactions = [];
    const patternedTransactionIds = new Set();

    for (const transaction of transactions) {
      let isPatternedTransaction = false;
      
      // Check against all approved patterns
      for (const pattern of allApprovedPatterns) {
        if (pattern.matchesTransaction && pattern.matchesTransaction(transaction)) {
          patternedTransactionIds.add(transaction._id.toString());
          isPatternedTransaction = true;
          break;
        }
      }
      
      if (!isPatternedTransaction) {
        nonPatternedTransactions.push(transaction);
      }
    }

    logger.info(`Found ${patternedTransactionIds.size} patterned transactions, ${nonPatternedTransactions.length} non-patterned transactions`);

    return { nonPatternedTransactions, patternedTransactionIds };
  }

  /**
   * STEP 3: Calculate non-patterned averages per category
   */
  async _calculateCategoryAverages(nonPatternedTransactions, monthsToAnalyze) {
    logger.info('Step 3: Calculating non-patterned averages per category...');
    
    const categoryAverages = {}; // Format: "categoryId_subCategoryId" -> average amount

    // Track months with data for averaging strategy
    const monthsWithData = new Set();
    for (const transaction of nonPatternedTransactions) {
      monthsWithData.add(transaction.processedDate.getMonth() + 1);
    }

    // Group non-patterned transactions by category/subcategory
    const categoryTransactions = {};
    for (const transaction of nonPatternedTransactions) {
      const amount = Math.abs(transaction.amount);
      
      // Extract proper ObjectIds from populated fields
      const categoryId = transaction.category?._id?.toString() || transaction.category?.toString();
      const subCategoryId = transaction.subCategory?._id?.toString() || transaction.subCategory?.toString() || null;
      
      let categoryKey;
      if (transaction.category?.type === 'Expense' && transaction.subCategory) {
        categoryKey = `${categoryId}_${subCategoryId}`;
      } else if (transaction.category?.type === 'Income') {
        categoryKey = `${categoryId}_null`;
      } else {
        continue; // Skip transactions without proper categorization
      }

      if (!categoryTransactions[categoryKey]) {
        categoryTransactions[categoryKey] = {
          amounts: [],
          monthsPresent: new Set(),
          categoryId: categoryId,
          subCategoryId: subCategoryId,
          categoryName: transaction.category.name,
          subCategoryName: transaction.subCategory?.name || null
        };
      }
      
      categoryTransactions[categoryKey].amounts.push(amount);
      categoryTransactions[categoryKey].monthsPresent.add(transaction.processedDate.getMonth() + 1);
    }

    // Calculate averages using averaging strategy
    for (const [categoryKey, data] of Object.entries(categoryTransactions)) {
      const strategy = averagingDenominatorService.getAveragingStrategy(
        data.monthsPresent, 
        monthsWithData, 
        monthsToAnalyze
      );
      const totalAmount = data.amounts.reduce((sum, amt) => sum + amt, 0);
      const average = Math.round(totalAmount / strategy.denominator);
      
      categoryAverages[categoryKey] = {
        average,
        categoryId: data.categoryId.toString(),
        subCategoryId: data.subCategoryId ? data.subCategoryId.toString() : null,
        categoryName: data.categoryName,
        subCategoryName: data.subCategoryName
      };
      
      logger.info(`📊 ${data.categoryName}${data.subCategoryName ? '→' + data.subCategoryName : ''}: ₪${average}/month average`);
    }

    return categoryAverages;
  }

  /**
   * STEP 4: Create budgets for each category for each month
   */
  async _createBudgetsForCategories(userId, categoryAverages, allApprovedPatterns) {
    logger.info('Step 4: Creating budgets for each category for each month...');
    
    let updatedBudgets = 0;
    const monthlyBudgetBreakdown = {};

    // Initialize breakdown
    for (let targetMonth = 1; targetMonth <= 12; targetMonth++) {
      monthlyBudgetBreakdown[targetMonth] = { income: [], expenses: [], patterns: [] };
    }

    // Get all unique categories (from averages + patterns)
    const allCategories = new Set();
    
    // Add categories from averages
    for (const categoryKey of Object.keys(categoryAverages)) {
      allCategories.add(categoryKey);
    }
    
    // Add categories from patterns
    for (const pattern of allApprovedPatterns) {
      // Handle populated categoryId (could be ObjectId or populated object with {_id, name, type})
      const categoryId = pattern.transactionIdentifier.categoryId?._id?.toString() || 
                         pattern.transactionIdentifier.categoryId?.toString() || 
                         pattern.transactionIdentifier.categoryId;
      
      // Handle populated subCategoryId (could be ObjectId or populated object with {_id, name})
      const subCategoryId = pattern.transactionIdentifier.subCategoryId?._id?.toString() || 
                            pattern.transactionIdentifier.subCategoryId?.toString() || 
                            'null';
      
      const categoryKey = `${categoryId}_${subCategoryId}`;
      logger.info(`Adding category from pattern: ${categoryKey} (categoryId type: ${typeof pattern.transactionIdentifier.categoryId}, subCategoryId type: ${typeof pattern.transactionIdentifier.subCategoryId})`);
      allCategories.add(categoryKey);
    }

    logger.info(`Found ${allCategories.size} unique categories to process`);

    // Process each category
    for (const categoryKey of allCategories) {
      const categoryBudgetResult = await this._processCategoryBudget(
        userId, categoryKey, categoryAverages, allApprovedPatterns, monthlyBudgetBreakdown
      );
      
      if (categoryBudgetResult.updated) {
        updatedBudgets++;
      }
    }

    return { updatedBudgets, monthlyBudgetBreakdown };
  }

  /**
   * Process individual category budget creation
   */
  async _processCategoryBudget(userId, categoryKey, categoryAverages, allApprovedPatterns, monthlyBudgetBreakdown) {
    const [categoryIdStr, subCategoryIdStr] = categoryKey.split('_');
    const categoryId = categoryIdStr;
    const subCategoryId = subCategoryIdStr === 'null' ? null : subCategoryIdStr;
    
    // Get base average for this category
    const categoryAverage = categoryAverages[categoryKey]?.average || 0;
    
    // Get patterns for this category
    const categoryPatterns = allApprovedPatterns.filter(pattern => {
      // Handle populated categoryId (could be ObjectId or populated object)
      const patternCategoryId = pattern.transactionIdentifier.categoryId?._id?.toString() || 
                               pattern.transactionIdentifier.categoryId?.toString() || 
                               pattern.transactionIdentifier.categoryId;
      
      // Handle populated subCategoryId (could be ObjectId or populated object)  
      const patternSubCategoryId = pattern.transactionIdentifier.subCategoryId?._id?.toString() || 
                                   pattern.transactionIdentifier.subCategoryId?.toString() || 
                                   'null';
      
      return patternCategoryId === categoryId &&
             patternSubCategoryId === (subCategoryId || 'null');
    });

    // logger.info(`Processing category ${categoryKey}: base=₪${categoryAverage}, patterns=${categoryPatterns.length}`);

    // Ensure we have valid ObjectIds before querying
    let querySubCategoryId = subCategoryId;
    let createSubCategoryId = subCategoryId;
    
    if (subCategoryId && typeof subCategoryId === 'string' && subCategoryId.includes('{')) {
      // Handle case where subCategoryId is a stringified object representation
      logger.warn(`Found stringified object in subCategoryId: ${subCategoryId}`);
      // Extract ObjectId from the string if possible
      const objectIdMatch = subCategoryId.match(/ObjectId\('([^']+)'\)/);
      if (objectIdMatch) {
        querySubCategoryId = objectIdMatch[1];
        createSubCategoryId = objectIdMatch[1];
        logger.info(`Extracted ObjectId: ${querySubCategoryId}`);
      } else {
        logger.error(`Could not extract valid ObjectId from: ${subCategoryId}`);
        // Skip this category to prevent database errors
        return { updated: false };
      }
    } else if (subCategoryId && typeof subCategoryId === 'object') {
      // If subCategoryId is an object, extract the actual ID
      querySubCategoryId = subCategoryId._id?.toString() || subCategoryId.toString();
      createSubCategoryId = querySubCategoryId;
    }
    
    // Find or create budget
    let budget = await CategoryBudget.findOne({ 
      userId, 
      categoryId, 
      subCategoryId: querySubCategoryId || null 
    });
    
    if (!budget) {
      budget = await CategoryBudget.findOrCreate(userId, categoryId, createSubCategoryId);
    }

    // Determine if this category needs variable budgets (has non-monthly patterns)
    const hasVariablePatterns = categoryPatterns.some(pattern => 
      pattern.recurrencePattern !== PATTERN_TYPES.MONTHLY
    );

    if (hasVariablePatterns) {
      // Convert to variable budget and set amounts for each month
      budget.convertToVariable();
      
      for (let targetMonth = 1; targetMonth <= 12; targetMonth++) {
        // Start with base average
        let monthlyAmount = categoryAverage;
        
        // Add patterns that apply to this month
        const patternsForMonth = categoryPatterns.filter(pattern => 
          this.shouldPatternOccurInMonth(pattern, targetMonth)
        );
        
        for (const pattern of patternsForMonth) {
          monthlyAmount += pattern.averageAmount;
          
          // Add to breakdown
          monthlyBudgetBreakdown[targetMonth].patterns.push({
            pattern: pattern.displayName,
            amount: pattern.averageAmount,
            type: pattern.recurrencePattern,
            category: categoryKey
          });
        }
        
        budget.setAmountForMonth(targetMonth, monthlyAmount);
      }
      
    } else {
      // Fixed budget: base average + any monthly patterns
      let fixedAmount = categoryAverage;
      
      // Add monthly patterns to fixed amount
      for (const pattern of categoryPatterns) {
        if (pattern.recurrencePattern === PATTERN_TYPES.MONTHLY) {
          fixedAmount += pattern.averageAmount;
        }
      }
      
      budget.convertToFixed(fixedAmount);
    }

    await budget.save();
    return { updated: true };
  }

  // ============================================
  // PATTERN MATCHING METHODS
  // ============================================

  /**
   * Determine if a pattern should occur in a specific month with future projections
   */
  shouldPatternOccurInMonth(pattern, targetMonth) {
    const { recurrencePattern, scheduledMonths } = pattern;

    // Always check if explicitly scheduled for this month first
    if (scheduledMonths && scheduledMonths.includes(targetMonth)) {
      return true;
    }

    // For patterns without explicit scheduling or future projections, 
    // calculate expected months based on pattern type
    return this.calculateFutureOccurrences(pattern, targetMonth);
  }

  /**
   * Calculate future occurrences based on pattern type with improved logic
   */
  calculateFutureOccurrences(pattern, targetMonth) {
    const { recurrencePattern, scheduledMonths } = pattern;
    
    if (!scheduledMonths || scheduledMonths.length === 0) {
      logger.info(`Pattern ${pattern.patternId} has no scheduled months, skipping`);
      return false;
    }

    // Sort scheduled months to find the pattern
    const sortedMonths = [...scheduledMonths].sort((a, b) => a - b);
    
    logger.info(`Checking pattern ${pattern.patternId} (${recurrencePattern}) for month ${targetMonth}, scheduled months: [${sortedMonths.join(', ')}]`);
    
    switch (recurrencePattern) {
      case PATTERN_TYPES.MONTHLY:
        // Every month - monthly patterns should occur in every month
        logger.info(`Monthly pattern ${pattern.patternId}: occurs every month, including month ${targetMonth}`);
        return true;
        
      case PATTERN_TYPES.BI_MONTHLY:
        // Every 2 months - check if targetMonth fits the bi-monthly cycle
        return this.isBiMonthlyMatch(sortedMonths, targetMonth);
        
      case PATTERN_TYPES.QUARTERLY:
        // Every 3 months - check if targetMonth fits the quarterly cycle
        return this.isQuarterlyMatch(sortedMonths, targetMonth);
        
      case PATTERN_TYPES.YEARLY:
        // For yearly patterns, check if targetMonth matches any of the scheduled months
        // (accounting for multiple occurrences within a year)
        const matches = sortedMonths.includes(targetMonth);
        logger.info(`Yearly pattern ${pattern.patternId}: month ${targetMonth} ${matches ? 'matches' : 'does not match'} scheduled months`);
        return matches;
        
      default:
        logger.info(`Unknown recurrence pattern: ${recurrencePattern}`);
        return false;
    }
  }

  /**
   * Check if target month matches bi-monthly pattern using robust pattern matching utility
   */
  isBiMonthlyMatch(scheduledMonths, targetMonth) {
    const result = PatternMatchingUtils.isBiMonthlyMatch(scheduledMonths, targetMonth);
    
    // Log the detailed reasoning for debugging
    logger.info(`Bi-monthly pattern check: ${result.reasoning}`);
    
    return result.matches;
  }

  /**
   * Check if target month matches quarterly pattern using robust pattern matching utility
   */
  isQuarterlyMatch(scheduledMonths, targetMonth) {
    const result = PatternMatchingUtils.isQuarterlyMatch(scheduledMonths, targetMonth);
    
    // Log the detailed reasoning for debugging
    logger.info(`Quarterly pattern check: ${result.reasoning}`);
    
    return result.matches;
  }

  /**
   * Check if a transaction matches a newly detected pattern (before it's saved to DB)
   * @param {Object} transaction - Transaction to check
   * @param {Object} detectedPattern - Newly detected pattern object
   * @returns {boolean} True if transaction matches the pattern
   */
  matchesDetectedPattern(transaction, detectedPattern) {
    // Check amount range
    const amount = Math.abs(transaction.amount);
    const { amountRange } = detectedPattern.transactionIdentifier;
    if (amount < amountRange.min || amount > amountRange.max) {
      return false;
    }
    
    // Check category/subcategory IDs
    const transactionCategoryId = transaction.category?._id?.toString() || transaction.category?.toString();
    const transactionSubCatId = transaction.subCategory?._id?.toString() || transaction.subCategory?.toString();
    
    if (transactionCategoryId !== detectedPattern.transactionIdentifier.categoryId?.toString()) {
      return false;
    }
    
    if (detectedPattern.transactionIdentifier.subCategoryId && 
        transactionSubCatId !== detectedPattern.transactionIdentifier.subCategoryId?.toString()) {
      return false;
    }
    
    // Check description similarity (basic contains check)
    const normalizedTransactionDesc = transaction.description?.toLowerCase().trim() || '';
    const normalizedPatternDesc = detectedPattern.transactionIdentifier.description.toLowerCase().trim();
    
    return normalizedTransactionDesc.includes(normalizedPatternDesc) || 
           normalizedPatternDesc.includes(normalizedTransactionDesc);
  }

  // ============================================
  // TRANSACTION EXCLUSION OPERATIONS
  // ============================================

  /**
   * Recalculate budget with exclusions for a specific category/subcategory
   * Uses the same sophisticated pattern-aware logic as calculateMonthlyBudgetFromHistory
   * but focuses on a single category/subcategory
   */
  async recalculateBudgetWithExclusions(userId, categoryId, subCategoryId, monthsToAnalyze = 6) {
    try {
      logger.info(`Recalculating pattern-aware budget with exclusions for category ${categoryId}, subcategory ${subCategoryId}`);

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // STEP 1: GET APPROVED PATTERNS FOR THIS CATEGORY
      const allApprovedPatterns = await TransactionPattern.getActivePatterns(userId);
      const categoryKey = `${categoryId}_${subCategoryId || 'null'}`;
      const categoryPatterns = allApprovedPatterns.filter(pattern => {
        return pattern.transactionIdentifier.categoryId.toString() === categoryId.toString() &&
               (pattern.transactionIdentifier.subCategoryId?.toString() || 'null') === (subCategoryId?.toString() || 'null');
      });

      logger.info(`Found ${categoryPatterns.length} patterns for category ${categoryId}, subcategory ${subCategoryId}`);

      // STEP 2: ANALYZE TRANSACTIONS FOR THIS SPECIFIC CATEGORY
      const { nonPatternedTransactions } = await this._analyzeTransactionsForBudget(
        userId, currentYear, currentMonth, monthsToAnalyze, allApprovedPatterns
      );

      // Filter transactions for our specific category/subcategory
      const categoryTransactions = nonPatternedTransactions.filter(transaction => {
        const matchesCategory = transaction.category?._id?.toString() === categoryId.toString();
        const matchesSubCategory = subCategoryId 
          ? transaction.subCategory?._id?.toString() === subCategoryId.toString()
          : !transaction.subCategory;
        return matchesCategory && matchesSubCategory;
      });

      logger.info(`Found ${categoryTransactions.length} non-patterned transactions for this category`);

      // STEP 3: CALCULATE BASE AVERAGE FOR THIS CATEGORY  
      const categoryAverages = {};
      let baseAverage = 0;
      
      if (categoryTransactions.length > 0) {
        const categoryData = {
          amounts: categoryTransactions.map(t => Math.abs(t.amount)),
          monthsPresent: new Set(categoryTransactions.map(t => t.processedDate.getMonth() + 1))
        };

        const monthsWithData = new Set(nonPatternedTransactions.map(t => t.processedDate.getMonth() + 1));
        const strategy = averagingDenominatorService.getAveragingStrategy(
          categoryData.monthsPresent,
          monthsWithData,
          monthsToAnalyze
        );

        const totalAmount = categoryData.amounts.reduce((sum, amt) => sum + amt, 0);
        baseAverage = Math.round(totalAmount / strategy.denominator);
        
        // Format for _processCategoryBudget method
        categoryAverages[categoryKey] = {
          average: baseAverage,
          categoryId: categoryId.toString(),
          subCategoryId: subCategoryId ? subCategoryId.toString() : null,
          categoryName: categoryTransactions[0]?.category?.name || 'Unknown',
          subCategoryName: categoryTransactions[0]?.subCategory?.name || null
        };
        
        logger.info(`📊 Base average for category: ₪${baseAverage}/month (${categoryTransactions.length} transactions, strategy: ${strategy.strategy})`);
      } else {
        // No transactions found, set base average to 0
        categoryAverages[categoryKey] = {
          average: 0,
          categoryId: categoryId.toString(),
          subCategoryId: subCategoryId ? subCategoryId.toString() : null,
          categoryName: 'Unknown',
          subCategoryName: null
        };
      }

      // STEP 4: UPDATE BUDGET USING EXISTING _processCategoryBudget METHOD
      logger.info('Step 4: Updating budget using pattern-aware processing...');
      const monthlyBudgetBreakdown = {}; // Not used in recalculation but required by method
      
      const result = await this._processCategoryBudget(
        userId, 
        categoryKey, 
        categoryAverages, 
        allApprovedPatterns, 
        monthlyBudgetBreakdown
      );

      // Get the updated budget for additional tracking
      const budget = await CategoryBudget.findOne({ 
        userId,
        categoryId,
        subCategoryId: subCategoryId || null 
      });

      // Add recalculation-specific tracking
      if (budget && budget.editHistory.length > 0) {
        const lastEdit = budget.editHistory[budget.editHistory.length - 1];
        lastEdit.editType = 'smart_recalculation';
        lastEdit.reason = `Recalculated: base ₪${baseAverage} from ${categoryTransactions.length} transactions + ${categoryPatterns.length} patterns`;
        await budget.save();
      }

      // Determine budget type for return data
      const hasVariablePatterns = categoryPatterns.some(pattern => 
        pattern.recurrencePattern !== PATTERN_TYPES.MONTHLY
      );

      const returnData = {
        baseAverage,
        transactionCount: categoryTransactions.length,
        patternsCount: categoryPatterns.length,
        monthsAnalyzed: monthsToAnalyze,
        budgetType: budget.budgetType || (hasVariablePatterns ? 'variable' : 'fixed'),
        budget
      };

      // Only include recalculatedAmount for fixed budgets where it's meaningful
      if (budget.budgetType === 'fixed') {
        returnData.recalculatedAmount = budget.fixedAmount || baseAverage;
      }

      return returnData;
    } catch (error) {
      logger.error('Error recalculating budget with exclusions:', error);
      throw error;
    }
  }
}

module.exports = new BudgetCalculationService();
