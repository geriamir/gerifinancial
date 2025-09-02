const currencyExchangeService = require('../../foreign-currency/services/currencyExchangeService');
const unplannedExpenseService = require('./unplannedExpenseService');
const installmentGroupingUtils = require('../../shared/utils/installmentGroupingUtils');
const { CurrencyExchange, Transaction, Category, SubCategory } = require('../../shared/models');

/**
 * Service for handling project budget overview calculations and recommendations
 */
class ProjectOverviewService {
  
  /**
   * Calculate actual amount for a category budget based on allocated transactions
   * @param {Object} budget - Category budget object
   * @param {string} projectCurrency - Project currency
   * @returns {number} - Calculated actual amount in project currency
   */
  async calculateActualAmountForBudget(budget, projectCurrency) {
    // Return 0 immediately if no allocated transactions
    if (!budget.allocatedTransactions || budget.allocatedTransactions.length === 0) {
      return 0;
    }

    // Manually fetch the allocated transactions since they might not be populated
    const populatedTransactions = await Transaction.find({
      _id: { $in: budget.allocatedTransactions }
    });

    let actualAmount = 0;
    for (const transaction of populatedTransactions) {
      // Ensure transaction exists and has an amount
      if (!transaction || typeof transaction.amount !== 'number') {
        console.warn(`Invalid transaction in allocated transactions: ${transaction ? transaction._id : 'null'}`);
        continue;
      }

      let convertedAmount = Math.abs(transaction.amount);
      
      // Convert to project currency if needed
      if (transaction.currency !== projectCurrency) {
        try {
          const conversionResult = await currencyExchangeService.convertAmount(
            Math.abs(transaction.amount),
            transaction.currency,
            projectCurrency,
            transaction.processedDate,
            true // Allow fallback to nearest rate
          );
          convertedAmount = conversionResult.convertedAmount;
        } catch (error) {
          console.warn(`Currency conversion failed for transaction ${transaction._id}:`, error.message);
          // Keep the original amount as fallback
        }
      }
      
      // Ensure we're adding a valid number
      if (!isNaN(convertedAmount) && isFinite(convertedAmount)) {
        actualAmount += convertedAmount;
      }
    }
    
    // Ensure we return a valid number
    return isNaN(actualAmount) ? 0 : actualAmount;
  }

  /**
   * Calculate totals in project currency with currency conversion
   * @param {Object} project - Project budget document
   * @returns {Object} - Totals in project currency
   */
  async calculateTotalsInProjectCurrency(project) {
    let totalBudgetConverted = 0;
    let totalPaidConverted = 0;
    
    for (const budget of project.categoryBudgets) {
      try {
        // Calculate actual amount dynamically from allocated transactions
        const actualAmount = await this.calculateActualAmountForBudget(budget, project.currency);
        
        // Convert budgeted amount to project currency
        if (budget.currency === project.currency) {
          totalBudgetConverted += budget.budgetedAmount;
          totalPaidConverted += actualAmount;
        } else {
          const budgetedConverted = await CurrencyExchange.convertAmount(
            budget.budgetedAmount,
            budget.currency,
            project.currency
          );
          
          totalBudgetConverted += budgetedConverted;
          totalPaidConverted += actualAmount; // actualAmount is already in project currency
          console.log(`Converted ${budget.budgetedAmount} ${budget.currency} to ${budgetedConverted} ${project.currency}`);
        }
      } catch (error) {
        // If conversion fails, use original amounts as fallback
        console.warn(`Currency conversion failed for ${budget.currency} to ${project.currency}:`, error.message);
        const actualAmount = await this.calculateActualAmountForBudget(budget, project.currency);
        totalBudgetConverted += budget.budgetedAmount;
        totalPaidConverted += actualAmount;
      }
    }
    
    return {
      totalBudgetInProjectCurrency: totalBudgetConverted,
      totalPaidInProjectCurrency: totalPaidConverted,
      remainingBudgetInProjectCurrency: Math.max(totalBudgetConverted - totalPaidConverted, 0),
      progressPercentageInProjectCurrency: totalBudgetConverted > 0 
        ? Math.min((totalPaidConverted / totalBudgetConverted) * 100, 100) 
        : 0
    };
  }

