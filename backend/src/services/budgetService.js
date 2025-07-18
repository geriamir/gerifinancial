const { MonthlyBudget, YearlyBudget, ProjectBudget, CategoryBudget, Transaction, Category, SubCategory, Tag } = require('../models');
const logger = require('../utils/logger');

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
        status: budgetData.status || 'active'
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
   * Get monthly budget for a specific month using CategoryBudget system
   */
  async getMonthlyBudget(userId, year, month) {
    try {
      // Get income budgets for the month
      const incomeBudgets = await CategoryBudget.getIncomeBudgets(userId, month);
      
      // Get expense budgets for the month
      const expenseBudgets = await CategoryBudget.getExpenseBudgets(userId, month);
      
      // Check if any budgets exist - if not, return null like the old system
      if (incomeBudgets.length === 0 && expenseBudgets.length === 0) {
        logger.info(`No category budgets found for user ${userId} for month ${month}`);
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
        status: 'active',
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
   * Calculate monthly budget from historical transaction data using CategoryBudget system
   */
  async calculateMonthlyBudgetFromHistory(userId, year, month, monthsToAnalyze = 6) {
    try {
      logger.info(`Calculating monthly budget for ${month}/${year} using ${monthsToAnalyze} months of history`);

      // Calculate date range for analysis
      const endDate = new Date(year, month - 1, 0); // Last day of previous month
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - monthsToAnalyze);

      // Get all transactions in the analysis period
      const transactions = await Transaction.find({
        userId,
        processedDate: { $gte: startDate, $lte: endDate },
        category: { $ne: null }
      })
      .populate('category', 'name type')
      .populate('subCategory', 'name');

      logger.info(`Found ${transactions.length} transactions for analysis`);

      // Group transactions by type and calculate averages
      const expensesBySubCategory = {};
      const incomeByCategory = {};

      for (const transaction of transactions) {
        const amount = Math.abs(transaction.amount);
        
        if (transaction.category.type === 'Expense' && transaction.subCategory) {
          const key = `${transaction.category._id}_${transaction.subCategory._id}`;
          if (!expensesBySubCategory[key]) {
            expensesBySubCategory[key] = {
              categoryId: transaction.category._id,
              subCategoryId: transaction.subCategory._id,
              categoryName: transaction.category.name,
              subCategoryName: transaction.subCategory.name,
              total: 0,
              count: 0
            };
          }
          expensesBySubCategory[key].total += amount;
          expensesBySubCategory[key].count += 1;
        } else if (transaction.category.type === 'Income') {
          const key = transaction.category._id.toString();
          if (!incomeByCategory[key]) {
            incomeByCategory[key] = {
              categoryId: transaction.category._id,
              categoryName: transaction.category.name,
              total: 0,
              count: 0
            };
          }
          incomeByCategory[key].total += amount;
          incomeByCategory[key].count += 1;
        }
      }

      // Update CategoryBudgets with calculated amounts
      let updatedBudgets = 0;

      // Update income budgets
      for (const income of Object.values(incomeByCategory)) {
        const avgAmount = Math.round(income.total / monthsToAnalyze);
        let budget = await CategoryBudget.findOne({ 
          userId, 
          categoryId: income.categoryId, 
          subCategoryId: null 
        });
        
        if (!budget) {
          budget = await CategoryBudget.findOrCreate(userId, income.categoryId, null);
        }
        
        budget.setAmountForMonth(month, avgAmount);
        await budget.save();
        updatedBudgets++;
      }

      // Update expense budgets
      for (const expense of Object.values(expensesBySubCategory)) {
        const avgAmount = Math.round(expense.total / monthsToAnalyze);
        let budget = await CategoryBudget.findOne({ 
          userId, 
          categoryId: expense.categoryId, 
          subCategoryId: expense.subCategoryId 
        });
        
        if (!budget) {
          budget = await CategoryBudget.findOrCreate(userId, expense.categoryId, expense.subCategoryId);
        }
        
        budget.setAmountForMonth(month, avgAmount);
        await budget.save();
        updatedBudgets++;
      }

      logger.info(`Auto-calculated monthly budget: Updated ${updatedBudgets} category budgets for month ${month}`);
      
      // Return the updated budget using the new system
      return await this.getMonthlyBudget(userId, year, month);
    } catch (error) {
      logger.error('Error calculating monthly budget from history:', error);
      throw error;
    }
  }

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
        status: budgetData.status || 'active'
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

  // ============================================
  // PROJECT BUDGET OPERATIONS
  // ============================================

  /**
   * Create a new project budget
   */
  async createProjectBudget(userId, projectData) {
    try {
      const project = new ProjectBudget({
        userId,
        name: projectData.name,
        description: projectData.description || '',
        startDate: projectData.startDate,
        endDate: projectData.endDate,
        fundingSources: projectData.fundingSources || [],
        categoryBudgets: projectData.categoryBudgets || [],
        currency: projectData.currency || 'ILS',
        priority: projectData.priority || 'medium',
        notes: projectData.notes || ''
      });

      await project.save();

      // Create project tag
      await project.createProjectTag();

      logger.info(`Created project budget for user ${userId}: ${projectData.name}`);
      return project;
    } catch (error) {
      logger.error('Error creating project budget:', error);
      throw error;
    }
  }

  /**
   * Get project budget details
   */
  async getProjectBudget(projectId) {
    try {
      const project = await ProjectBudget.findById(projectId)
        .populate('projectTag', 'name')
        .populate('categoryBudgets.categoryId', 'name type')
        .populate('categoryBudgets.subCategoryId', 'name');

      if (!project) {
        throw new Error('Project budget not found');
      }

      return project;
    } catch (error) {
      logger.error('Error fetching project budget:', error);
      throw error;
    }
  }

  /**
   * Update project budget
   */
  async updateProjectBudget(projectId, updates) {
    try {
      const project = await ProjectBudget.findById(projectId);
      if (!project) {
        throw new Error('Project budget not found');
      }

      const allowedUpdates = ['name', 'description', 'endDate', 'status', 'fundingSources', 'categoryBudgets', 'priority', 'notes'];
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          project[field] = updates[field];
        }
      });

      await project.save();
      logger.info(`Updated project budget: ${projectId}`);
      
      return project;
    } catch (error) {
      logger.error('Error updating project budget:', error);
      throw error;
    }
  }

  /**
   * Delete project budget
   */
  async deleteProjectBudget(projectId) {
    try {
      const project = await ProjectBudget.findById(projectId);
      if (!project) {
        throw new Error('Project budget not found');
      }

      // Remove project tag if it exists
      if (project.projectTag) {
        await Tag.findByIdAndDelete(project.projectTag);
      }

      await ProjectBudget.findByIdAndDelete(projectId);
      logger.info(`Deleted project budget: ${projectId}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Error deleting project budget:', error);
      throw error;
    }
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
          budget = await YearlyBudget.findOne({
            userId,
            year: period.year
          });
          if (budget) {
            return budget.getYearlyOverview();
          }
          break;
          
        case 'project':
          budget = await ProjectBudget.findById(period.projectId);
          if (budget && budget.userId.toString() === userId.toString()) {
            await budget.updateActualAmounts();
            return budget.getProjectOverview();
          }
          break;
          
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
      const activeProjects = await ProjectBudget.findActive(userId);

      // Monthly budget already has actual amounts calculated in getMonthlyBudget()
      // No need to call updateActualAmounts() since it's a plain object

      for (const project of activeProjects) {
        await project.updateActualAmounts();
      }

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
   * Get project progress
   */
  async getProjectProgress(projectId) {
    try {
      const project = await ProjectBudget.findById(projectId)
        .populate('categoryBudgets.categoryId', 'name')
        .populate('categoryBudgets.subCategoryId', 'name');

      if (!project) {
        throw new Error('Project not found');
      }

      await project.updateActualAmounts();
      return project.getProjectOverview();
    } catch (error) {
      logger.error('Error getting project progress:', error);
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
        YearlyBudget.findOne({ userId, year }),
        ProjectBudget.find({ 
          userId, 
          $or: [
            { startDate: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) } },
            { endDate: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) } }
          ]
        })
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
        ProjectBudget.findActive(userId),
        ProjectBudget.findUpcoming(userId, 30)
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
}

module.exports = new BudgetService();
