const { MonthlyBudget, CategoryBudget, Transaction, Category, SubCategory, TransactionExclusion } = require('../../models');
const logger = require('../../utils/logger');
const yearlyBudgetService = require('./yearlyBudgetService');
const projectBudgetService = require('./projectBudgetService');
const budgetCalculationService = require('./budgetCalculationService');
const { BUDGET_STATUS } = require('../../constants/statusTypes');

class BudgetService {
  // ============================================
  // MONTHLY BUDGET OPERATIONS
  // ============================================

  /**
   * Create a new monthly budget
   */
  async createMonthlyBudget(userId, year, month, budgetData) {
    try {
      // Check if budget already exists
      const existingBudget = await MonthlyBudget.findOne({ userId, year, month });
      if (existingBudget) {
        throw new Error(`Monthly budget for ${month}/${year} already exists`);
      }

      const budget = new MonthlyBudget({
        userId,
        year,
        month,
        currency: budgetData.currency || 'ILS',
        salaryBudget: budgetData.salaryBudget || 0,
        otherIncomeBudgets: budgetData.otherIncomeBudgets || [],
        expenseBudgets: budgetData.expenseBudgets || [],
        notes: budgetData.notes || '',
        status: budgetData.status || BUDGET_STATUS.ACTIVE
      });

      await budget.save();
      logger.info(`Created monthly budget for user ${userId}: ${month}/${year}`);
      
      return budget;
    } catch (error) {
      logger.error('Error creating monthly budget:', error);
      throw error;
    }
  }

  /**
   * Get monthly budget for a specific month using CategoryBudget system with MonthlyBudget fallback
   */
  async getMonthlyBudget(userId, year, month) {
    try {
      // Get income budgets for the month
      const incomeBudgets = await CategoryBudget.getIncomeBudgets(userId, month);
      
      // Get expense budgets for the month
      const expenseBudgets = await CategoryBudget.getExpenseBudgets(userId, month);
      
      // Check if any CategoryBudgets exist - if not, fall back to old MonthlyBudget system
      if (incomeBudgets.length === 0 && expenseBudgets.length === 0) {
        logger.info(`No category budgets found for user ${userId} for month ${month}, checking MonthlyBudget`);
        
        // Fallback to old MonthlyBudget system for compatibility
        const oldBudget = await MonthlyBudget.findOne({ userId, year, month })
          .populate('expenseBudgets.categoryId', 'name type')
          .populate('expenseBudgets.subCategoryId', 'name')
          .populate('otherIncomeBudgets.categoryId', 'name type');
        
        if (oldBudget) {
          // Calculate actual amounts
          const actualAmounts = await this.getActualAmountsForMonth(userId, year, month);
          
          // Update actual amounts in expense budgets
          const updatedExpenseBudgets = oldBudget.expenseBudgets.map(budget => ({
            ...budget.toObject(),
            actualAmount: actualAmounts.expensesBySubCategory[`${budget.categoryId._id}_${budget.subCategoryId._id}`] || 0
          }));
          
          // Calculate totals
          const totalActualExpenses = updatedExpenseBudgets.reduce((sum, budget) => sum + budget.actualAmount, 0);
          
          return {
            ...oldBudget.toObject(),
            expenseBudgets: updatedExpenseBudgets,
            totalActualIncome: actualAmounts.totalActualIncome,
            totalActualExpenses,
            actualBalance: actualAmounts.totalActualIncome - totalActualExpenses
          };
        }
        
        return null;
      }
      
      // Only calculate actual amounts if we have budgets
      const actualAmounts = await this.getActualAmountsForMonth(userId, year, month);
      
      // Find salary budget
      const salaryBudget = incomeBudgets.find(budget => 
        budget.categoryId && budget.categoryId.name === 'Salary'
      );
      
      // Filter other income budgets (excluding salary)
      const otherIncomeBudgets = incomeBudgets.filter(budget => 
        budget.categoryId && budget.categoryId.name !== 'Salary'
      ).map(budget => ({
        categoryId: budget.categoryId,
        amount: budget.amountForMonth
      }));
      
      // Format expense budgets to match old structure
      const formattedExpenseBudgets = expenseBudgets.map(budget => ({
        categoryId: budget.categoryId,
        subCategoryId: budget.subCategoryId,
        budgetedAmount: budget.amountForMonth,
        actualAmount: actualAmounts.expensesBySubCategory[`${budget.categoryId._id}_${budget.subCategoryId._id}`] || 0
      }));
      
      // Calculate totals
      const totalBudgetedIncome = (salaryBudget ? salaryBudget.amountForMonth : 0) + 
        otherIncomeBudgets.reduce((sum, budget) => sum + budget.amount, 0);
      const totalBudgetedExpenses = expenseBudgets.reduce((sum, budget) => sum + budget.amountForMonth, 0);
      const totalActualExpenses = formattedExpenseBudgets.reduce((sum, budget) => sum + budget.actualAmount, 0);
      
      // Return budget structure compatible with existing frontend
      return {
        _id: `generated_${userId}_${year}_${month}`, // Generate a fake ID for compatibility
        userId,
        year,
        month,
        currency: 'ILS',
        salaryBudget: salaryBudget ? salaryBudget.amountForMonth : 0,
        otherIncomeBudgets,
        expenseBudgets: formattedExpenseBudgets,
        totalBudgetedIncome,
        totalBudgetedExpenses,
        totalActualIncome: actualAmounts.totalActualIncome,
        totalActualExpenses,
        budgetBalance: totalBudgetedIncome - totalBudgetedExpenses,
        actualBalance: actualAmounts.totalActualIncome - totalActualExpenses,
        status: BUDGET_STATUS.ACTIVE,
        isAutoCalculated: false
      };
    } catch (error) {
      logger.error('Error fetching monthly budget:', error);
      throw error;
    }
  }

