const { Transaction, TransactionType } = require('../../banking');
const { ProjectBudget } = require('../models');
const { currencyExchangeService } = require('../../foreign-currency');
const logger = require('../../shared/utils/logger');

class ProjectExpensesService {
  // ============================================
  // PROJECT EXPENSE OPERATIONS
  // ============================================

  /**
   * Move an unplanned expense to a planned category within a project
   * @param {string} projectId - The project budget ID
   * @param {string} transactionId - The transaction ID to move
   * @param {string} targetCategoryId - Target category ID
   * @param {string} targetSubCategoryId - Target subcategory ID
   * @returns {Object} Result containing transaction, converted amount, and target budget
   */
  async moveExpenseToPlanned(projectId, transactionId, targetCategoryId, targetSubCategoryId) {
    try {
      // Get the project budget
      const project = await ProjectBudget.findById(projectId)
        .populate('categoryBudgets.categoryId', 'name')
        .populate('categoryBudgets.subCategoryId', 'name');

      if (!project) {
        throw new Error('Project budget not found');
      }

      // Get the transaction
      const transaction = await Transaction.findOne({
        _id: transactionId,
        userId: project.userId,
        tags: project.projectTag
      });

      if (!transaction) {
        throw new Error('Transaction not found or not associated with this project');
      }

      // Find the target category budget
      const targetBudget = project.categoryBudgets.find(budget => {
        const budgetCategoryId = budget.categoryId._id || budget.categoryId;
        const budgetSubCategoryId = budget.subCategoryId._id || budget.subCategoryId;
        return budgetCategoryId.toString() === targetCategoryId.toString() &&
               budgetSubCategoryId.toString() === targetSubCategoryId.toString();
      });

      if (!targetBudget) {
        throw new Error('Target category budget not found in project');
      }

      // Convert transaction amount to project currency if needed
      let convertedAmount = Math.abs(transaction.amount);
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

          if (conversionResult.fallback) {
            logger.info(`Used fallback rate for transaction ${transaction._id}: ${conversionResult.source} (${conversionResult.daysDifference} days difference)`);
          }
        } catch (error) {
          logger.warn(`Currency conversion failed for transaction ${transaction._id}:`, error.message);
        }
      }

      // Update the transaction's category/subcategory to match the target
      transaction.category = targetCategoryId;
      transaction.subCategory = targetSubCategoryId;
      
      // Ensure rawData exists for validation
      if (!transaction.rawData) {
        transaction.rawData = {};
      }
      
      await transaction.save();

      // Add transaction to the allocated transactions list if not already there
      if (!targetBudget.allocatedTransactions.includes(transactionId)) {
        targetBudget.allocatedTransactions.push(transactionId);
      }
      await project.save();

      logger.info(`Moved expense ${transactionId} to planned category ${targetCategoryId}/${targetSubCategoryId} in project ${projectId}`);

