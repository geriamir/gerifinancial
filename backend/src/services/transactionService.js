const { Transaction, Category, SubCategory, BankAccount, Tag } = require('../models');
const { ObjectId } = require('mongodb');
const stringSimilarity = require('string-similarity');
const bankScraperService = require('./bankScraperService');
const categoryMappingService = require('./categoryMappingService');
const ManualCategorized = require('../models/ManualCategorized');
const { CategorizationMethod, TransactionType, TransactionStatus } = require('../constants/enums');
const logger = require('../utils/logger');

const convertToObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch (error) {
    console.error('Invalid ObjectId:', id, error);
    throw new Error('Invalid ID format');
  }
};

class TransactionService {
  /**
   * Calculate similarity score between two transactions based on multiple factors
   * @private
   */
  _calculateSimilarityScore(baseTransaction, compareTransaction) {
    // Text similarity for description (0-1)
    const descriptionSimilarity = stringSimilarity.compareTwoStrings(
      baseTransaction.description.toLowerCase(),
      compareTransaction.description.toLowerCase()
    );

    // Amount similarity (0-1)
    const amountSimilarity = Math.max(0, 1 - Math.abs(
      (baseTransaction.amount - compareTransaction.amount) / baseTransaction.amount
    ));

    // Category match (0 or 1)
    const categoryMatch = baseTransaction.category?.toString() === compareTransaction.category?.toString() ? 1 : 0;

    // Vendor match from raw data (0 or 1)
    const vendorMatch = baseTransaction.rawData?.vendor === compareTransaction.rawData?.vendor ? 1 : 0;

    // Weight the factors
    const weights = {
      description: 0.4,
      amount: 0.3,
      category: 0.2,
      vendor: 0.1
    };

    return (
      descriptionSimilarity * weights.description +
      amountSimilarity * weights.amount +
      categoryMatch * weights.category +
      vendorMatch * weights.vendor
    );
  }

  /**
   * Find similar transactions for potential batch verification
   */
  async findSimilarTransactions(transactionId, userId) {
    const baseTransaction = await Transaction.findOne({
      _id: convertToObjectId(transactionId),
      userId: convertToObjectId(userId)
    });

    if (!baseTransaction) {
      throw new Error('Transaction not found');
    }

    // Find potential matches with same category and pending verification
    const potentialMatches = await Transaction.find({
      _id: { $ne: baseTransaction._id },
      userId: convertToObjectId(userId),
      category: baseTransaction.category,
      status: 'needs_verification'
    });

    // Calculate similarity scores
    const similarTransactions = potentialMatches
      .map(transaction => ({
        transaction,
        similarity: this._calculateSimilarityScore(baseTransaction, transaction)
      }))
      .filter(({ similarity }) => similarity >= 0.7) // Only include highly similar transactions
      .sort((a, b) => b.similarity - a.similarity); // Sort by similarity score

    return {
      transactions: similarTransactions.map(({ transaction }) => transaction),
      similarity: similarTransactions.length > 0 ? similarTransactions[0].similarity : 0
    };
  }

  async scrapeTransactions(bankAccount, options = {}) {
    try {
      const accounts = await bankScraperService.scrapeTransactions(bankAccount, options);
      return await this.processScrapedTransactions(accounts, bankAccount);
    } catch (error) {
      bankAccount.status = 'error';
      bankAccount.lastError = {
        message: error.message,
        date: new Date()
      };
      await bankAccount.save();
      
      return {
        newTransactions: 0,
        duplicates: 0,
        errors: [{
          error: error.message
        }]
      };
    }
  }