  /**
   * Update monthly budget using CategoryBudget system
   */
  async updateMonthlyBudget(budgetId, updates) {
    try {
      // Extract year, month, userId from the generated ID
      if (budgetId.startsWith('generated_')) {
        const [, userId, year, month] = budgetId.split('_');
        
        // Handle salary budget update
        if (updates.salaryBudget !== undefined) {
          const salaryCategory = await Category.findOne({ userId, name: 'Salary', type: 'Income' });
          if (salaryCategory) {
            let salaryBudget = await CategoryBudget.findOne({ userId, categoryId: salaryCategory._id, subCategoryId: null });
            if (!salaryBudget) {
              salaryBudget = await CategoryBudget.findOrCreate(userId, salaryCategory._id, null);
            }
            salaryBudget.setAmountForMonth(parseInt(month), updates.salaryBudget);
            await salaryBudget.save();
          }
        }
        
        // Handle other income budgets update
        if (updates.otherIncomeBudgets) {
          for (const income of updates.otherIncomeBudgets) {
            let budget = await CategoryBudget.findOne({ 
              userId, 
              categoryId: income.categoryId, 
              subCategoryId: null 
            });
            if (!budget) {
              budget = await CategoryBudget.findOrCreate(userId, income.categoryId, null);
            }
            budget.setAmountForMonth(parseInt(month), income.amount);
            await budget.save();
          }
        }
        
        // Handle expense budgets update
        if (updates.expenseBudgets) {
          for (const expense of updates.expenseBudgets) {
            let budget = await CategoryBudget.findOne({ 
              userId, 
              categoryId: expense.categoryId, 
              subCategoryId: expense.subCategoryId 
            });
            if (!budget) {
              budget = await CategoryBudget.findOrCreate(userId, expense.categoryId, expense.subCategoryId);
            }
            budget.setAmountForMonth(parseInt(month), expense.budgetedAmount);
            await budget.save();
          }
        }
        
        logger.info(`Updated monthly budget via CategoryBudget for user ${userId}: ${month}/${year}`);
        
        // Return updated budget
        return await this.getMonthlyBudget(userId, parseInt(year), parseInt(month));
      } else {
        // Fallback to old MonthlyBudget system if real ID is provided
        const budget = await MonthlyBudget.findById(budgetId);
        if (!budget) {
          throw new Error('Monthly budget not found');
        }

        const allowedUpdates = ['salaryBudget', 'otherIncomeBudgets', 'expenseBudgets', 'notes', 'status'];
        allowedUpdates.forEach(field => {
          if (updates[field] !== undefined) {
            budget[field] = updates[field];
          }
        });

        await budget.save();
        logger.info(`Updated monthly budget: ${budgetId}`);
        
        return budget;
      }
    } catch (error) {
      logger.error('Error updating monthly budget:', error);
      throw error;
    }
  }

