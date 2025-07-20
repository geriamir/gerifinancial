const recurrenceDetectionService = require('./recurrenceDetectionService');
const TransactionPattern = require('../models/TransactionPattern');
const BudgetService = require('./budgetService');
const Transaction = require('../models/Transaction');
const PatternMatchingUtils = require('../utils/patternMatching');

/**
 * Smart Budget Service - Enhanced budget calculation with pattern awareness
 * Implements the proper workflow: Pattern Detection → User Approval → Smart Calculation
 */
class SmartBudgetService {
  
  /**
   * Step 1: Detect patterns for a user
   */
  async detectPatternsForUser(userId, analysisMonths = 6) {
    console.log(`Starting pattern detection for user ${userId} with ${analysisMonths} months of data`);
    
    try {
      // Use existing recurrence detection service
      const detectedPatterns = await recurrenceDetectionService.detectPatterns(userId, analysisMonths);
      
      console.log(`Detected ${detectedPatterns.length} potential patterns for user ${userId}`);
      
      // Store detected patterns in database if any were found
      if (detectedPatterns.length > 0) {
        console.log(`Storing ${detectedPatterns.length} detected patterns in database...`);
        const storedPatterns = await recurrenceDetectionService.storeDetectedPatterns(detectedPatterns);
        console.log(`Successfully stored ${storedPatterns.length} patterns`);
        
        return {
          success: true,
          patterns: storedPatterns,
          totalDetected: storedPatterns.length,
          requiresUserApproval: storedPatterns.length > 0
        };
      }
      
      return {
        success: true,
        patterns: [],
        totalDetected: 0,
        requiresUserApproval: false
      };
    } catch (error) {
      console.error('Error detecting patterns:', error);
      throw error;
    }
  }

  /**
   * Step 2: Check if user has pending patterns that need approval
   */
  async checkPendingPatterns(userId) {
    try {
      const pendingPatterns = await TransactionPattern.getPendingPatterns(userId);
      
      return {
        hasPending: pendingPatterns.length > 0,
        pendingCount: pendingPatterns.length,
        patterns: pendingPatterns,
        message: pendingPatterns.length > 0 
          ? `You have ${pendingPatterns.length} detected spending patterns awaiting your approval`
          : 'No pending patterns - ready for budget calculation'
      };
    } catch (error) {
      console.error('Error checking pending patterns:', error);
      throw error;
    }
  }

  /**
   * Step 3: Calculate smart budget with pattern-aware logic
   */
  async calculateSmartBudget(userId, year, month, analysisMonths = 6) {
    console.log(`Starting smart budget calculation for user ${userId}, ${year}-${month}`);
    
    try {
      // First check if there are pending patterns
      const pendingCheck = await this.checkPendingPatterns(userId);
      
      if (pendingCheck.hasPending) {
        throw new Error(`Cannot calculate budget with ${pendingCheck.pendingCount} pending patterns. Please approve or reject patterns first.`);
      }

      // Get approved patterns for this user
      const approvedPatterns = await TransactionPattern.getActivePatterns(userId);
      console.log(`Found ${approvedPatterns.length} approved patterns for budget calculation`);

      // Get historical transactions for analysis
      const startDate = new Date(year, month - 1 - analysisMonths, 1);
      const endDate = new Date(year, month - 1, 0);

      const transactions = await Transaction.find({
        userId,
        date: { $gte: startDate, $lte: endDate },
        amount: { $lt: 0 } // Only expense transactions
      }).populate('category subCategory');

      // Separate recurring from non-recurring transactions
      const { recurringTransactions, nonRecurringTransactions } = this.separateRecurringTransactions(
        transactions, 
        approvedPatterns
      );

      console.log(`Separated transactions: ${recurringTransactions.length} recurring, ${nonRecurringTransactions.length} non-recurring`);

      // Calculate budget components
      const budgetCalculation = await this.calculateBudgetComponents(
        nonRecurringTransactions,
        approvedPatterns,
        year,
        month,
        analysisMonths
      );

      return {
        success: true,
        budget: budgetCalculation.budget,
        calculation: {
          analysisMonths,
          totalTransactions: transactions.length,
          recurringTransactions: recurringTransactions.length,
          nonRecurringTransactions: nonRecurringTransactions.length,
          approvedPatterns: approvedPatterns.length,
          methodology: 'pattern-aware-calculation'
        },
        patterns: {
          approved: approvedPatterns.map(p => ({
            id: p._id,
            description: p.displayName,
            type: p.recurrencePattern,
            amount: p.averageAmount,
            months: p.scheduledMonths
          }))
        }
      };

    } catch (error) {
      console.error('Error calculating smart budget:', error);
      throw error;
    }
  }