      return {
        transaction: transaction,
        convertedAmount: convertedAmount,
        targetBudget: targetBudget
      };
    } catch (error) {
      logger.error('Error moving expense to planned category:', error);
      throw error;
    }
  }

  /**
   * Move installment group to planned category
   * @param {string} projectId - The project budget ID
   * @param {string} groupIdentifier - The installment group identifier
   * @param {string} targetCategoryId - Target category ID
   * @param {string} targetSubCategoryId - Target subcategory ID
   * @returns {Object} Result containing affected transactions and totals
   */
  async moveInstallmentGroupToPlanned(projectId, groupIdentifier, targetCategoryId, targetSubCategoryId) {
    try {
      // Parse the installment group ID
      const groupIdMatch = groupIdentifier.match(/^installment-group-(.+?)--([0-9.-]+)$/);
      if (!groupIdMatch) {
        throw new Error('Invalid installment group identifier format');
      }

      const [, cleanIdentifier, originalAmount] = groupIdMatch;

      // Get the project budget
      const project = await ProjectBudget.findById(projectId)
        .populate('categoryBudgets.categoryId', 'name')
        .populate('categoryBudgets.subCategoryId', 'name');

      if (!project) {
        throw new Error('Project budget not found');
      }

      // Find the target category budget
      const targetBudget = project.categoryBudgets.find(budget => {
        const budgetCategoryId = budget.categoryId._id || budget.categoryId;
        const budgetSubCategoryId = budget.subCategoryId._id || budget.subCategoryId;
        return budgetCategoryId.toString() === targetCategoryId.toString() &&
               budgetSubCategoryId.toString() === targetSubCategoryId.toString();
      });

      if (!targetBudget) {
        throw new Error('Target category budget not found in project');
      }

      // Find all transactions in the installment group
      const transactions = await Transaction.find({
        userId: project.userId,
        tags: project.projectTag,
        identifier: { $regex: `^${cleanIdentifier}-*$` }
      });

      if (transactions.length === 0) {
        throw new Error('No installment transactions found for this group');
      }

      let totalConvertedAmount = 0;
      const updatedTransactions = [];

      // Process each transaction in the group
      for (const transaction of transactions) {
        // Convert transaction amount to project currency if needed
        let convertedAmount = Math.abs(transaction.amount);
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

            if (conversionResult.fallback) {
              logger.info(`Used fallback rate for transaction ${transaction._id}: ${conversionResult.source} (${conversionResult.daysDifference} days difference)`);
            }
          } catch (error) {
            logger.warn(`Currency conversion failed for transaction ${transaction._id}:`, error.message);
          }
        }

        // Update the transaction's category/subcategory
        transaction.category = targetCategoryId;
        transaction.subCategory = targetSubCategoryId;
        
        // Ensure rawData exists for validation
        if (!transaction.rawData) {
          transaction.rawData = {};
        }
        
        await transaction.save();

        // Add transaction to the allocated transactions list if not already there
        if (!targetBudget.allocatedTransactions.includes(transaction._id)) {
          targetBudget.allocatedTransactions.push(transaction._id);
        }

        totalConvertedAmount += convertedAmount;
        updatedTransactions.push(transaction);
      }

      await project.save();

      logger.info(`Moved installment group ${groupIdentifier} (${transactions.length} transactions) to planned category ${targetCategoryId}/${targetSubCategoryId} in project ${projectId}`);

      return {
        transactions: updatedTransactions,
        totalConvertedAmount: totalConvertedAmount,
        targetBudget: targetBudget,
        transactionCount: transactions.length
      };
    } catch (error) {
      logger.error('Error moving installment group to planned category:', error);
      throw error;
    }
  }

  /**
   * Add transaction as unplanned expense (tag to project)
   * @param {string} projectId - The project budget ID
   * @param {string} transactionId - The transaction ID to add
   * @returns {Object} The updated transaction
   */
  async addUnplannedExpense(projectId, transactionId) {
    try {
      const project = await ProjectBudget.findById(projectId);
      if (!project) {
        throw new Error('Project budget not found');
      }

      // Validate transaction ownership and type
      const transaction = await Transaction.findOne({
        _id: transactionId,
        userId: project.userId,
        type: TransactionType.EXPENSE // Only expense transactions can be tagged to projects
      });

      if (!transaction) {
        throw new Error('Transaction not found or not an expense transaction');
      }

      // Ensure project has a tag
      if (!project.projectTag) {
        await project.createProjectTag();
      }

      // Add project tag to transaction
      await transaction.addTags([project.projectTag]);

      logger.info(`Added unplanned expense ${transactionId} to project ${projectId}`);
      return transaction;
    } catch (error) {
      logger.error('Error adding unplanned expense:', error);
      throw error;
    }
  }

  /**
   * Remove transaction from project (untag)
   * @param {string} projectId - The project budget ID
   * @param {string} transactionId - The transaction ID to remove
   * @returns {Object} The updated transaction
   */
  async removeUnplannedExpense(projectId, transactionId) {
    try {
      const project = await ProjectBudget.findById(projectId);
      if (!project) {
        throw new Error('Project budget not found');
      }

      const transaction = await Transaction.findOne({
        _id: transactionId,
        userId: project.userId,
        tags: project.projectTag
      });

      if (!transaction) {
        throw new Error('Transaction not found or not associated with this project');
      }

      // Remove project tag from transaction
      await transaction.removeTags([project.projectTag]);

      // If transaction was in a planned category, remove it from allocated transactions
      const plannedBudget = project.categoryBudgets.find(budget =>
        budget.categoryId.toString() === transaction.category.toString() &&
        budget.subCategoryId.toString() === transaction.subCategory.toString()
      );

      if (plannedBudget) {
        // Remove transaction from allocated transactions list
        const transactionIndex = plannedBudget.allocatedTransactions.indexOf(transactionId);
        if (transactionIndex > -1) {
          plannedBudget.allocatedTransactions.splice(transactionIndex, 1);
        }
        await project.save();
      }

      logger.info(`Removed unplanned expense ${transactionId} from project ${projectId}`);
      return transaction;
    } catch (error) {
      logger.error('Error removing unplanned expense:', error);
      throw error;
    }
  }

  /**
   * Get unplanned expenses for a project
   * @param {string} projectId - The project budget ID
   * @returns {Array} Array of unplanned expenses
   */
  async getUnplannedExpenses(projectId) {
    try {
      const project = await ProjectBudget.findById(projectId);
      if (!project) {
        throw new Error('Project budget not found');
      }

      if (!project.projectTag) {
        return [];
      }

      // Get all transactions tagged with this project
      const transactions = await Transaction.find({
        userId: project.userId,
        tags: project.projectTag,
        processedDate: { $gte: project.startDate, $lte: project.endDate }
      })
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .sort({ processedDate: -1 });

      // Filter out transactions that are already allocated to planned categories
      const unplannedTransactions = transactions.filter(transaction => {
        const isAllocated = project.categoryBudgets.some(budget =>
          budget.allocatedTransactions && budget.allocatedTransactions.includes(transaction._id)
        );
        return !isAllocated;
      });

      return unplannedTransactions;
    } catch (error) {
      logger.error('Error getting unplanned expenses:', error);
      throw error;
    }
  }

  /**
   * Get planned expenses for a project
   * @param {string} projectId - The project budget ID
   * @returns {Array} Array of planned expenses grouped by category/subcategory
   */
  async getPlannedExpenses(projectId) {
    try {
      const project = await ProjectBudget.findById(projectId)
        .populate('categoryBudgets.categoryId', 'name')
        .populate('categoryBudgets.subCategoryId', 'name');

      if (!project) {
        throw new Error('Project budget not found');
      }

      const plannedExpenses = [];

      // For each category budget, get the allocated transactions and calculate actual amount
      for (const budget of project.categoryBudgets) {
        // Always include all planned categories, even if they have no allocated transactions yet
        let actualAmount = 0;
        let transactions = [];

        if (budget.allocatedTransactions && budget.allocatedTransactions.length > 0) {
          // Manually populate the allocated transactions since nested population doesn't work reliably
          const populatedTransactions = await Transaction.find({
            _id: { $in: budget.allocatedTransactions }
          }).populate('category', 'name').populate('subCategory', 'name');

          // Calculate actual amount dynamically from allocated transactions
          for (const transaction of populatedTransactions) {
            // Ensure transaction exists and has an amount
            if (!transaction || typeof transaction.amount !== 'number') {
              logger.warn(`Invalid transaction in allocated transactions: ${transaction ? transaction._id : 'null'}`);
              continue;
            }

            let convertedAmount = Math.abs(transaction.amount);
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
              } catch (error) {
                logger.warn(`Currency conversion failed for transaction ${transaction._id}:`, error.message);
                // Keep the original amount as fallback
              }
            }
            
            // Ensure we're adding a valid number
            if (!isNaN(convertedAmount) && isFinite(convertedAmount)) {
              actualAmount += convertedAmount;
            }
          }

          transactions = populatedTransactions.sort((a, b) => new Date(b.processedDate) - new Date(a.processedDate));
        }

        // Include all planned categories, even those with 0 actual amount
        plannedExpenses.push({
          categoryId: budget.categoryId._id,
          categoryName: budget.categoryId.name,
          subCategoryId: budget.subCategoryId._id,
          subCategoryName: budget.subCategoryId.name,
          budgetedAmount: budget.budgetedAmount || 0,
          actualAmount: isNaN(actualAmount) ? 0 : actualAmount, // Ensure we never return NaN
          currency: budget.currency || project.currency,
          transactions: transactions
        });
      }

      return plannedExpenses;
    } catch (error) {
      logger.error('Error getting planned expenses:', error);
      throw error;
    }
  }
}

module.exports = new ProjectExpensesService();