  /**
   * Calculate monthly budget from historical transaction data (delegated to budgetCalculationService)
   */
  async calculateMonthlyBudgetFromHistory(userId, year, month, monthsToAnalyze = 6) {
    try {
      // Delegate to budget calculation service
      const calculationResult = await budgetCalculationService.calculateMonthlyBudgetFromHistory(
        userId, year, month, monthsToAnalyze
      );

      // Get the updated monthly budget for the requested month
      const requestedMonthBudget = await this.getMonthlyBudget(userId, year, month);
      
      return {
        ...requestedMonthBudget,
        isAutoCalculated: true,
        monthlyBudgetBreakdown: calculationResult.monthlyBudgetBreakdown,
        patternDetection: calculationResult.patternDetection
      };
    } catch (error) {
      logger.error('Error calculating monthly budget from history:', error);
      throw error;
    }
  }


  // ============================================
  // YEARLY BUDGET OPERATIONS (delegated to yearlyBudgetService)
  // ============================================

  /**
   * Create a new yearly budget
   */
  async createYearlyBudget(userId, year, budgetData) {
    return await yearlyBudgetService.createYearlyBudget(userId, year, budgetData);
  }

  /**
   * Get yearly budget
   */
  async getYearlyBudget(userId, year) {
    return await yearlyBudgetService.getYearlyBudget(userId, year);
  }

  /**
   * Update yearly budget
   */
  async updateYearlyBudget(budgetId, updates) {
    return await yearlyBudgetService.updateYearlyBudget(budgetId, updates);
  }

  // ============================================
  // PROJECT BUDGET OPERATIONS (delegated to projectBudgetService)
  // ============================================

  /**
   * Create a new project budget
   */
  async createProjectBudget(userId, projectData) {
    return await projectBudgetService.createProjectBudget(userId, projectData);
  }

  /**
   * Get project budget details
   */
  async getProjectBudget(projectId) {
    return await projectBudgetService.getProjectBudget(projectId);
  }

  /**
   * Update project budget
   */
  async updateProjectBudget(projectId, updates) {
    return await projectBudgetService.updateProjectBudget(projectId, updates);
  }

  /**
   * Delete project budget
   */
  async deleteProjectBudget(projectId) {
    return await projectBudgetService.deleteProjectBudget(projectId);
  }

  // ============================================
  // BUDGET ANALYSIS & INSIGHTS
  // ============================================

  /**
   * Get budget vs actual analysis
   */
  async getBudgetVsActual(userId, type, period) {
    try {
      let budget;
      
      switch (type) {
        case 'monthly':
          budget = await MonthlyBudget.findOne({
            userId,
            year: period.year,
            month: period.month
          });
          if (budget) {
            await budget.updateActualAmounts();
            return budget.getVarianceAnalysis();
          }
          break;
          
        case 'yearly':
          return await yearlyBudgetService.getYearlyBudgetAnalysis(userId, period.year);
          
        case 'project':
          return await projectBudgetService.getProjectProgress(period.projectId);
          
        default:
          throw new Error('Invalid budget type');
      }
      
      return null;
    } catch (error) {
      logger.error('Error getting budget vs actual analysis:', error);
      throw error;
    }
  }

