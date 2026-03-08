const { ProjectBudget } = require('../models');
const { Tag, Transaction } = require('../../banking');
const { ObjectId } = require('mongodb');
const logger = require('../../shared/utils/logger');

const convertToObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch (error) {
    console.error('Invalid ObjectId:', id, error);
    throw new Error('Invalid ID format');
  }
};

class ProjectTransactionService {
  /**
   * Get transactions by project (using project tag)
   */
  async getTransactionsByProject(projectId, userId, options = {}) {
    try {
      // Get project and its tag
      const project = await ProjectBudget.findOne({
        _id: convertToObjectId(projectId),
        userId: convertToObjectId(userId)
      }).populate('projectTag');

      if (!project) {
        throw new Error('Project not found');
      }

      if (!project.projectTag) {
        // Return empty result if project has no tag yet
        return {
          transactions: [],
          total: 0,
          hasMore: false
        };
      }

      // Get transactions using the project tag
      const { limit = 20, skip = 0, startDate, endDate } = options;

      let query = {
        userId: convertToObjectId(userId),
        tags: convertToObjectId(project.projectTag._id)
      };

      // Add date range if provided
      if (startDate || endDate) {
        query.processedDate = {};
        if (startDate) {
          query.processedDate.$gte = new Date(startDate);
        }
        if (endDate) {
          query.processedDate.$lte = new Date(endDate);
        }
      }

      const total = await Transaction.countDocuments(query);
      const transactions = await Transaction.find(query)
        .sort({ processedDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('category subCategory tags');

      return {
        transactions,
        total,
        hasMore: total > skip + transactions.length
      };
    } catch (error) {
      logger.error('Error getting transactions by project:', error);
      throw error;
    }
  }

  /**
   * Allocate transaction to a project budget
   */
  async allocateTransactionToProject(transactionId, projectId, userId) {
    try {
      const transaction = await Transaction.findOne({
        _id: convertToObjectId(transactionId),
        userId: convertToObjectId(userId)
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const project = await ProjectBudget.findOne({
        _id: convertToObjectId(projectId),
        userId: convertToObjectId(userId)
      });

      if (!project) {
        throw new Error('Project budget not found');
      }

      // Add project tag to transaction
      if (project.projectTag) {
        // Ensure tags is an array
        const currentTags = transaction.tags || [];
        if (!currentTags.includes(project.projectTag)) {
          await transaction.addTags([project.projectTag]);
        }
      }

      logger.info(`Allocated transaction ${transactionId} to project budget ${projectId}`);
      return transaction;
    } catch (error) {
      logger.error('Error allocating transaction to project:', error);
      throw error;
    }
  }

  /**
   * Get project budget actuals from tagged transactions
   */
  async getProjectBudgetActuals(projectId, userId) {
    try {
      const project = await ProjectBudget.findOne({
        _id: convertToObjectId(projectId),
        userId: convertToObjectId(userId)
      });

      if (!project) {
        throw new Error('Project not found');
      }

      if (!project.projectTag) {
        return [];
      }

      const actuals = await Transaction.aggregate([
        {
          $match: {
            userId: convertToObjectId(userId),
            tags: project.projectTag,
            processedDate: { $gte: project.startDate, $lte: project.endDate }
          }
        },
        {
          $group: {
            _id: {
              category: '$category',
              subCategory: '$subCategory'
            },
            totalAmount: { $sum: { $abs: '$amount' } },
            transactionCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id.category',
            foreignField: '_id',
            as: 'categoryDetails'
          }
        },
        {
          $lookup: {
            from: 'subcategories',
            localField: '_id.subCategory',
            foreignField: '_id',
            as: 'subCategoryDetails'
          }
        }
      ]);

      return actuals;
    } catch (error) {
      logger.error('Error getting project budget actuals:', error);
      throw error;
    }
  }

  /**
   * Get spending summary by project tag
   */
  async getProjectSpendingSummary(projectId, userId, startDate, endDate) {
    try {
      const project = await ProjectBudget.findOne({
        _id: convertToObjectId(projectId),
        userId: convertToObjectId(userId)
      });

      if (!project) {
        throw new Error('Project not found');
      }

      if (!project.projectTag) {
        return [];
      }

      const summary = await Transaction.getSpendingSummaryByTag(
        convertToObjectId(project.projectTag),
        startDate,
        endDate
      );

      return summary;
    } catch (error) {
      logger.error('Error getting project spending summary:', error);
      throw error;
    }
  }

  /**
   * Bulk tag transactions to project (for batch operations)
   */
  async bulkTagTransactionsToProject(projectId, transactionIds) {
    try {
      const project = await ProjectBudget.findOne({
        _id: convertToObjectId(projectId)
      });

      if (!project) {
        throw new Error('Project not found');
      }

      if (!project.projectTag) {
        throw new Error('Project has no tag yet');
      }

      const results = {
        successfulTags: 0,
        failedTags: []
      };

      for (const transactionId of transactionIds) {
        try {
          await this.allocateTransactionToProject(transactionId, projectId, project.userId);
          results.successfulTags++;
        } catch (error) {
          results.failedTags.push({
            transactionId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error bulk tagging transactions to project:', error);
      throw error;
    }
  }

  /**
   * Remove transaction from project
   */
  async removeTransactionFromProject(transactionId, projectId) {
    try {
      const transaction = await Transaction.findOne({
        _id: convertToObjectId(transactionId)
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const project = await ProjectBudget.findOne({
        _id: convertToObjectId(projectId)
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Remove project tag from transaction
      if (project.projectTag && transaction.tags) {
        const updatedTags = transaction.tags.filter(
          tag => !tag.equals(project.projectTag)
        );
        
        await Transaction.updateOne(
          { _id: convertToObjectId(transactionId) },
          { tags: updatedTags }
        );
      }

      // Clear project budget allocation if it exists
      await Transaction.updateOne(
        { _id: convertToObjectId(transactionId) },
        { 
          $unset: { 
            projectBudgetAllocation: 1 
          }
        }
      );

      logger.info(`Removed transaction ${transactionId} from project ${projectId}`);
      return transaction;
    } catch (error) {
      logger.error('Error removing transaction from project:', error);
      throw error;
    }
  }

  /**
   * Move expense to planned category
   */
  async moveExpenseToPlannedCategory(transactionId, projectId, categoryId, subCategoryId) {
    try {
      const transaction = await Transaction.findOne({
        _id: convertToObjectId(transactionId)
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const project = await ProjectBudget.findOne({
        _id: convertToObjectId(projectId)
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Find the category budget that matches
      const categoryBudget = project.categoryBudgets.find(cb => 
        cb.categoryId.equals(convertToObjectId(categoryId)) && 
        cb.subCategoryId.equals(convertToObjectId(subCategoryId))
      );

      if (!categoryBudget) {
        throw new Error('Category budget not found in project');
      }

      // Update transaction with project budget allocation
      const allocationData = {
        projectId: convertToObjectId(projectId),
        categoryBudgetId: categoryBudget._id,
        categoryId: convertToObjectId(categoryId),
        subCategoryId: convertToObjectId(subCategoryId),
        allocatedAt: new Date()
      };

      // If this is part of an installment group, generate a groupId
      let groupId = null;
      if (transaction.installmentInfo && transaction.installmentInfo.groupIdentifier) {
        groupId = transaction.installmentInfo.groupIdentifier;
        allocationData.installmentGroupId = groupId;
      }

      await Transaction.updateOne(
        { _id: convertToObjectId(transactionId) },
        { projectBudgetAllocation: allocationData }
      );

      logger.info(`Moved transaction ${transactionId} to planned category in project ${projectId}`);
      return { groupId };
    } catch (error) {
      logger.error('Error moving expense to planned category:', error);
      throw error;
    }
  }

  /**
   * Bulk move expenses to planned category
   */
  async bulkMoveExpensesToPlannedCategory(transactionIds, projectId, categoryId, subCategoryId) {
    try {
      const project = await ProjectBudget.findOne({
        _id: convertToObjectId(projectId)
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const results = {
        successfulMoves: 0,
        failedMoves: []
      };

      for (const transactionId of transactionIds) {
        try {
          await this.moveExpenseToPlannedCategory(transactionId, projectId, categoryId, subCategoryId);
          results.successfulMoves++;
        } catch (error) {
          results.failedMoves.push({
            transactionId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error bulk moving expenses to planned category:', error);
      throw error;
    }
  }
  /**
   * Discover transactions that could belong to a project
   * Finds transactions within the project's date range matching filter criteria
   * that are not already tagged to the project
   */
  async discoverTransactions(projectId, userId, options = {}) {
    const { currencies, categoryIds, excludeILS = true } = options;

    const project = await ProjectBudget.findOne({
      _id: convertToObjectId(projectId),
      userId: convertToObjectId(userId)
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // ILS identifiers: the currency field uses ISO 'ILS', rawData uses symbol '₪' or 'ILS'
    const ilsIdentifiers = ['ILS', '₪'];

    // Build query: user's transactions within project date range
    const query = {
      userId: convertToObjectId(userId),
      date: { $gte: project.startDate, $lte: project.endDate }
    };

    // Exclude transactions already tagged to this project
    if (project.projectTag) {
      query.tags = { $ne: project.projectTag };
    }

    // Currency filter — check rawData.originalCurrency (the actual transaction currency)
    // Falls back to the top-level currency field for transactions without rawData
    if (currencies && currencies.length > 0) {
      query.$or = [
        { 'rawData.originalCurrency': { $in: currencies } },
        { currency: { $in: currencies } }
      ];
    } else if (excludeILS) {
      query.$or = [
        { 'rawData.originalCurrency': { $exists: true, $nin: ilsIdentifiers } },
        { 'rawData.originalCurrency': { $exists: false }, currency: { $ne: 'ILS' } }
      ];
    }

    // Category filter
    if (categoryIds && categoryIds.length > 0) {
      query.category = { $in: categoryIds.map(id => convertToObjectId(id)) };
    }

    // Fetch matching transactions
    const transactions = await Transaction.find(query)
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .populate('accountId', 'name bankId')
      .sort({ date: -1 })
      .lean();

    // Get distinct original currencies in the date range (for filter UI)
    const baseMatch = {
      userId: convertToObjectId(userId),
      date: { $gte: project.startDate, $lte: project.endDate },
      ...(project.projectTag ? { tags: { $ne: project.projectTag } } : {})
    };

    const availableCurrencies = await Transaction.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: {
            $ifNull: ['$rawData.originalCurrency', '$currency']
          }
        }
      },
      { $sort: { _id: 1 } }
    ]).then(results => results.map(r => r._id).filter(Boolean));

    // Get distinct categories available in the date range (for filter UI)
    const categoryDocs = await Transaction.aggregate([
      {
        $match: {
          ...baseMatch,
          category: { $ne: null }
        }
      },
      { $group: { _id: '$category' } },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'cat'
        }
      },
      { $unwind: '$cat' },
      { $project: { _id: '$cat._id', name: '$cat.name' } },
      { $sort: { name: 1 } }
    ]);

    logger.info(`Discovered ${transactions.length} transactions for project ${projectId} with filters: currencies=${currencies || (excludeILS ? 'non-ILS' : 'all')}, categories=${categoryIds || 'all'}`);

    return {
      transactions,
      filters: {
        availableCurrencies: availableCurrencies.sort(),
        availableCategories: categoryDocs
      },
      project: {
        _id: project._id,
        name: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        currency: project.currency
      }
    };
  }
}

module.exports = new ProjectTransactionService();