  /**
   * Separate recurring transactions from non-recurring ones
   */
  separateRecurringTransactions(transactions, approvedPatterns) {
    const recurringTransactions = [];
    const nonRecurringTransactions = [];

    for (const transaction of transactions) {
      let isRecurring = false;

      // Check if this transaction matches any approved pattern
      for (const pattern of approvedPatterns) {
        if (pattern.matchesTransaction(transaction)) {
          recurringTransactions.push(transaction);
          isRecurring = true;
          break;
        }
      }

      if (!isRecurring) {
        nonRecurringTransactions.push(transaction);
      }
    }

    return { recurringTransactions, nonRecurringTransactions };
  }

  /**
   * Calculate budget components with pattern-aware logic
   */
  async calculateBudgetComponents(nonRecurringTransactions, approvedPatterns, year, month, analysisMonths) {
    console.log('Calculating budget components with pattern-aware logic');

    // Group non-recurring transactions by category/subcategory
    const categoryGroups = this.groupTransactionsByCategory(nonRecurringTransactions);

    // Calculate averages for non-recurring expenses only
    const expenseBudgets = [];
    
    for (const [key, transactions] of Object.entries(categoryGroups)) {
      const [categoryId, subCategoryId] = key.split('|');
      
      // Calculate average for non-recurring transactions in this category
      const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const averageAmount = totalAmount / analysisMonths; // Average per month
      
      if (averageAmount > 0) {
        expenseBudgets.push({
          categoryId,
          subCategoryId,
          budgetedAmount: Math.round(averageAmount),
          actualAmount: 0,
          source: 'non-recurring-average'
        });
      }
    }

    // Add recurring expenses for their scheduled months
    const recurringBudgets = this.calculateRecurringBudgets(approvedPatterns, month);
    
    // Merge non-recurring averages with recurring budgets
    const mergedBudgets = this.mergeBudgetComponents(expenseBudgets, recurringBudgets);

    // Calculate totals
    const totalBudgetedExpenses = mergedBudgets.reduce((sum, b) => sum + b.budgetedAmount, 0);

    const budget = {
      year,
      month,
      currency: 'ILS',
      salaryBudget: 0, // Will be set separately or from existing budget
      otherIncomeBudgets: [],
      expenseBudgets: mergedBudgets,
      totalBudgetedIncome: 0,
      totalBudgetedExpenses,
      totalActualIncome: 0,
      totalActualExpenses: 0,
      budgetBalance: 0 - totalBudgetedExpenses, // Will be updated when income is set
      actualBalance: 0,
      isAutoCalculated: true,
      notes: `Smart budget calculated from ${analysisMonths} months of data, excluding recurring patterns. Includes ${approvedPatterns.length} approved recurring patterns.`,
      status: 'draft'
    };

    return { budget };
  }

  /**
   * Calculate recurring budgets for specific month with projections
   */
  calculateRecurringBudgets(approvedPatterns, targetMonth) {
    const recurringBudgets = [];

    for (const pattern of approvedPatterns) {
      // Check if this pattern should occur in the target month
      if (this.shouldPatternOccurInMonth(pattern, targetMonth)) {
        recurringBudgets.push({
          categoryId: pattern.transactionIdentifier.categoryId,
          subCategoryId: pattern.transactionIdentifier.subCategoryId,
          budgetedAmount: Math.round(pattern.averageAmount),
          actualAmount: 0,
          source: 'recurring-pattern',
          patternId: pattern._id,
          patternType: pattern.recurrencePattern
        });
      }
    }

    return recurringBudgets;
  }

  /**
   * Determine if a pattern should occur in a specific month with future projections
   */
  shouldPatternOccurInMonth(pattern, targetMonth) {
    const { recurrencePattern, scheduledMonths } = pattern;

    // Always check if explicitly scheduled for this month first
    if (scheduledMonths && scheduledMonths.includes(targetMonth)) {
      console.log(`Pattern ${pattern.patternId} explicitly scheduled for month ${targetMonth}`);
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
      console.log(`Pattern ${pattern.patternId} has no scheduled months, skipping`);
      return false;
    }

    // Sort scheduled months to find the pattern
    const sortedMonths = [...scheduledMonths].sort((a, b) => a - b);
    
    console.log(`Checking pattern ${pattern.patternId} (${recurrencePattern}) for month ${targetMonth}, scheduled months: [${sortedMonths.join(', ')}]`);
    
    switch (recurrencePattern) {
      case 'bi-monthly':
        // Every 2 months - check if targetMonth fits the bi-monthly cycle
        return this.isBiMonthlyMatch(sortedMonths, targetMonth);
        
      case 'quarterly':
        // Every 3 months - check if targetMonth fits the quarterly cycle
        return this.isQuarterlyMatch(sortedMonths, targetMonth);
        
      case 'yearly':
        // For yearly patterns, check if targetMonth matches any of the scheduled months
        // (accounting for multiple occurrences within a year)
        const matches = sortedMonths.includes(targetMonth);
        console.log(`Yearly pattern ${pattern.patternId}: month ${targetMonth} ${matches ? 'matches' : 'does not match'} scheduled months`);
        return matches;
        
      default:
        console.log(`Unknown recurrence pattern: ${recurrencePattern}`);
        return false;
    }
  }