  /**
   * Get budget summary for a user
   */
  async getBudgetSummary(userId, year, month) {
    try {
      const monthlyBudget = await this.getMonthlyBudget(userId, year, month);
      const yearlyBudget = await this.getYearlyBudget(userId, year);
      const activeProjects = await projectBudgetService.getActiveProjectBudgets(userId);

      return {
        monthly: monthlyBudget ? {
          totalBudgetedIncome: monthlyBudget.totalBudgetedIncome,
          totalBudgetedExpenses: monthlyBudget.totalBudgetedExpenses,
          totalActualExpenses: monthlyBudget.totalActualExpenses,
          budgetBalance: monthlyBudget.budgetBalance,
          actualBalance: monthlyBudget.actualBalance
        } : null,
        yearly: yearlyBudget ? yearlyBudget.getYearlyOverview() : null,
        activeProjects: activeProjects.map(project => ({
          id: project._id,
          name: project.name,
          progress: project.progressPercentage,
          remainingBudget: project.remainingBudget,
          daysRemaining: project.daysRemaining
        }))
      };
    } catch (error) {
      logger.error('Error getting budget summary:', error);
      throw error;
    }
  }

  /**
   * Get project progress (delegated to projectBudgetService)
   */
  async getProjectProgress(projectId) {
    return await projectBudgetService.getProjectProgress(projectId);
  }

  /**
   * Get actual amounts from transactions for a specific month
   */
  async getActualAmountsForMonth(userId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const transactions = await Transaction.find({
        userId,
        processedDate: { $gte: startDate, $lte: endDate },
        category: { $ne: null }
      }).populate('category', 'type').populate('subCategory', 'name');

      let totalActualIncome = 0;
      let totalActualExpenses = 0;
      const expensesBySubCategory = {};

      transactions.forEach(transaction => {
        const amount = Math.abs(transaction.amount);
        
        if (transaction.category && transaction.category.type === 'Income') {
          totalActualIncome += amount;
        } else if (transaction.category && transaction.category.type === 'Expense' && transaction.subCategory) {
          totalActualExpenses += amount;
          const key = `${transaction.category._id}_${transaction.subCategory._id}`;
          expensesBySubCategory[key] = (expensesBySubCategory[key] || 0) + amount;
        }
      });

      return { 
        totalActualIncome, 
        totalActualExpenses,
        expensesBySubCategory
      };
    } catch (error) {
      logger.error('Error getting actual amounts for month:', error);
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get user's budgets for a specific year
   */
  async getUserBudgets(userId, year) {
    try {
      const [monthlyBudgets, yearlyBudget, projectBudgets] = await Promise.all([
        MonthlyBudget.getUserYearBudgets(userId, year),
        yearlyBudgetService.getYearlyBudget(userId, year),
        projectBudgetService.getProjectBudgetsForYear(userId, year)
      ]);

      return {
        monthly: monthlyBudgets,
        yearly: yearlyBudget,
        projects: projectBudgets
      };
    } catch (error) {
      logger.error('Error getting user budgets:', error);
      throw error;
    }
  }

  /**
   * Get budget overview for dashboard
   */
  async getDashboardOverview(userId) {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      const [currentMonthBudget, activeProjects, upcomingProjects] = await Promise.all([
        this.getMonthlyBudget(userId, currentYear, currentMonth),
        projectBudgetService.getActiveProjectBudgets(userId),
        projectBudgetService.getUpcomingProjectBudgets(userId, 30)
      ]);

      return {
        currentMonth: currentMonthBudget,
        activeProjects: activeProjects.length,
        upcomingProjects: upcomingProjects.length,
        totalActiveProjectBudget: activeProjects.reduce((sum, p) => sum + p.totalBudget, 0)
      };
    } catch (error) {
      logger.error('Error getting dashboard overview:', error);
      throw error;
    }
  }


  // ============================================
  // BUDGET EDITING OPERATIONS
  // ============================================

