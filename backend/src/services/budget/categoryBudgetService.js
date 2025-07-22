const { CategoryBudget, Category, SubCategory, Transaction } = require('../models');
const logger = require('../utils/logger');

class CategoryBudgetService {
  
  // ============================================
  // CATEGORY BUDGET OPERATIONS
  // ============================================

  /**
   * Create or update category budget
   */
  async createOrUpdateCategoryBudget(userId, categoryId, subCategoryId, budgetData) {
    try {
      let budget = await CategoryBudget.findOne({
        userId,
        categoryId,
        subCategoryId: subCategoryId || null
      });

      if (budget) {
        // Update existing budget
        Object.assign(budget, budgetData);
        await budget.save();
        logger.info(`Updated category budget for user ${userId}, category ${categoryId}`);
      } else {
        // Create new budget
        budget = new CategoryBudget({
          userId,
          categoryId,
          subCategoryId: subCategoryId || null,
          ...budgetData
        });
        await budget.save();
        logger.info(`Created category budget for user ${userId}, category ${categoryId}`);
      }

      return budget;
    } catch (error) {
      logger.error('Error creating/updating category budget:', error);
      throw error;
    }
  }

  /**
   * Get category budget by ID
   */
  async getCategoryBudget(budgetId) {
    try {
      const budget = await CategoryBudget.findById(budgetId)
        .populate('categoryId', 'name type')
        .populate('subCategoryId', 'name');

      if (!budget) {
        throw new Error('Category budget not found');
      }

      return budget;
    } catch (error) {
      logger.error('Error fetching category budget:', error);
      throw error;
    }
  }

  /**
   * Get all category budgets for a user
   */
  async getUserCategoryBudgets(userId, filters = {}) {
    try {
      return await CategoryBudget.getUserBudgets(userId, filters);
    } catch (error) {
      logger.error('Error fetching user category budgets:', error);
      throw error;
    }
  }

  /**
   * Get income budgets for a user and specific month
   */
  async getIncomeBudgets(userId, month = null) {
    try {
      return await CategoryBudget.getIncomeBudgets(userId, month);
    } catch (error) {
      logger.error('Error fetching income budgets:', error);
      throw error;
    }
  }

  /**
   * Get expense budgets for a user and specific month
   */
  async getExpenseBudgets(userId, month = null) {
    try {
      return await CategoryBudget.getExpenseBudgets(userId, month);
    } catch (error) {
      logger.error('Error fetching expense budgets:', error);
      throw error;
    }
  }

  /**
   * Get budgets for a specific month
   */
  async getBudgetsForMonth(userId, month) {
    try {
      return await CategoryBudget.getBudgetsForMonth(userId, month);
    } catch (error) {
      logger.error('Error fetching budgets for month:', error);
      throw error;
    }
  }

  /**
   * Update budget amount for a specific month
   */
  async updateBudgetAmount(userId, categoryId, subCategoryId, month, amount) {
    try {
      let budget = await CategoryBudget.findOne({
        userId,
        categoryId,
        subCategoryId: subCategoryId || null
      });

      if (!budget) {
        // Create new budget if it doesn't exist
        budget = await CategoryBudget.findOrCreate(userId, categoryId, subCategoryId);
      }

      // Set the amount for the specific month
      budget.setAmountForMonth(month, amount);
      await budget.save();

      logger.info(`Updated budget amount for user ${userId}, category ${categoryId}, month ${month}: ${amount}`);
      return budget;
    } catch (error) {
      logger.error('Error updating budget amount:', error);
      throw error;
    }
  }

  /**
   * Convert budget type (fixed to variable or vice versa)
   */
  async convertBudgetType(budgetId, newType, options = {}) {
    try {
      const budget = await CategoryBudget.findById(budgetId);
      if (!budget) {
        throw new Error('Category budget not found');
      }

      if (newType === 'variable' && budget.budgetType === 'fixed') {
        budget.convertToVariable();
        
        // Optionally populate all months with the fixed amount
        if (options.populateAllMonths && budget.fixedAmount > 0) {
          budget.populateAllMonths(budget.fixedAmount);
        }
      } else if (newType === 'fixed' && budget.budgetType === 'variable') {
        budget.convertToFixed(options.fixedAmount);
      }

      await budget.save();
      logger.info(`Converted budget ${budgetId} to ${newType} type`);
      return budget;
    } catch (error) {
      logger.error('Error converting budget type:', error);
      throw error;
    }
  }