  /**
   * Calculate funding totals in project currency with currency conversion
   * @param {Object} project - Project budget document
   * @returns {Object} - Funding totals in project currency
   */
  async calculateFundingInProjectCurrency(project) {
    let totalFundingConverted = 0;
    let totalAvailableFundingConverted = 0;
    
    for (const source of project.fundingSources) {
      try {
        // Convert funding amounts to project currency
        if (source.currency === project.currency) {
          totalFundingConverted += source.expectedAmount;
          totalAvailableFundingConverted += source.availableAmount;
        } else {
          const expectedConverted = await CurrencyExchange.convertAmount(
            source.expectedAmount,
            source.currency,
            project.currency
          );
          const availableConverted = await CurrencyExchange.convertAmount(
            source.availableAmount,
            source.currency,
            project.currency
          );
          
          totalFundingConverted += expectedConverted;
          totalAvailableFundingConverted += availableConverted;
          console.log(`Converted funding ${source.expectedAmount} ${source.currency} to ${expectedConverted} ${project.currency}`);
        }
      } catch (error) {
        // If conversion fails, use original amounts as fallback
        console.warn(`Funding currency conversion failed for ${source.currency} to ${project.currency}:`, error.message);
        totalFundingConverted += source.expectedAmount;
        totalAvailableFundingConverted += source.availableAmount;
      }
    }
    
    return {
      totalFundingInProjectCurrency: totalFundingConverted,
      totalAvailableFundingInProjectCurrency: totalAvailableFundingConverted
    };
  }

