const { YearlyBudget } = require('../../shared/models');
const logger = require('../../shared/utils/logger');
const { BUDGET_STATUS } = require('../../shared/constants/statusTypes');

class YearlyBudgetService {
  // ============================================
  // YEARLY BUDGET OPERATIONS
  // ============================================

  /**
   * Create a new yearly budget
   */
  async createYearlyBudget(userId, year, budgetData) {
    try {
      const existingBudget = await YearlyBudget.findOne({ userId, year });
      if (existingBudget) {
        throw new Error(`Yearly budget for ${year} already exists`);
      }

      const budget = new YearlyBudget({
        userId,
        year,
        currency: budgetData.currency || 'ILS',
        totalIncome: budgetData.totalIncome || 0,
        totalExpenses: budgetData.totalExpenses || 0,
        oneTimeIncome: budgetData.oneTimeIncome || [],
        oneTimeExpenses: budgetData.oneTimeExpenses || [],
        projectBudgets: budgetData.projectBudgets || [],
        notes: budgetData.notes || '',
        status: budgetData.status || BUDGET_STATUS.ACTIVE
      });

      await budget.save();
      logger.info(`Created yearly budget for user ${userId}: ${year}`);
      
      return budget;
    } catch (error) {
      logger.error('Error creating yearly budget:', error);
      throw error;
    }
  }

  /**
   * Get yearly budget
   */
  async getYearlyBudget(userId, year) {
    try {
      const budget = await YearlyBudget.findOne({ userId, year })
        .populate('oneTimeIncome.categoryId', 'name type')
        .populate('oneTimeExpenses.categoryId', 'name type')
        .populate('oneTimeExpenses.subCategoryId', 'name')
        .populate('projectBudgets');

      return budget;
    } catch (error) {
      logger.error('Error fetching yearly budget:', error);
      throw error;
    }
  }