  /**
   * Delete category budget
   */
  async deleteCategoryBudget(budgetId) {
    try {
      const budget = await CategoryBudget.findById(budgetId);
      if (!budget) {
        throw new Error('Category budget not found');
      }

      await CategoryBudget.findByIdAndDelete(budgetId);
      logger.info(`Deleted category budget: ${budgetId}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Error deleting category budget:', error);
      throw error;
    }
  }

  // ============================================
  // BUDGET SUMMARY & ANALYSIS
  // ============================================

  /**
   * Get budget summary for a specific month
   */
  async getMonthlyBudgetSummary(userId, year, month) {
    try {
      const [incomeBudgets, expenseBudgets] = await Promise.all([
        this.getIncomeBudgets(userId, month),
        this.getExpenseBudgets(userId, month)
      ]);

      // Calculate totals
      const totalBudgetedIncome = incomeBudgets.reduce((sum, budget) => sum + budget.amountForMonth, 0);
      const totalBudgetedExpenses = expenseBudgets.reduce((sum, budget) => sum + budget.amountForMonth, 0);

      // Get actual amounts from transactions
      const actualAmounts = await this.getActualAmountsForMonth(userId, year, month);

      return {
        income: {
          budgets: incomeBudgets,
          totalBudgeted: totalBudgetedIncome,
          totalActual: actualAmounts.totalActualIncome
        },
        expenses: {
          budgets: expenseBudgets,
          totalBudgeted: totalBudgetedExpenses,
          totalActual: actualAmounts.totalActualExpenses
        },
        summary: {
          budgetBalance: totalBudgetedIncome - totalBudgetedExpenses,
          actualBalance: actualAmounts.totalActualIncome - actualAmounts.totalActualExpenses
        }
      };
    } catch (error) {
      logger.error('Error getting monthly budget summary:', error);
      throw error;
    }
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

      transactions.forEach(transaction => {
        const amount = Math.abs(transaction.amount);
        
        if (transaction.category && transaction.category.type === 'Income') {
          totalActualIncome += amount;
        } else if (transaction.category && transaction.category.type === 'Expense') {
          totalActualExpenses += amount;
        }
      });

      return { totalActualIncome, totalActualExpenses };
    } catch (error) {
      logger.error('Error getting actual amounts for month:', error);
      throw error;
    }
  }

  /**
   * Get budget vs actual comparison for a category/subcategory
   */
  async getBudgetVsActual(userId, categoryId, subCategoryId, year, month) {
    try {
      const budget = await CategoryBudget.findOne({
        userId,
        categoryId,
        subCategoryId: subCategoryId || null
      }).populate('categoryId', 'name type').populate('subCategoryId', 'name');

      if (!budget) {
        return {
          budgeted: 0,
          actual: 0,
          variance: 0,
          categoryName: 'Unknown',
          subCategoryName: subCategoryId ? 'Unknown' : null
        };
      }

      const budgetedAmount = budget.getAmountForMonth(month);

      // Get actual amount from transactions
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const actualResult = await Transaction.aggregate([
        {
          $match: {
            userId,
            processedDate: { $gte: startDate, $lte: endDate },
            category: categoryId,
            ...(subCategoryId && { subCategory: subCategoryId })
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $abs: '$amount' } }
          }
        }
      ]);

      const actualAmount = actualResult.length > 0 ? actualResult[0].total : 0;
      const variance = actualAmount - budgetedAmount;

      return {
        budgeted: budgetedAmount,
        actual: actualAmount,
        variance,
        variancePercentage: budgetedAmount > 0 ? (variance / budgetedAmount) * 100 : 0,
        categoryName: budget.categoryId?.name || 'Unknown',
        subCategoryName: budget.subCategoryId?.name || null
      };
    } catch (error) {
      logger.error('Error getting budget vs actual:', error);
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Initialize default budgets for a new user based on their categories
   */
  async initializeUserBudgets(userId) {
    try {
      // Get all categories for the user
      const categories = await Category.find({ userId }).populate('subCategories');

      const budgets = [];

      for (const category of categories) {
        if (category.type === 'Income') {
          // Create income budget (no subcategory)
          const budget = await CategoryBudget.findOrCreate(userId, category._id, null);
          budgets.push(budget);
        } else if (category.type === 'Expense' && category.subCategories) {
          // Create expense budgets for each subcategory
          for (const subCategory of category.subCategories) {
            const budget = await CategoryBudget.findOrCreate(userId, category._id, subCategory._id);
            budgets.push(budget);
          }
        }
      }

      logger.info(`Initialized ${budgets.length} category budgets for user ${userId}`);
      return budgets;
    } catch (error) {
      logger.error('Error initializing user budgets:', error);
      throw error;
    }
  }

  /**
   * Get budget overview for dashboard
   */
  async getDashboardOverview(userId) {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      const summary = await this.getMonthlyBudgetSummary(userId, currentYear, currentMonth);

      return {
        currentMonth: {
          month: currentMonth,
          year: currentYear,
          totalBudgetedIncome: summary.income.totalBudgeted,
          totalBudgetedExpenses: summary.expenses.totalBudgeted,
          totalActualIncome: summary.income.totalActual,
          totalActualExpenses: summary.expenses.totalActual,
          budgetBalance: summary.summary.budgetBalance,
          actualBalance: summary.summary.actualBalance
        }
      };
    } catch (error) {
      logger.error('Error getting dashboard overview:', error);
      throw error;
    }
  }
}

module.exports = new CategoryBudgetService();