  /**
   * Get recommendations for an unplanned expense
   * @param {Object} project - Project budget document
   * @param {Object} unplannedExpense - Unplanned expense object
   * @returns {Array} - Array of recommendation objects
   */
  async getRecommendationsForUnplannedExpense(project, unplannedExpense) {
    const recommendations = [];
    
    // Ensure we have populated category and subcategory data
    const expenseCategory = unplannedExpense.category;
    const expenseSubCategory = unplannedExpense.subCategory;
    
    if (!expenseCategory || !expenseSubCategory) {
      console.warn('Expense missing category or subcategory data for recommendations');
      return [];
    }
    
    console.log(`Getting recommendations for unplanned expense: ${unplannedExpense.transactionId}`);
    
    // Iterate through all planned budget categories to find matches
    for (const budget of project.categoryBudgets) {
      let confidence = 0;
      let reason = '';
      
      // Ensure budget has populated data
      if (!budget.categoryId || !budget.subCategoryId) {
        continue;
      }
      
      // Get populated category and subcategory names for the recommendation
      let categoryName = 'Unknown';
      let subCategoryName = 'Unknown';
      
      try {
        // Try to get names from populated data first
        if (budget.categoryId.name) {
          categoryName = budget.categoryId.name;
        } else {
          const category = await Category.findById(budget.categoryId);
          categoryName = category ? category.name : 'Unknown';
        }
        
        if (budget.subCategoryId.name) {
          subCategoryName = budget.subCategoryId.name;
        } else {
          const subCategory = await SubCategory.findById(budget.subCategoryId);
          subCategoryName = subCategory ? subCategory.name : 'Unknown';
        }
      } catch (error) {
        console.warn('Error getting category/subcategory names for recommendation:', error.message);
      }
      
      // Extract the actual ObjectId from populated objects for comparison
      const budgetSubCategoryId = budget.subCategoryId._id || budget.subCategoryId;
      const budgetCategoryId = budget.categoryId._id || budget.categoryId;
      
      // Only exact subcategory match
      console.log(`Checking exact match for subcategory: ${expenseSubCategory._id} vs ${budgetSubCategoryId.toString()}`);
      if (budgetSubCategoryId.toString() === expenseSubCategory._id.toString()) {
        confidence = 95;
        reason = `Exact match: ${expenseSubCategory.name}`;
      }
      
      // Only include recommendations above minimum confidence threshold
      if (confidence > 30) {
        // Calculate budget impact using dynamic actual amount calculation
        const expenseAmount = unplannedExpense.convertedAmount || 0;
        const currentBudgetedAmount = budget.budgetedAmount || 0;
        const currentActualAmount = await this.calculateActualAmountForBudget(budget, project.currency);
        const newActualAmount = currentActualAmount + expenseAmount;
        const wouldExceedBudget = newActualAmount > currentBudgetedAmount;
        
        recommendations.push({
          budgetId: budget._id,
          categoryId: budget.categoryId._id || budget.categoryId,
          subCategoryId: budget.subCategoryId._id || budget.subCategoryId,
          categoryName,
          subCategoryName,
          confidence,
          reason,
          currentBudgetedAmount,
          currentActualAmount,
          newActualAmount,
          wouldExceedBudget,
          confidenceLevel: confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low'
        });
      }
    }
    
    // Sort by confidence descending
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get unplanned expenses for a project
   * @param {Object} project - Project budget document
   * @returns {Object} - Object containing expenses and total
   */
  async getUnplannedExpenses(project) {
    console.log(`Getting unplanned expenses for project: ${project._id}, with tag ${project.projectTag}`);
    
    if (!project.projectTag) {
      return {
        expenses: [],
        totalInProjectCurrency: 0
      };
    }
    
    // Get all transactions tagged with this project
    const transactions = await Transaction.find({
      userId: project.userId,
      tags: project.projectTag,
    }).populate('category').populate('subCategory');

    console.log(`Found ${transactions.length} transactions tagged with ${project.projectTag}`);

    const unplannedExpenses = [];
    let totalUnplannedInProjectCurrency = 0;
    const processedTransactionIds = new Set();
    
    for (const transaction of transactions) {
      // Skip if already processed as part of an installment group
      if (processedTransactionIds.has(transaction._id.toString())) {
        continue;
      }

      // Filter out transactions that are already allocated to planned categories
      const isAllocated = project.categoryBudgets.some(budget =>
        budget.allocatedTransactions && budget.allocatedTransactions.includes(transaction._id)
      );
      
      if (isAllocated) {
        console.log(`Skipping transaction ${transaction._id} - already allocated to planned category`);
        continue;
      }

      // Only unallocated transactions tagged with the project are considered unplanned
      console.log(`Processing unplanned transaction ${transaction._id} category: ${transaction.category.name}/${transaction.subCategory.name}`);
      
      {
        // Use the installment grouping utility to handle this transaction
        if (installmentGroupingUtils.isInstallmentTransaction(transaction)) {
          // Find all related installments
          const relatedInstallments = installmentGroupingUtils.findRelatedInstallments(
            transaction, 
            transactions, 
            processedTransactionIds
          );

          if (relatedInstallments.length > 1) {
            // This is a multi-installment expense - group them
            const processingResult = await installmentGroupingUtils.processInstallmentsWithCurrency(
              relatedInstallments, 
              project.currency
            );
            
            // Create a grouped expense entry using the UnplannedExpenseService
            const groupedExpense = unplannedExpenseService.createInstallmentGroupExpense({
              earliestInstallment: processingResult.earliestInstallment,
              allInstallments: processingResult.sortedInstallments,
              totalOriginalAmount: processingResult.totalOriginalAmount,
              totalConvertedAmount: processingResult.totalConvertedAmount,
              installmentIds: processingResult.installmentIds
            });
            
            unplannedExpenses.push(groupedExpense.toObject());
            totalUnplannedInProjectCurrency += processingResult.totalConvertedAmount;
            
            // Mark all installments as processed
            relatedInstallments.forEach(inst => {
              processedTransactionIds.add(inst._id.toString());
            });
            
          } else {
            // Single installment or no related installments found - treat as regular expense
            const convertedExpense = await this._processRegularExpense(transaction, project);
            if (convertedExpense) {
              unplannedExpenses.push(convertedExpense);
              totalUnplannedInProjectCurrency += convertedExpense.convertedAmount;
              processedTransactionIds.add(transaction._id.toString());
            }
          }
          
        } else {
          // Not an installment transaction - treat as regular expense
          const convertedExpense = await this._processRegularExpense(transaction, project);
          if (convertedExpense) {
            unplannedExpenses.push(convertedExpense);
            totalUnplannedInProjectCurrency += convertedExpense.convertedAmount;
            processedTransactionIds.add(transaction._id.toString());
          }
        }
      }
    }
    
    return {
      expenses: unplannedExpenses,
      totalInProjectCurrency: totalUnplannedInProjectCurrency
    };
  }

  /**
   * Process a regular (non-installment) expense transaction
   * @param {Object} transaction - Transaction document
   * @param {Object} project - Project budget document
   * @returns {Object|null} - Processed expense object or null
   */
  async _processRegularExpense(transaction, project) {
    let convertedAmount = Math.abs(transaction.amount);
    let exchangeRate = 1;
    
    // Convert to project currency if needed
    if (transaction.currency !== project.currency) {
      try {
        const conversionResult = await currencyExchangeService.convertAmount(
          Math.abs(transaction.amount),
          transaction.currency,
          project.currency,
          transaction.processedDate,
          true // Allow fallback to nearest rate
        );
        convertedAmount = conversionResult.convertedAmount;
        exchangeRate = conversionResult.exchangeRate;
        
        if (conversionResult.fallback) {
          console.log(`Used fallback rate for transaction ${transaction._id}: ${conversionResult.source} (${conversionResult.daysDifference} days difference)`);
        }
      } catch (error) {
        console.warn(`Currency conversion failed for transaction ${transaction._id}:`, error.message);
      }
    }
    
    // Create strongly typed UnplannedExpense using service factory method
    const unplannedExpense = unplannedExpenseService.createRegularExpense(transaction, convertedAmount, exchangeRate);
    return unplannedExpense.toObject();
  }

  /**
   * Get unplanned expenses with recommendations
   * @param {Object} project - Project budget document
   * @returns {Object} - Object containing expenses with recommendations and total
   */
  async getUnplannedExpensesWithRecommendations(project) {
    console.log(`Getting unplanned expenses with recommendations for project: ${project._id}`);
    
    // First get the basic unplanned expenses
    const unplannedResult = await this.getUnplannedExpenses(project);
    
    // Add recommendations to each unplanned expense
    const expensesWithRecommendations = await Promise.all(
      unplannedResult.expenses.map(async (expense) => {
        const recommendations = await this.getRecommendationsForUnplannedExpense(project, expense);
        return {
          ...expense,
          recommendations: recommendations
        };
      })
    );
    
    return {
      expenses: expensesWithRecommendations,
      totalInProjectCurrency: unplannedResult.totalInProjectCurrency
    };
  }

  /**
   * Get allocated transactions for planned budget items with proper installment grouping
   * @param {Object} project - Project budget document
   * @returns {Object} - Object containing grouped allocated transactions for each budget item
   */
  async getPlannedExpensesGrouped(project) {
    console.log(`Getting planned expenses with grouping for project: ${project._id}`);
    
    const plannedExpenses = {};
    
    for (const budget of project.categoryBudgets) {
      if (!budget.allocatedTransactions || budget.allocatedTransactions.length === 0) {
        plannedExpenses[budget._id] = {
          budgetId: budget._id,
          expenses: [],
          totalInProjectCurrency: 0,
          expenseCount: 0
        };
        continue;
      }
      
      // Fetch the allocated transactions
      const allocatedTransactions = await Transaction.find({
        _id: { $in: budget.allocatedTransactions }
      }).populate('category').populate('subCategory');
      
      console.log(`Found ${allocatedTransactions.length} allocated transactions for budget ${budget._id}`);
      
      // Process regular transactions with currency conversion
      const processRegularTransaction = async (transaction) => {
        let convertedAmount = Math.abs(transaction.amount);
        let exchangeRate = 1;
        
        // Convert to project currency if needed
        if (transaction.currency !== project.currency) {
          try {
            const conversionResult = await currencyExchangeService.convertAmount(
              Math.abs(transaction.amount),
              transaction.currency,
              project.currency,
              transaction.processedDate,
              true // Allow fallback to nearest rate
            );
            convertedAmount = conversionResult.convertedAmount;
            exchangeRate = conversionResult.exchangeRate;
            
            if (conversionResult.fallback) {
              console.log(`Used fallback rate for transaction ${transaction._id}: ${conversionResult.source} (${conversionResult.daysDifference} days difference)`);
            }
          } catch (error) {
            console.warn(`Currency conversion failed for transaction ${transaction._id}:`, error.message);
          }
        }
        
        return {
          transaction: {
            ...transaction.toObject(),
            convertedAmount,
            exchangeRate
          },
          convertedAmount
        };
      };
      
      // Use the installment grouping utility to group allocated transactions
      const groupingResult = await installmentGroupingUtils.groupTransactionsByInstallments(
        allocatedTransactions,
        project.currency,
        processRegularTransaction
      );
      
      plannedExpenses[budget._id] = {
        budgetId: budget._id,
        expenses: groupingResult.groupedTransactions.map(item => ({
          ...item.transaction,
          convertedAmount: item.convertedAmount,
          isInstallmentGroup: item.isGroup,
          installmentCount: item.installmentCount
        })),
        totalInProjectCurrency: groupingResult.totalAmount,
        expenseCount: groupingResult.groupedTransactions.length
      };
      
      console.log(`Processed ${groupingResult.groupedTransactions.length} grouped expenses for budget ${budget._id}, total: ${groupingResult.totalAmount}`);
    }
    
    return plannedExpenses;
  }

  /**
   * Get comprehensive project overview
   * @param {Object} project - Project budget document
   * @returns {Object} - Complete project overview with all calculations
   */
  async getProjectOverview(project) {
    // Get unplanned expenses with recommendations
    const unplannedExpenses = await this.getUnplannedExpensesWithRecommendations(project);
    
    // Get planned expenses with proper installment grouping
    const plannedExpensesGrouped = await this.getPlannedExpensesGrouped(project);
    
    // Create enhanced category breakdown that combines budget info with grouped transactions
    const categoryBreakdown = await Promise.all(
      project.categoryBudgets.map(async (budget) => {
        // Calculate actual amount dynamically from allocated transactions
        const actualAmount = await this.calculateActualAmountForBudget(budget, project.currency);
        const variance = actualAmount - budget.budgetedAmount;
        const variancePercentage = budget.budgetedAmount > 0 
          ? (variance / budget.budgetedAmount) * 100 
          : 0;
        
        let budgetedInProjectCurrency = budget.budgetedAmount;
        let actualInProjectCurrency = actualAmount; // Already in project currency from calculation
        let varianceInProjectCurrency = variance;
        
        // Convert budgeted amount to project currency if different
        if (budget.currency !== project.currency) {
          try {
            budgetedInProjectCurrency = await CurrencyExchange.convertAmount(
              budget.budgetedAmount,
              budget.currency,
              project.currency
            );
            varianceInProjectCurrency = actualInProjectCurrency - budgetedInProjectCurrency;
            console.log(`Converted ${budget.budgetedAmount} ${budget.currency} to ${budgetedInProjectCurrency} ${project.currency}`);
          } catch (error) {
            console.warn(`Currency conversion failed for ${budget.currency} to ${project.currency}:`, error.message);
          }
        }
        
        // Get the grouped expenses for this budget from plannedExpensesGrouped
        const budgetGroupedExpenses = plannedExpensesGrouped[budget._id] || {
          expenses: [],
          totalInProjectCurrency: 0,
          expenseCount: 0
        };
        
        // Transform the expenses to match the enhanced CategoryBreakdownItem interface
        const enhancedExpenses = budgetGroupedExpenses.expenses.map(expense => ({
          _id: expense._id,
          amount: expense.amount,
          amountInProjectCurrency: expense.convertedAmount || expense.amountInProjectCurrency,
          currency: expense.currency,
          date: expense.date || expense.processedDate,
          description: expense.description,
          categoryName: expense.category?.name || 'Unknown',
          subCategoryName: expense.subCategory?.name,
          isInstallmentGroup: expense.isInstallmentGroup,
          installmentCount: expense.installmentCount,
          installmentIdentifier: expense.installmentIdentifier,
          originalAmount: expense.originalAmount,
          originalCurrency: expense.originalCurrency,
          exchangeRate: expense.exchangeRate
        }));
        
        return {
          budgetId: budget._id.toString(),
          categoryId: budget.categoryId,
          subCategoryId: budget.subCategoryId,
          description: budget.description, // User-defined description for planned expense name
          budgeted: budget.budgetedAmount,
          actual: actualAmount, // Dynamic calculation result
          currency: budget.currency,
          budgetedInProjectCurrency,
          actualInProjectCurrency,
          variance,
          varianceInProjectCurrency,
          variancePercentage,
          status: variance > 0 ? 'over' : variance < 0 ? 'under' : 'exact',
          expenses: enhancedExpenses,
          expenseCount: budgetGroupedExpenses.expenseCount
        };
      })
    );
    
    const totalsInProjectCurrency = await this.calculateTotalsInProjectCurrency(project);
    const fundingInProjectCurrency = await this.calculateFundingInProjectCurrency(project);
    
    // Calculate total paid including unplanned expenses
    const totalPaidWithUnplanned = totalsInProjectCurrency.totalPaidInProjectCurrency + unplannedExpenses.totalInProjectCurrency;
    
    // Calculate progress including unplanned expenses
    const progressWithUnplanned = totalsInProjectCurrency.totalBudgetInProjectCurrency > 0 
      ? Math.min(Math.round((totalPaidWithUnplanned / totalsInProjectCurrency.totalBudgetInProjectCurrency) * 100), 100) 
      : 0;
    
    // Determine if over budget
    const isOverBudget = totalPaidWithUnplanned > totalsInProjectCurrency.totalBudgetInProjectCurrency;
    
    return {
      name: project.name,
      status: project.status,
      currency: project.currency,
      progress: progressWithUnplanned,
      totalBudget: totalsInProjectCurrency.totalBudgetInProjectCurrency,
      totalPaid: totalPaidWithUnplanned,
      totalPlannedPaid: totalsInProjectCurrency.totalPaidInProjectCurrency,
      totalUnplannedPaid: unplannedExpenses.totalInProjectCurrency,
      remainingBudget: Math.max(totalsInProjectCurrency.totalBudgetInProjectCurrency - totalPaidWithUnplanned, 0),
      isOverBudget: isOverBudget,
      totalFunding: fundingInProjectCurrency.totalFundingInProjectCurrency,
      totalAvailableFunding: fundingInProjectCurrency.totalAvailableFundingInProjectCurrency,
      daysRemaining: project.daysRemaining,
      categoryBreakdown, // Now contains enhanced data with both budget info and grouped transactions
      fundingSources: project.fundingSources,
      unplannedExpenses: unplannedExpenses.expenses,
      unplannedExpensesCount: unplannedExpenses.expenses.length
    };
  }
}

module.exports = new ProjectOverviewService();