  /**
   * Update yearly budget
   */
  async updateYearlyBudget(budgetId, updates) {
    try {
      const budget = await YearlyBudget.findById(budgetId);
      if (!budget) {
        throw new Error('Yearly budget not found');
      }

      const allowedUpdates = ['totalIncome', 'totalExpenses', 'oneTimeIncome', 'oneTimeExpenses', 'notes', 'status'];
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          budget[field] = updates[field];
        }
      });

      await budget.save();
      logger.info(`Updated yearly budget: ${budgetId}`);
      
      return budget;
    } catch (error) {
      logger.error('Error updating yearly budget:', error);
      throw error;
    }
  }

  /**
   * Delete yearly budget
   */
  async deleteYearlyBudget(budgetId) {
    try {
      const budget = await YearlyBudget.findById(budgetId);
      if (!budget) {
        throw new Error('Yearly budget not found');
      }

      await YearlyBudget.findByIdAndDelete(budgetId);
      logger.info(`Deleted yearly budget: ${budgetId}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Error deleting yearly budget:', error);
      throw error;
    }
  }

  /**
   * Get yearly budget analysis
   */
  async getYearlyBudgetAnalysis(userId, year) {
    try {
      const budget = await YearlyBudget.findOne({ userId, year });
      if (!budget) {
        return null;
      }

      return budget.getYearlyOverview();
    } catch (error) {
      logger.error('Error getting yearly budget analysis:', error);
      throw error;
    }
  }

  /**
   * Sync yearly budget with monthly budgets
   */
  async syncWithMonthlyBudgets(userId, year) {
    try {
      const { MonthlyBudget } = require('../../shared/models');
      
      // Get all monthly budgets for the year
      const monthlyBudgets = await MonthlyBudget.find({ userId, year });
      
      // Calculate totals from monthly budgets
      let totalMonthlyIncome = 0;
      let totalMonthlyExpenses = 0;
      
      for (const monthlyBudget of monthlyBudgets) {
        totalMonthlyIncome += monthlyBudget.totalBudgetedIncome || 0;
        totalMonthlyExpenses += monthlyBudget.totalBudgetedExpenses || 0;
      }
      
      // Find or create yearly budget
      let yearlyBudget = await YearlyBudget.findOne({ userId, year });
      if (!yearlyBudget) {
        yearlyBudget = new YearlyBudget({
          userId,
          year,
          currency: 'ILS',
          totalIncome: totalMonthlyIncome,
          totalExpenses: totalMonthlyExpenses
        });
      } else {
        yearlyBudget.totalIncome = totalMonthlyIncome;
        yearlyBudget.totalExpenses = totalMonthlyExpenses;
      }
      
      await yearlyBudget.save();
      logger.info(`Synced yearly budget ${year} with monthly budgets for user ${userId}`);
      
      return yearlyBudget;
    } catch (error) {
      logger.error('Error syncing yearly budget with monthly budgets:', error);
      throw error;
    }
  }

  /**
   * Add one-time income to yearly budget
   */
  async addOneTimeIncome(userId, year, incomeData) {
    try {
      let budget = await YearlyBudget.findOne({ userId, year });
      if (!budget) {
        budget = await this.createYearlyBudget(userId, year, {});
      }

      budget.oneTimeIncome.push({
        categoryId: incomeData.categoryId,
        amount: incomeData.amount,
        description: incomeData.description,
        plannedDate: incomeData.plannedDate,
        status: incomeData.status || 'planned'
      });

      await budget.save();
      logger.info(`Added one-time income to yearly budget ${year} for user ${userId}`);
      
      return budget;
    } catch (error) {
      logger.error('Error adding one-time income:', error);
      throw error;
    }
  }

  /**
   * Add one-time expense to yearly budget
   */
  async addOneTimeExpense(userId, year, expenseData) {
    try {
      let budget = await YearlyBudget.findOne({ userId, year });
      if (!budget) {
        budget = await this.createYearlyBudget(userId, year, {});
      }

      budget.oneTimeExpenses.push({
        categoryId: expenseData.categoryId,
        subCategoryId: expenseData.subCategoryId,
        amount: expenseData.amount,
        description: expenseData.description,
        plannedDate: expenseData.plannedDate,
        status: expenseData.status || 'planned'
      });

      await budget.save();
      logger.info(`Added one-time expense to yearly budget ${year} for user ${userId}`);
      
      return budget;
    } catch (error) {
      logger.error('Error adding one-time expense:', error);
      throw error;
    }
  }

  /**
   * Get upcoming one-time items for a yearly budget
   */
  async getUpcomingItems(userId, year, daysAhead = 30) {
    try {
      const budget = await YearlyBudget.findOne({ userId, year })
        .populate('oneTimeIncome.categoryId', 'name type')
        .populate('oneTimeExpenses.categoryId', 'name type')
        .populate('oneTimeExpenses.subCategoryId', 'name');

      if (!budget) {
        return [];
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

      const upcomingItems = [];

      // Check one-time income
      budget.oneTimeIncome.forEach(income => {
        if (income.plannedDate && 
            income.plannedDate <= cutoffDate && 
            income.status === 'planned') {
          upcomingItems.push({
            type: 'income',
            ...income.toObject()
          });
        }
      });

      // Check one-time expenses
      budget.oneTimeExpenses.forEach(expense => {
        if (expense.plannedDate && 
            expense.plannedDate <= cutoffDate && 
            expense.status === 'planned') {
          upcomingItems.push({
            type: 'expense',
            ...expense.toObject()
          });
        }
      });

      // Sort by planned date
      upcomingItems.sort((a, b) => a.plannedDate - b.plannedDate);

      return upcomingItems;
    } catch (error) {
      logger.error('Error getting upcoming items:', error);
      throw error;
    }
  }

  /**
   * Mark one-time item as completed
   */
  async markOneTimeItemCompleted(userId, year, itemId, type, actualAmount = null) {
    try {
      const budget = await YearlyBudget.findOne({ userId, year });
      if (!budget) {
        throw new Error('Yearly budget not found');
      }

      let item;
      if (type === 'income') {
        item = budget.oneTimeIncome.id(itemId);
      } else if (type === 'expense') {
        item = budget.oneTimeExpenses.id(itemId);
      }

      if (!item) {
        throw new Error('One-time item not found');
      }

      item.status = 'completed';
      item.completedDate = new Date();
      if (actualAmount !== null) {
        item.actualAmount = actualAmount;
      }

      await budget.save();
      logger.info(`Marked one-time ${type} as completed in yearly budget ${year} for user ${userId}`);
      
      return budget;
    } catch (error) {
      logger.error('Error marking one-time item as completed:', error);
      throw error;
    }
  }
}

module.exports = new YearlyBudgetService();