  async processScrapedTransactions(scrapedAccounts, bankAccount) {
    const results = {
      newTransactions: 0,
      duplicates: 0,
      skippedPending: 0,
      errors: []
    };

    for (const account of scrapedAccounts) {
      for (const transaction of account.txns) {
        try {
          const transactionDate = new Date(transaction.date);
          
          // Skip transactions with pending status from scraper
          if (transaction.status === 'pending') {
            logger.info(`Skipping pending transaction: ${transaction.identifier}, date: ${transactionDate}, description: ${transaction.description}`);
            results.skippedPending++;
            continue;
          }

          // // Look for similar transaction on same date
          // const existingTransaction = await Transaction.findOne({
          //   accountId: bankAccount._id,
          //   date: transactionDate,
          //   description: transaction.description,
          //   amount: transaction.chargedAmount,
          //   'rawData.memo': transaction.rawData?.memo || null
          // });

          // if (existingTransaction) {
          //   logger.warn(`Similar transaction found: ${transaction.identifier}, date: ${transactionDate}, description: ${transaction.description}`);
          //   results.duplicates++;
          //   continue;
          // }

          // Create transaction without type initially
          const savedTx = await Transaction.create({
            identifier: transaction.identifier,
            accountId: bankAccount._id,
            userId: bankAccount.userId,
            date: transactionDate,
            description: transaction.description,
            amount: transaction.chargedAmount,
            currency: bankAccount.defaultCurrency,
            rawData: {
              ...transaction,
              memo: transaction.rawData?.memo || transaction.memo || null
            },
            status: TransactionStatus.VERIFIED
          });
          
          results.newTransactions++;
          
          // Attempt auto-categorization which will also set the transaction type
          await categoryMappingService.attemptAutoCategorization(savedTx);
        } catch (error) {
          if (error.code === 11000) {
            logger.warn(`Duplicate transaction detected: ${transaction.identifier}`, error);
            results.duplicates++;
          } else {
            results.errors.push({
              identifier: transaction.identifier,
              error: error.message
            });
          }
        }
      }
    }

    // Update lastScraped timestamp on successful scraping (even if no new transactions)
    if (results.errors.length === 0 || results.newTransactions > 0) {
      // Fetch fresh bankAccount from database to ensure we have a proper Mongoose model
      const freshBankAccount = await BankAccount.findById(bankAccount._id);
      if (freshBankAccount) {
        freshBankAccount.lastScraped = new Date();
        freshBankAccount.status = 'active';
        await freshBankAccount.save();
        console.log(`Updated lastScraped for account ${freshBankAccount._id} to ${freshBankAccount.lastScraped}`);
      }
    }
    
    console.log(`Scraping completed for account ${bankAccount._id}:`, results);
    return results;
  }



  async getTransactionsByDateRange(accountId, startDate, endDate, userId) {
    if (!userId) throw new Error('userId is required');
    return Transaction.findByDateRange(accountId, startDate, endDate, userId);
  }

  async getUncategorizedTransactions(accountId, userId) {
    if (!userId) throw new Error('userId is required');
    return Transaction.findUncategorized(accountId, userId);
  }