  /**
   * Update category budget with manual edit tracking
   */
  async updateCategoryBudget(userId, categoryId, subCategoryId, budgetData) {
    try {
      // Find or create the category budget
      let budget = await CategoryBudget.findOne({ 
        userId, 
        categoryId, 
        subCategoryId: subCategoryId || null 
      });
      
      if (!budget) {
        budget = await CategoryBudget.findOrCreate(userId, categoryId, subCategoryId);
      }

      const { budgetType, fixedAmount, monthlyAmounts, reason } = budgetData;

      // Handle budget type conversion if needed
      if (budgetType && budgetType !== budget.budgetType) {
        if (budgetType === 'fixed') {
          budget.convertToFixed(fixedAmount);
        } else if (budgetType === 'variable') {
          budget.convertToVariable();
        }
      }

      // Update budget amounts with edit tracking
      if (budgetType === 'fixed' && fixedAmount !== undefined) {
        budget.updateWithEditTracking(fixedAmount, null, reason || 'Manual edit');
      } else if (budgetType === 'variable' && monthlyAmounts) {
        budget.updateMultipleMonths(monthlyAmounts, reason || 'Manual edit');
      }

      await budget.save();
      
      logger.info(`Updated category budget for user ${userId}: category ${categoryId}, subcategory ${subCategoryId}`);
      
      return budget;
    } catch (error) {
      logger.error('Error updating category budget:', error);
      throw error;
    }
  }

