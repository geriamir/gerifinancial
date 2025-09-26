const { Transaction, BankAccount, Tag, CreditCard, ManualCategorized, Category, SubCategory } = require('../models');
const BankClassificationService = require('./bankClassificationService');
const { ObjectId } = require('mongodb');
const bankScraperService = require('./bankScraperService');
const categoryMappingService = require('./categoryMappingService');
const { CategorizationMethod, TransactionStatus } = require('../constants/enums');
const logger = require('../../shared/utils/logger');

const convertToObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch (error) {
    console.error('Invalid ObjectId:', id, error);
    throw new Error('Invalid ID format');
  }
};

class TransactionService {

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
      errors: [],
      mostRecentTransactionDate: null,
      creditCardsCreated: 0
    };

    // Check once if this is a credit card provider
    const isCreditCardProvider = BankClassificationService.isCreditCardProvider(bankAccount.bankId);

    for (const account of scrapedAccounts) {
      let creditCard = null;
      
      // Create CreditCard instance for credit card providers
      if (isCreditCardProvider && account.accountNumber) {
        try {
          creditCard = await CreditCard.findOrCreate({
            userId: bankAccount.userId,
            bankAccountId: bankAccount._id,
            cardNumber: account.accountNumber,
            displayName: account.accountNumber,
            isActive: true,
            cardType: account.cardType || null,
            lastFourDigits: account.accountNumber.slice(-4)
          });
          
          results.creditCardsCreated++;
          logger.info(`Created/found credit card: ${creditCard.displayName} for bank account ${bankAccount._id}`);
        } catch (error) {
          logger.error(`Error creating credit card for account ${account.accountNumber}:`, error);
          results.errors.push({
            identifier: account.accountNumber,
            error: `Credit card creation failed: ${error.message}`
          });
        }
      }

      for (const transaction of account.txns) {
        try {
          const transactionDate = new Date(transaction.date);
          
          // Track the most recent transaction date
          if (!results.mostRecentTransactionDate || transactionDate > results.mostRecentTransactionDate) {
            results.mostRecentTransactionDate = transactionDate;
          }
          
          // Skip transactions with pending status from scraper
          if (transaction.status === 'pending') {
            logger.info(`Skipping pending transaction: ${transaction.description}, date: ${transactionDate}`);
            results.skippedPending++;
            continue;
          }

          // Create transaction without type initially
          // For credit card providers, include the specific account identifier for later credit card matching
          const rawData = {
            ...transaction,
            memo: transaction.rawData?.memo || transaction.memo || null
          };
          
          // Add credit card account identifier for credit card providers
          if (isCreditCardProvider && account.accountNumber) {
            rawData.creditCardAccountNumber = account.accountNumber;
          }

          const savedTx = await Transaction.create({
            identifier: transaction.identifier,
            accountId: bankAccount._id,
            userId: bankAccount.userId,
            creditCardId: creditCard?._id || null, // Link transaction to specific credit card
            date: transactionDate,
            processedDate: transaction.processedDate || transactionDate, // Copy processedDate from scraped data
            description: transaction.description,
            amount: transaction.chargedAmount,
            currency: bankAccount.defaultCurrency,
            rawData,
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
    transaction.type = category.type; // Set transaction type based on category type
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
    subCategory,
    search,
    limit = 20,
    skip = 0,
    accountId,
    userId,
    useProcessedDate = false
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
      // Use processedDate for budget views, regular date for transaction views
      const dateField = useProcessedDate ? 'processedDate' : 'date';
      query[dateField] = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);
        query[dateField].$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query[dateField].$lte = end;
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
    if (subCategory) {
      if (subCategory === 'uncategorized') {
        query.subCategory = null; // Filter for transactions without subcategory
      } else {
        query.subCategory = convertToObjectId(subCategory);
      }
    }
    if (search) {
      query.description = { $regex: search, $options: 'i' };
    }

    const total = await Transaction.countDocuments(query);
    const sortField = useProcessedDate ? 'processedDate' : 'date';
    const transactions = await Transaction.find(query)
      .sort({ [sortField]: -1 })
      .skip(skip)
      .limit(limit)
      .populate('category subCategory tags');

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
   * Apply manual categorization rule to historical transactions
   */
  async applyManualCategorizationToHistoricalTransactions(userId, matchingData, categoryId, subCategoryId, excludeTransactionId = null) {
    try {
      logger.info(`Applying manual categorization rule to historical transactions for user ${userId}, with matching data: ${JSON.stringify(matchingData)}`);
      
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

      // Helper function to escape special regex characters for MongoDB regex queries
      const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };

      // Add description matching if provided
      if (matchingData.description) {
        const escapedDescription = escapeRegExp(matchingData.description);
        query.description = new RegExp(escapedDescription, 'i');
      }

      // Add memo matching if provided
      if (matchingData.memo) {
        const escapedMemo = escapeRegExp(matchingData.memo);
        query.$or = [
          { memo: new RegExp(escapedMemo, 'i') },
          { 'rawData.memo': new RegExp(escapedMemo, 'i') }
        ];
      }

      // Add rawCategory matching if provided
      if (matchingData.rawCategory) {
        const escapedRawCategory = escapeRegExp(matchingData.rawCategory);
        if (query.$or) {
          query.$or.push({ 'rawData.category': new RegExp(escapedRawCategory, 'i') });
        } else {
          query['rawData.category'] = new RegExp(escapedRawCategory, 'i');
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