  async categorizeTransaction(transactionId, categoryId, subCategoryId, saveAsManual = false, matchingFields = {}) {
    // Find and update transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Get category to check type and validate subcategory requirement
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Validate subcategory requirement based on category type
    if (category.type === 'Expense') {
      // Expense categories require subcategories
      if (!subCategoryId) {
        throw new Error('Subcategory is required for Expense transactions');
      }
    } else {
      // Income/Transfer categories don't use subcategories
      subCategoryId = null;
    }

    // Get subcategory name for reasoning if applicable
    const subCategory = subCategoryId ? await SubCategory.findById(subCategoryId) : null;

    // Generate reasoning based on category type
    let reasoning;
    if (category.type === 'Expense') {
      reasoning = `Manual categorization: User manually selected "${category.name}" > "${subCategory?.name}" for transaction with description: "${transaction.description}"`;
    } else {
      reasoning = `Manual categorization: User manually selected "${category.name}" (${category.type}) for transaction with description: "${transaction.description}"`;
    }

    // Update and save transaction
    transaction.category = categoryId;
    transaction.subCategory = subCategoryId;
    transaction.categorizationMethod = CategorizationMethod.MANUAL;
    transaction.categorizationReasoning = reasoning;
    transaction.status = TransactionStatus.VERIFIED;
    await transaction.save();

    console.log(`Transaction ${transaction._id} manually categorized: ${reasoning}`);

    // Save manual categorization for future auto-categorization if requested
    if (saveAsManual) {
      // Use custom matching fields if provided, otherwise use defaults
      const matchingData = {
        userId: transaction.userId,
        category: categoryId,
        subCategory: subCategoryId,
        language: 'he' // Assuming Hebrew as default
      };

      // Add selected fields for matching
      if (matchingFields.description && matchingFields.description.trim()) {
        matchingData.description = matchingFields.description.toLowerCase().trim();
      } else {
        matchingData.description = transaction.description.toLowerCase().trim();
      }

      if (matchingFields.memo && matchingFields.memo.trim()) {
        matchingData.memo = matchingFields.memo.toLowerCase().trim();
      } else if (transaction.memo || transaction.rawData?.memo) {
        matchingData.memo = (transaction.memo || transaction.rawData?.memo)?.toLowerCase().trim() || null;
      }

      if (matchingFields.rawCategory && matchingFields.rawCategory.trim()) {
        matchingData.rawCategory = matchingFields.rawCategory.toLowerCase().trim();
      } else if (transaction.rawData?.category) {
        matchingData.rawCategory = transaction.rawData.category.toLowerCase().trim();
      }

      await ManualCategorized.saveManualCategorization(matchingData);

      // Apply the new manual categorization rule to historical transactions
      const historicalUpdates = await this.applyManualCategorizationToHistoricalTransactions(
        transaction.userId,
        matchingData,
        categoryId,
        subCategoryId,
        transaction._id // Exclude current transaction from historical updates
      );

      // Add historical updates info to the transaction object for the response
      transaction.historicalUpdates = historicalUpdates;
    }

    return transaction;
  }

  async getSpendingSummary(accountId, startDate, endDate) {
    return Transaction.getSpendingSummary(accountId, startDate, endDate);
  }

  async getTransactions({
    startDate,
    endDate,
    type,
    category,
    search,
    limit = 20,
    skip = 0,
    accountId,
    userId
  }) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const query = {
      userId: convertToObjectId(userId)
    };
    
    if (accountId) {
      query.accountId = convertToObjectId(accountId);
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    if (type) {
      if (['Expense', 'Income', 'Transfer'].includes(type)) {
        query.type = type;
      } else {
        console.warn('Invalid transaction type received:', type);
      }
    }
    if (category) {
      if (category === 'uncategorized') {
        query.category = null; // Filter for uncategorized transactions
      } else {
        query.category = convertToObjectId(category);
      }
    }
    if (search) {
      query.description = { $regex: search, $options: 'i' };
    }

    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('category subCategory');

    const hasMore = total > skip + transactions.length;

    return {
      transactions,
      total,
      hasMore
    };
  }

  async getUncategorizedStats(userId) {
    if (!userId) {
      throw new Error('userId is required');
    }

    // Get total uncategorized count across all accounts
    const total = await Transaction.countDocuments({
      userId: convertToObjectId(userId),
      category: null
    });

    return {
      total
    };
  }

  // ============================================
  // TRANSACTION TAGGING METHODS
  // ============================================