  /**
   * Get budget details for editing (includes edit history and smart detection)
   */
  async getBudgetForEditing(userId, categoryId, subCategoryId) {
    try {
      const budget = await CategoryBudget.findOne({ 
        userId, 
        categoryId, 
        subCategoryId: subCategoryId || null 
      })
      .populate('categoryId', 'name type')
      .populate('subCategoryId', 'name');

      if (!budget) {
        // Return a default structure for new budgets
        const category = await Category.findById(categoryId);
        const subCategory = subCategoryId ? await SubCategory.findById(subCategoryId) : null;
        
        return {
          _id: null,
          userId,
          categoryId: category,
          subCategoryId: subCategory,
          budgetType: 'fixed',
          fixedAmount: 0,
          monthlyAmounts: [],
          isManuallyEdited: false,
          isUniformAcrossMonths: true,
          allMonthsData: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 })),
          editHistory: []
        };
      }

      // Add computed properties for the editing interface
      const budgetData = budget.toObject();
      budgetData.isUniformAcrossMonths = budget.isUniformAcrossMonths();
      budgetData.allMonthsData = budget.getAllMonthsData();

      return budgetData;
    } catch (error) {
      logger.error('Error getting budget for editing:', error);
      throw error;
    }
  }

  // ============================================
  // TRANSACTION EXCLUSION OPERATIONS
  // ============================================

  /**
   * Exclude transaction from budget calculation
   */
  async excludeTransactionFromBudget(userId, transactionId, reason) {
    try {
      const transaction = await Transaction.findOne({ _id: transactionId, userId })
        .populate('category')
        .populate('subCategory');

      if (!transaction) {
        throw new Error('Transaction not found or access denied');
      }

      // Mark transaction as excluded
      await transaction.excludeFromBudget(reason, userId);

      // Create exclusion record for audit trail
      await TransactionExclusion.createExclusion(transaction, reason, userId);

      logger.info(`Excluded transaction ${transactionId} from budget calculation for user ${userId}`);

      // Automatically recalculate budget for this category/subcategory
      let recalculationResult = null;
      if (transaction.category && (transaction.category.type === 'Expense' ? transaction.subCategory : true)) {
        try {
          logger.info(`Auto-recalculating budget for category ${transaction.category._id}, subcategory ${transaction.subCategory?._id || 'null'} after exclusion`);
          
          recalculationResult = await this.recalculateBudgetWithExclusions(
            userId,
            transaction.category._id,
            transaction.subCategory?._id || null,
            6 // Default 6 months analysis
          );
          
          logger.info(`Budget recalculated: new amount ${recalculationResult.recalculatedAmount} (was based on ${recalculationResult.transactionCount} transactions)`);
        } catch (recalcError) {
          logger.error('Error auto-recalculating budget after exclusion:', recalcError);
          // Don't fail the exclusion if recalculation fails
        }
      }

      // Return updated transaction with recalculation info
      return {
        transaction,
        budgetRecalculation: recalculationResult
      };
    } catch (error) {
      logger.error('Error excluding transaction from budget:', error);
      throw error;
    }
  }

  /**
   * Include transaction back in budget calculation
   */
  async includeTransactionInBudget(userId, transactionId) {
    try {
      const transaction = await Transaction.findOne({ _id: transactionId, userId })
        .populate('category')
        .populate('subCategory');

      if (!transaction) {
        throw new Error('Transaction not found or access denied');
      }

      // Mark transaction as included
      await transaction.includeInBudget();

      // Deactivate exclusion record
      const exclusion = await TransactionExclusion.findOne({ 
        transactionId, 
        userId, 
        isActive: true 
      });
      
      if (exclusion) {
        await exclusion.remove();
      }

      logger.info(`Included transaction ${transactionId} back in budget calculation for user ${userId}`);

      // Automatically recalculate budget for this category/subcategory
      let recalculationResult = null;
      if (transaction.category && (transaction.category.type === 'Expense' ? transaction.subCategory : true)) {
        try {
          logger.info(`Auto-recalculating budget for category ${transaction.category._id}, subcategory ${transaction.subCategory?._id || 'null'} after inclusion`);
          
          recalculationResult = await this.recalculateBudgetWithExclusions(
            userId,
            transaction.category._id,
            transaction.subCategory?._id || null,
            6 // Default 6 months analysis
          );
          
          logger.info(`Budget recalculated: new amount ${recalculationResult.recalculatedAmount} (was based on ${recalculationResult.transactionCount} transactions)`);
        } catch (recalcError) {
          logger.error('Error auto-recalculating budget after inclusion:', recalcError);
          // Don't fail the inclusion if recalculation fails
        }
      }

      // Return updated transaction with recalculation info
      return {
        transaction,
        budgetRecalculation: recalculationResult
      };
    } catch (error) {
      logger.error('Error including transaction in budget:', error);
      throw error;
    }
  }

  /**
   * Toggle transaction budget exclusion
   */
  async toggleTransactionBudgetExclusion(userId, transactionId, exclude, reason) {
    try {
      if (exclude) {
        return await this.excludeTransactionFromBudget(userId, transactionId, reason);
      } else {
        return await this.includeTransactionInBudget(userId, transactionId);
      }
    } catch (error) {
      logger.error('Error toggling transaction budget exclusion:', error);
      throw error;
    }
  }

  /**
   * Get exclusions for a category/subcategory
   */
  async getExclusionsForCategory(userId, categoryId, subCategoryId, startDate, endDate) {
    try {
      return await TransactionExclusion.getExclusionsForCategory(
        userId, 
        categoryId, 
        subCategoryId, 
        startDate, 
        endDate
      );
    } catch (error) {
      logger.error('Error getting exclusions for category:', error);
      throw error;
    }
  }

  /**
   * Recalculate budget with exclusions for a specific category/subcategory (delegated to budgetCalculationService)
   */
  async recalculateBudgetWithExclusions(userId, categoryId, subCategoryId, monthsToAnalyze = 6) {
    return await budgetCalculationService.recalculateBudgetWithExclusions(
      userId, categoryId, subCategoryId, monthsToAnalyze
    );
  }

  /**
   * Get actual amounts for month excluding marked transactions
   */
  async getActualAmountsForMonthWithExclusions(userId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const transactions = await Transaction.find({
        userId,
        processedDate: { $gte: startDate, $lte: endDate },
        category: { $ne: null },
        excludeFromBudgetCalculation: { $ne: true } // Exclude marked transactions
      }).populate('category', 'type').populate('subCategory', 'name');

      let totalActualIncome = 0;
      let totalActualExpenses = 0;
      const expensesBySubCategory = {};

      transactions.forEach(transaction => {
        const amount = Math.abs(transaction.amount);
        
        if (transaction.category && transaction.category.type === 'Income') {
          totalActualIncome += amount;
        } else if (transaction.category && transaction.category.type === 'Expense' && transaction.subCategory) {
          totalActualExpenses += amount;
          const key = `${transaction.category._id}_${transaction.subCategory._id}`;
          expensesBySubCategory[key] = (expensesBySubCategory[key] || 0) + amount;
        }
      });

      return { 
        totalActualIncome, 
        totalActualExpenses,
        expensesBySubCategory
      };
    } catch (error) {
      logger.error('Error getting actual amounts with exclusions for month:', error);
      throw error;
    }
  }
}

module.exports = new BudgetService();
