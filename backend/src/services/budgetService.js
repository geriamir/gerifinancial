const { MonthlyBudget, YearlyBudget, ProjectBudget, CategoryBudget, Transaction, Category, SubCategory, Tag, TransactionPattern } = require('../models');
const logger = require('../utils/logger');
const recurrenceDetectionService = require('./recurrenceDetectionService');
const averagingDenominatorService = require('./averagingDenominatorService');

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
   * Calculate monthly budget from historical transaction data using CategoryBudget system with pattern detection
   */
  async calculateMonthlyBudgetFromHistory(userId, year, month, monthsToAnalyze = 6) {
    try {
      logger.info(`Calculating monthly budget for ${month}/${year} using ${monthsToAnalyze} months of history with pattern detection`);

      // STEP 1: DETECT RECURRENCE PATTERNS
      logger.info('Step 1: Detecting recurrence patterns...');
      const detectedPatterns = await recurrenceDetectionService.detectPatterns(userId, monthsToAnalyze);
      
      // Store detected patterns in database
      const savedPatterns = await recurrenceDetectionService.storeDetectedPatterns(detectedPatterns);
      logger.info(`Detected and stored ${savedPatterns.length} transaction patterns`);

      // STEP 2: GET TRANSACTION DATA
      logger.info('Step 2: Analyzing remaining transactions...');
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

      // STEP 3: SEPARATE PATTERNED AND NON-PATTERNED TRANSACTIONS
      const patternedTransactionIds = new Set();
      const nonPatternedTransactions = [];

      // Mark transactions that match detected patterns (both saved and newly detected)
      for (const transaction of transactions) {
        let isPatternedTransaction = false;
        
        // Check against saved patterns (with proper DB methods)
        for (const pattern of savedPatterns) {
          if (pattern.matchesTransaction && pattern.matchesTransaction(transaction)) {
            patternedTransactionIds.add(transaction._id.toString());
            isPatternedTransaction = true;
            logger.info(`Transaction ${transaction._id} matches saved pattern ${pattern.patternId}`);
            break;
          }
        }
        
        // Also check against newly detected patterns (using simple matching logic)
        if (!isPatternedTransaction) {
          for (const detectedPattern of detectedPatterns) {
            if (this.matchesDetectedPattern(transaction, detectedPattern)) {
              patternedTransactionIds.add(transaction._id.toString());
              isPatternedTransaction = true;
              logger.info(`Transaction ${transaction._id} matches newly detected pattern ${detectedPattern.patternId}`);
              break;
            }
          }
        }
        
        if (!isPatternedTransaction) {
          nonPatternedTransactions.push(transaction);
        }
      }

      logger.info(`Found ${patternedTransactionIds.size} patterned transactions, ${nonPatternedTransactions.length} non-patterned transactions`);

      // STEP 4: CALCULATE SMART AVERAGES FOR NON-PATTERNED TRANSACTIONS
      const expensesBySubCategory = {};
      const incomeByCategory = {};

      // Track which months have any transaction data
      const monthsWithData = new Set();

      for (const transaction of nonPatternedTransactions) {
        const amount = Math.abs(transaction.amount);
        const transactionMonth = transaction.processedDate.getMonth() + 1;
        monthsWithData.add(transactionMonth);
        
        if (transaction.category?.type === 'Expense' && transaction.subCategory) {
          const key = `${transaction.category._id}_${transaction.subCategory._id}`;
          if (!expensesBySubCategory[key]) {
            expensesBySubCategory[key] = {
              categoryId: transaction.category._id,
              subCategoryId: transaction.subCategory._id,
              categoryName: transaction.category.name,
              subCategoryName: transaction.subCategory.name,
              total: 0,
              count: 0,
              monthsPresent: new Set()
            };
          }
          expensesBySubCategory[key].total += amount;
          expensesBySubCategory[key].count += 1;
          expensesBySubCategory[key].monthsPresent.add(transactionMonth);
        } else if (transaction.category?.type === 'Income') {
          const key = transaction.category._id.toString();
          if (!incomeByCategory[key]) {
            incomeByCategory[key] = {
              categoryId: transaction.category._id,
              categoryName: transaction.category.name,
              total: 0,
              count: 0,
              monthsPresent: new Set()
            };
          }
          incomeByCategory[key].total += amount;
          incomeByCategory[key].count += 1;
          incomeByCategory[key].monthsPresent.add(transactionMonth);
        }
      }

      // Calculate effective months for averaging
      const totalMonthsWithAnyData = monthsWithData.size;
      logger.info(`Found transaction data in ${totalMonthsWithAnyData} out of ${monthsToAnalyze} analysis months`);

      // STEP 5: UPDATE BUDGETS WITH SMART PATTERN-AWARE AVERAGING
      let updatedBudgets = 0;

      // Update income budgets with smart averaging using AveragingDenominatorService
      for (const income of Object.values(incomeByCategory)) {
        const strategy = averagingDenominatorService.getAveragingStrategy(
          income.monthsPresent, 
          monthsWithData, 
          monthsToAnalyze
        );
        const avgAmount = Math.round(income.total / strategy.denominator);
        
        logger.info(`Income smart averaging for ${income.categoryName}: ₪${income.total} total / ${strategy.denominator} months = ₪${avgAmount}`);
        logger.info(`Strategy: ${strategy.reasoning}`);
        
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

      // Update expense budgets with smart averaging using AveragingDenominatorService
      for (const expense of Object.values(expensesBySubCategory)) {
        const strategy = averagingDenominatorService.getAveragingStrategy(
          expense.monthsPresent, 
          monthsWithData, 
          monthsToAnalyze
        );
        const avgAmount = Math.round(expense.total / strategy.denominator);
        
        logger.info(`Expense smart averaging for ${expense.categoryName}→${expense.subCategoryName}: ₪${expense.total} total / ${strategy.denominator} months = ₪${avgAmount}`);
        logger.info(`  Category months present: [${Array.from(expense.monthsPresent).sort((a,b) => a-b).join(', ')}]`);
        logger.info(`  All data months: [${Array.from(monthsWithData).sort((a,b) => a-b).join(', ')}]`);
        logger.info(`  Requested analysis months: ${monthsToAnalyze}`);
        logger.info(`Strategy: ${strategy.reasoning}`);
        
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

      // STEP 6: ADD PATTERN-BASED BUDGETS TO EXISTING AMOUNTS
      // Get all approved patterns and check if they apply to this month using smart logic
      const allApprovedPatterns = await TransactionPattern.getActivePatterns(userId);
      const patternsForMonth = allApprovedPatterns.filter(pattern => 
        this.shouldPatternOccurInMonth(pattern, month)
      );
      
      logger.info(`Found ${patternsForMonth.length} patterns that apply to month ${month} using smart logic`);

      for (const pattern of patternsForMonth) {
        const patternAmount = pattern.averageAmount;
        
        if (patternAmount > 0) {
          let budget = await CategoryBudget.findOne({ 
            userId, 
            categoryId: pattern.transactionIdentifier.categoryId, 
            subCategoryId: pattern.transactionIdentifier.subCategoryId 
          });
          
          if (!budget) {
            budget = await CategoryBudget.findOrCreate(
              userId, 
              pattern.transactionIdentifier.categoryId, 
              pattern.transactionIdentifier.subCategoryId
            );
          }
          
          // Get existing amount for this month and ADD the pattern amount
          const existingAmount = budget.getAmountForMonth(month);
          const totalAmount = existingAmount + patternAmount;
          
          budget.setAmountForMonth(month, totalAmount);
          await budget.save();
          updatedBudgets++;
          
          logger.info(`Added pattern-based budget for ${pattern.displayName}: ₪${existingAmount} + ₪${patternAmount} = ₪${totalAmount} for month ${month}`);
        }
      }

      logger.info(`Auto-calculated monthly budget: Updated ${updatedBudgets} category budgets for month ${month}`);
      logger.info(`Pattern detection summary: ${savedPatterns.length} patterns detected, ${patternsForMonth.length} apply to month ${month}`);
      
      // Return enhanced budget structure with pattern information
      const budget = await this.getMonthlyBudget(userId, year, month);
      
      return {
        ...budget,
        isAutoCalculated: true,
        patternDetection: {
          totalPatternsDetected: savedPatterns.length,
          patternsForThisMonth: patternsForMonth.length,
          requiresApproval: savedPatterns.filter(p => p.approvalStatus === 'pending').length > 0,
          pendingPatterns: savedPatterns.filter(p => p.approvalStatus === 'pending').map(p => ({
            id: p._id,
            patternId: p.patternId,
            description: p.transactionIdentifier.description,
            amount: p.averageAmount,
            category: p.transactionIdentifier.categoryId?.name || 'Unknown',
            subcategory: p.transactionIdentifier.subCategoryId?.name || 'General',
            patternType: p.recurrencePattern,
            confidence: p.detectionData.confidence,
            scheduledMonths: p.scheduledMonths,
            sampleTransactions: p.detectionData.sampleTransactions
          }))
        }
      };
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

  // ============================================
  // PATTERN MATCHING METHODS (shared with SmartBudgetService)
  // ============================================

  /**
   * Determine if a pattern should occur in a specific month with future projections
   */
  shouldPatternOccurInMonth(pattern, targetMonth) {
    const { recurrencePattern, scheduledMonths } = pattern;

    // Always check if explicitly scheduled for this month first
    if (scheduledMonths && scheduledMonths.includes(targetMonth)) {
      logger.info(`Pattern ${pattern.patternId} explicitly scheduled for month ${targetMonth}`);
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
      case 'monthly':
        // Every month - monthly patterns should occur in every month
        logger.info(`Monthly pattern ${pattern.patternId}: occurs every month, including month ${targetMonth}`);
        return true;
        
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
        logger.info(`Yearly pattern ${pattern.patternId}: month ${targetMonth} ${matches ? 'matches' : 'does not match'} scheduled months`);
        return matches;
        
      default:
        logger.info(`Unknown recurrence pattern: ${recurrencePattern}`);
        return false;
    }
  }

  /**
   * Check if target month matches bi-monthly pattern (improved logic)
   */
  isBiMonthlyMatch(scheduledMonths, targetMonth) {
    // For bi-monthly patterns, check if the target month follows the pattern
    // from any of the scheduled base months
    for (const baseMonth of scheduledMonths) {
      // Check if targetMonth is baseMonth + 0, 2, 4, 6, 8, 10 months
      const monthDiff = (targetMonth - baseMonth + 12) % 12;
      if (monthDiff % 2 === 0) {
        logger.info(`Bi-monthly pattern match: month ${targetMonth} is ${monthDiff} months from base month ${baseMonth}`);
        return true;
      }
    }
    
    logger.info(`No bi-monthly pattern match for month ${targetMonth} from scheduled months [${scheduledMonths.join(', ')}]`);
    return false;
  }

  /**
   * Check if target month matches quarterly pattern (improved logic)
   */
  isQuarterlyMatch(scheduledMonths, targetMonth) {
    // For quarterly patterns, check if the target month follows the pattern
    // from any of the scheduled base months
    for (const baseMonth of scheduledMonths) {
      // Check if targetMonth is baseMonth + 0, 3, 6, 9 months
      const monthDiff = (targetMonth - baseMonth + 12) % 12;
      if (monthDiff % 3 === 0) {
        logger.info(`Quarterly pattern match: month ${targetMonth} is ${monthDiff} months from base month ${baseMonth}`);
        return true;
      }
    }
    
    logger.info(`No quarterly pattern match for month ${targetMonth} from scheduled months [${scheduledMonths.join(', ')}]`);
    return false;
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
}

module.exports = new BudgetService();