  /**
   * Add tags to a transaction
   */
  async addTagsToTransaction(transactionId, tags, userId) {
    try {
      const transaction = await Transaction.findOne({
        _id: convertToObjectId(transactionId),
        userId: convertToObjectId(userId)
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Ensure tags is an array
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const tagIds = [];

      // Find or create tags
      for (const tagName of tagArray) {
        if (typeof tagName === 'string') {
          // Create tag if it's a string name
          const tag = await Tag.findOrCreate({
            name: tagName.trim(),
            userId: convertToObjectId(userId),
            type: tagName.startsWith('project:') ? 'project' : 'custom'
          });
          tagIds.push(tag._id);
        } else {
          // Assume it's already a tag ID
          tagIds.push(convertToObjectId(tagName));
        }
      }

      // Add tags to transaction
      await transaction.addTags(tagIds);

      logger.info(`Added ${tagIds.length} tags to transaction ${transactionId}`);
      return transaction;
    } catch (error) {
      logger.error('Error adding tags to transaction:', error);
      throw error;
    }
  }

  /**
   * Remove tags from a transaction
   */
  async removeTagsFromTransaction(transactionId, tags, userId) {
    try {
      const transaction = await Transaction.findOne({
        _id: convertToObjectId(transactionId),
        userId: convertToObjectId(userId)
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Ensure tags is an array
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const tagIds = tagArray.map(tag => convertToObjectId(tag));

      // Remove tags from transaction
      await transaction.removeTags(tagIds);

      logger.info(`Removed ${tagIds.length} tags from transaction ${transactionId}`);
      return transaction;
    } catch (error) {
      logger.error('Error removing tags from transaction:', error);
      throw error;
    }
  }

  /**
   * Get transactions by tag
   */
  async getTransactionsByTag(tagId, userId, options = {}) {
    try {
      const { limit = 20, skip = 0, startDate, endDate } = options;

      let query = {
        userId: convertToObjectId(userId),
        tags: convertToObjectId(tagId)
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
      logger.error('Error getting transactions by tag:', error);
      throw error;
    }
  }

  /**
   * Get transactions by project (using project tag)
   */
  async getTransactionsByProject(projectId, userId, options = {}) {
    try {
      const { ProjectBudget } = require('../models');
      
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
      return this.getTransactionsByTag(project.projectTag._id, userId, options);
    } catch (error) {
      logger.error('Error getting transactions by project:', error);
      throw error;
    }
  }

  /**
   * Get spending summary by tag
   */
  async getSpendingSummaryByTag(tagId, userId, startDate, endDate) {
    try {
      const summary = await Transaction.getSpendingSummaryByTag(
        convertToObjectId(tagId),
        startDate,
        endDate
      );

      return summary;
    } catch (error) {
      logger.error('Error getting spending summary by tag:', error);
      throw error;
    }
  }

  /**
   * Get user's tag usage statistics
   */
  async getUserTagStats(userId) {
    try {
      const stats = await Tag.getUserTagsWithStats(convertToObjectId(userId));
      return stats;
    } catch (error) {
      logger.error('Error getting user tag stats:', error);
      throw error;
    }
  }

  /**
   * Bulk tag transactions (for batch operations)
   */
  async bulkTagTransactions(transactionIds, tags, userId) {
    try {
      const results = {
        updated: 0,
        errors: []
      };

      for (const transactionId of transactionIds) {
        try {
          await this.addTagsToTransaction(transactionId, tags, userId);
          results.updated++;
        } catch (error) {
          results.errors.push({
            transactionId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error bulk tagging transactions:', error);
      throw error;
    }
  }

  // ============================================
  // BUDGET ALLOCATION METHODS
  // ============================================

  /**
   * Allocate transaction to a specific budget
   */
  async allocateTransactionToBudget(transactionId, budgetType, budgetId, userId) {
    try {
      const transaction = await Transaction.findOne({
        _id: convertToObjectId(transactionId),
        userId: convertToObjectId(userId)
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Handle different budget types
      switch (budgetType) {
        case 'project':
          const { ProjectBudget } = require('../models');
          const project = await ProjectBudget.findOne({
            _id: convertToObjectId(budgetId),
            userId: convertToObjectId(userId)
          });

          if (!project) {
            throw new Error('Project budget not found');
          }

          // Add project tag to transaction
          if (project.projectTag) {
            await this.addTagsToTransaction(transactionId, [project.projectTag], userId);
          }
          break;

        default:
          throw new Error('Invalid budget type');
      }

      logger.info(`Allocated transaction ${transactionId} to ${budgetType} budget ${budgetId}`);
      return transaction;
    } catch (error) {
      logger.error('Error allocating transaction to budget:', error);
      throw error;
    }
  }

  /**
   * Get monthly budget actuals from transactions
   */
  async getMonthlyBudgetActuals(userId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const actuals = await Transaction.aggregate([
        {
          $match: {
            userId: convertToObjectId(userId),
            processedDate: { $gte: startDate, $lte: endDate },
            category: { $ne: null }
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
      logger.error('Error getting monthly budget actuals:', error);
      throw error;
    }
  }

  /**
   * Get project budget actuals from tagged transactions
   */
  async getProjectBudgetActuals(projectId, userId) {
    try {
      const { ProjectBudget } = require('../models');
      
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
   * Apply manual categorization rule to historical transactions
   */
  async applyManualCategorizationToHistoricalTransactions(userId, matchingData, categoryId, subCategoryId, excludeTransactionId = null) {
    try {
      console.log(`Applying manual categorization rule to historical transactions for user ${userId}, with matching data: ${JSON.stringify(matchingData)}`);
      
      // Build query to find matching transactions
      const query = {
        userId: convertToObjectId(userId),
        // Apply to both uncategorized and already categorized transactions
        // This allows correcting wrongly categorized transactions
      };

      // Exclude the current transaction from historical updates
      if (excludeTransactionId) {
        query._id = { $ne: convertToObjectId(excludeTransactionId) };
      }

      // Add description matching if provided
      if (matchingData.description) {
        query.description = new RegExp(matchingData.description, 'i');
      }

      // Add memo matching if provided
      if (matchingData.memo) {
        query.$or = [
          { memo: new RegExp(matchingData.memo, 'i') },
          { 'rawData.memo': new RegExp(matchingData.memo, 'i') }
        ];
      }

      // Add rawCategory matching if provided
      if (matchingData.rawCategory) {
        if (query.$or) {
          query.$or.push({ 'rawData.category': new RegExp(matchingData.rawCategory, 'i') });
        } else {
          query['rawData.category'] = new RegExp(matchingData.rawCategory, 'i');
        }
      }

      // Find matching transactions
      const matchingTransactions = await Transaction.find(query);

      if (matchingTransactions.length === 0) {
        console.log('No historical transactions found matching the pattern');
        return { updatedCount: 0 };
      }

      console.log(`Found ${matchingTransactions.length} historical transactions matching the pattern (includes both uncategorized and already categorized)`);

      // Get category and subcategory for reasoning
      const category = await Category.findById(categoryId);
      const subCategory = subCategoryId ? await SubCategory.findById(subCategoryId) : null;

      let updatedCount = 0;
      
      // Update each matching transaction
      for (const transaction of matchingTransactions) {
        try {
          // Generate reasoning
          let reasoning;
          if (category.type === 'Expense' && subCategory) {
            reasoning = `Auto-categorization from manual rule: Pattern matches user rule for "${category.name}" > "${subCategory.name}". Original transaction: "${transaction.description}"`;
          } else {
            reasoning = `Auto-categorization from manual rule: Pattern matches user rule for "${category.name}" (${category.type}). Original transaction: "${transaction.description}"`;
          }

          // Update transaction
          transaction.category = categoryId;
          transaction.subCategory = subCategoryId;
          transaction.categorizationMethod = CategorizationMethod.PREVIOUS_DATA;
          transaction.categorizationReasoning = reasoning;
          
          // Set transaction type based on category type
          if (!transaction.type) {
            transaction.type = category.type;
          }
          
          await transaction.save();
          updatedCount++;
          
          console.log(`Updated historical transaction ${transaction._id}: ${reasoning}`);
        } catch (error) {
          console.error(`Failed to update transaction ${transaction._id}:`, error);
        }
      }

      console.log(`Successfully updated ${updatedCount} historical transactions`);
      return { updatedCount };
      
    } catch (error) {
      console.error('Error applying manual categorization to historical transactions:', error);
      throw error;
    }
  }
}

module.exports = new TransactionService();