  /**
   * Check if target month matches bi-monthly pattern using robust pattern matching utility
   */
  isBiMonthlyMatch(scheduledMonths, targetMonth) {
    const result = PatternMatchingUtils.isBiMonthlyMatch(scheduledMonths, targetMonth);
    
    // Log the detailed reasoning for debugging
    console.log(`Bi-monthly pattern check: ${result.reasoning}`);
    
    return result.matches;
  }

  /**
   * Check if target month matches quarterly pattern using robust pattern matching utility
   */
  isQuarterlyMatch(scheduledMonths, targetMonth) {
    const result = PatternMatchingUtils.isQuarterlyMatch(scheduledMonths, targetMonth);
    
    // Log the detailed reasoning for debugging
    console.log(`Quarterly pattern check: ${result.reasoning}`);
    
    return result.matches;
  }

  /**
   * Group transactions by category/subcategory
   */
  groupTransactionsByCategory(transactions) {
    const groups = {};

    for (const transaction of transactions) {
      const categoryId = transaction.category?._id || transaction.category || 'unknown';
      const subCategoryId = transaction.subCategory?._id || transaction.subCategory || 'general';
      const key = `${categoryId}|${subCategoryId}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(transaction);
    }

    return groups;
  }

  /**
   * Merge non-recurring averages with recurring budgets
   */
  mergeBudgetComponents(expenseBudgets, recurringBudgets) {
    const merged = [...expenseBudgets];

    // Add recurring budgets, combining with existing categories if needed
    for (const recurringBudget of recurringBudgets) {
      const existingIndex = merged.findIndex(
        b => b.categoryId === recurringBudget.categoryId && 
             b.subCategoryId === recurringBudget.subCategoryId
      );

      if (existingIndex >= 0) {
        // Combine with existing budget
        merged[existingIndex].budgetedAmount += recurringBudget.budgetedAmount;
        merged[existingIndex].source = 'combined-average-and-pattern';
        merged[existingIndex].patternInfo = {
          patternId: recurringBudget.patternId,
          patternType: recurringBudget.patternType,
          recurringAmount: recurringBudget.budgetedAmount
        };
      } else {
        // Add as new budget item
        merged.push(recurringBudget);
      }
    }

    return merged;
  }

  /**
   * Complete smart budget workflow: detect → approve → calculate
   */
  async executeSmartBudgetWorkflow(userId, year, month, analysisMonths = 6) {
    console.log(`Executing smart budget workflow for user ${userId}`);

    try {
      // Step 1: Check for pending patterns first
      const pendingCheck = await this.checkPendingPatterns(userId);
      
      if (pendingCheck.hasPending) {
        // Return existing pending patterns for user approval
        return {
          step: 'pattern-approval-required',
          success: false,
          message: `Found ${pendingCheck.pendingCount} spending patterns that need your approval before calculating budget`,
          pendingPatterns: pendingCheck.patterns,
          nextAction: 'approve-patterns'
        };
      }

      // Step 2: If no pending patterns, check if we should detect new ones
      console.log('No pending patterns found, checking if new detection is needed...');
      
      // Check if we already have patterns for this user (approved or rejected)
      const existingPatterns = await TransactionPattern.find({ userId });
      
      if (existingPatterns.length === 0) {
        // No patterns exist at all - do initial detection
        console.log('No patterns exist, performing initial pattern detection...');
        const detectionResult = await this.detectPatternsForUser(userId, analysisMonths);
        
        if (detectionResult.requiresUserApproval && detectionResult.patterns.length > 0) {
          // New patterns detected - user needs to approve them first
          return {
            step: 'pattern-detection-complete',
            success: false,
            message: `Detected ${detectionResult.totalDetected} new spending patterns. Please review and approve them to continue with budget calculation.`,
            detectedPatterns: detectionResult.patterns,
            nextAction: 'approve-patterns'
          };
        }
      } else {
        console.log(`Found ${existingPatterns.length} existing patterns - skipping detection`);
      }

      // Step 3: No patterns detected or all patterns already handled, calculate budget
      console.log('No new patterns detected, proceeding with budget calculation...');
      const budgetResult = await this.calculateSmartBudget(userId, year, month, analysisMonths);

      // Actually create and save the budget to database
      console.log('Saving smart budget to database...');
      const budgetService = new BudgetService();
      const savedBudget = await budgetService.createMonthlyBudget(userId, year, month, budgetResult.budget);
      console.log('Smart budget saved successfully');

      return {
        step: 'budget-calculated',
        success: true,
        message: 'Smart budget calculated and saved successfully with pattern-aware logic',
        budget: savedBudget,
        calculation: budgetResult.calculation,
        patterns: budgetResult.patterns
      };

    } catch (error) {
      console.error('Error in smart budget workflow:', error);
      throw error;
    }
  }
}

module.exports = new SmartBudgetService();
