const { Transaction, SubCategory, Category, PendingTransaction } = require('../models');
const { ObjectId } = require('mongodb');
const stringSimilarity = require('string-similarity');
const bankScraperService = require('./bankScraperService');
const categoryAIService = require('./categoryAIService');
const VendorMapping = require('../models/VendorMapping');
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
      errors: []
    };

    for (const account of scrapedAccounts) {
      for (const transaction of account.txns) {
        try {
          // First check if this transaction already exists in permanent storage
          const existingPermanent = await Transaction.findOne({
            identifier: transaction.identifier || null,
            accountId: bankAccount._id
          });

          if (existingPermanent) {
            logger.warn(`Duplicate transaction found: ${transaction.identifier}, description: ${transaction.description}, existing description: ${existingPermanent.description}`);
            results.duplicates++;
            continue;
          }

          // Then check pending storage
          const existingPending = await PendingTransaction.findOne({
            identifier: transaction.identifier || null,
            accountId: bankAccount._id
          });

          if (existingPending) {
            logger.warn(`Duplicate pending transaction found: ${transaction.identifier}, description: ${transaction.description}, existing description: ${existingPending.description}`);
            results.duplicates++;
            continue;
          }

          // Save to pending transactions
          const savedTx = await PendingTransaction.createFromScraperData(
            transaction, 
            bankAccount._id, 
            bankAccount.defaultCurrency,
            bankAccount.userId
          );
          results.newTransactions++;
          
          // Attempt auto-categorization
          await this.attemptAutoCategorization(savedTx, bankAccount._id);
        } catch (error) {
          if (error.code === 11000) {
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

    console.log(`Scraping completed for account ${bankAccount._id}:`, results);
    return results;
  }

  /**
   * Get all pending transactions that need review
   */
  async getPendingTransactions(userId, options = {}) {
    const query = { userId: convertToObjectId(userId) };
    
    if (options.accountId) {
      query.accountId = convertToObjectId(options.accountId);
    }

    const baseQuery = PendingTransaction.find(query)
      .sort({ date: -1 })
      .populate('category')
      .populate('subCategory');

    if (options.limit) {
      baseQuery.limit(options.limit);
    }

    if (options.skip) {
      baseQuery.skip(options.skip);
    }

    return baseQuery;
  }

  /**
   * Verify and move transactions from pending to permanent storage
   */
  async verifyTransactions(transactionIds, userId) {
    const verifiedTransactions = [];
    const errors = [];
    const failedIds = new Set();

    try {
      // First fetch all pending transactions in one query with references
      const pendingTxs = await PendingTransaction.find({
        _id: { $in: transactionIds.map(id => convertToObjectId(id)) },
        userId: convertToObjectId(userId)
      }).populate([
        { path: 'category', model: 'Category' },
        { path: 'subCategory', model: 'SubCategory' }
      ]);

      console.log('Found pending transactions:', pendingTxs.length);

      // Create a map for quick lookup
      const txMap = new Map(pendingTxs.map(tx => [tx._id.toString(), tx]));

      // Process each transaction ID
      for (const txId of transactionIds) {
        try {
          const pendingTx = txMap.get(txId.toString());
          if (!pendingTx) {
            throw new Error(`Transaction ${txId} not found`);
          }

          // Log category information for debugging
          console.log(`Processing tx ${txId}:`, {
            category: pendingTx.category?._id,
            subCategory: pendingTx.subCategory?._id
          });

          // Verify transaction
          const verifiedTx = await pendingTx.verify();
          verifiedTransactions.push(verifiedTx);
          console.log(`Successfully verified tx ${txId}`);
        } catch (error) {
          console.error(`Failed to verify tx ${txId}:`, error);
          failedIds.add(txId.toString());
          errors.push({
            transactionId: txId,
            error: error.message
          });
        }
      }

      console.log('Verification complete:', {
        verified: verifiedTransactions.length,
        errors: errors.length
      });

      return {
        verifiedCount: verifiedTransactions.length,
        errors
      };
    } catch (error) {
      console.error('Verification process failed:', error);
      throw error;
    }
  }

async attemptAutoCategorization(transaction, bankAccountId) {
    // Skip if already categorized
    if (transaction.category && transaction.subCategory) {
      return;
    }

    try {
      // Try to match by vendor mapping
      const vendorMappings = await VendorMapping.findMatches(
        transaction.description,
        transaction.userId
      );
      
      const vendorMapping = vendorMappings.length > 0 ? vendorMappings[0] : null;

      if (vendorMapping) {
        await transaction.categorize(
          vendorMapping.category,
          vendorMapping.subCategory,
          CategorizationMethod.PREVIOUS_DATA,
          false // needs verification
        );
        return;
      }

      // Try keyword-based matching
      const searchText = [
        transaction.description,
        transaction.memo,
        transaction.rawData?.description,
        transaction.rawData?.memo,
        transaction.rawData?.category
      ].filter(Boolean).join(' ');

      const matchingSubCategories = await SubCategory.findMatchingSubCategories(searchText);

      if (matchingSubCategories.length === 1) {
        const subCategory = matchingSubCategories[0];
        await transaction.categorize(
          subCategory.parentCategory._id,
          subCategory._id,
          CategorizationMethod.PREVIOUS_DATA,
          false // needs verification
        );
        return;
      }

      // Try AI categorization as last resort
      const availableCategories = await Category.find({ userId: transaction.userId })
        .populate('subCategories')
        .lean();

      const suggestion = await categoryAIService.suggestCategory(
        transaction.description,
        transaction.amount,
        availableCategories.map(cat => ({
          id: cat._id.toString(),
          name: cat.name,
          type: cat.type,
          subCategories: cat.subCategories.map(sub => ({
            id: sub._id.toString(),
            name: sub.name,
            keywords: sub.keywords || []
          }))
        })),
        transaction.userId.toString(),
        transaction.rawData?.category || '',
        transaction.memo || ''
      );

      // Always categorize with AI suggestion, but mark for verification
      if (suggestion.categoryId && suggestion.subCategoryId) {
        await transaction.categorize(
          suggestion.categoryId,
          suggestion.subCategoryId,
          CategorizationMethod.AI,
          false // needs verification
        );
      }
    } catch (error) {
      console.error('Auto-categorization failed:', error);
    }
  }

  async getTransactionsByDateRange(accountId, startDate, endDate, userId) {
    if (!userId) throw new Error('userId is required');
    return Transaction.findByDateRange(accountId, startDate, endDate, userId);
  }

  async getUncategorizedTransactions(accountId, userId) {
    if (!userId) throw new Error('userId is required');
    return Transaction.findUncategorized(accountId, userId);
  }

  async categorizePendingTransaction(transactionId, categoryId, subCategoryId, userId) {
    const pendingTx = await PendingTransaction.findOne({
      _id: convertToObjectId(transactionId),
      userId: convertToObjectId(userId)
    });

    if (!pendingTx) {
      throw new Error('Pending transaction not found');
    }

    // Create vendor mapping for future auto-categorization
    const vendorName = pendingTx.description.toLowerCase().trim();
    await VendorMapping.findOrCreate({
      vendorName,
      userId: pendingTx.userId,
      category: categoryId,
      subCategory: subCategoryId,
      language: 'he' // Assuming Hebrew as default
    });

    // Categorize the pending transaction
    await pendingTx.categorize(categoryId, subCategoryId, CategorizationMethod.MANUAL);
    return pendingTx;
  }

  async categorizeTransaction(transactionId, categoryId, subCategoryId, verify = false) {
    // Check if this is a pending transaction first
    const pendingTx = await PendingTransaction.findById(transactionId);
    if (pendingTx) {
      await this.categorizePendingTransaction(transactionId, categoryId, subCategoryId, pendingTx.userId);
      if (verify) {
        return await pendingTx.verify();
      }
      return pendingTx;
    }

    // If not pending, it's a regular transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Create vendor mapping for future auto-categorization
    const vendorName = transaction.description.toLowerCase().trim();
    await VendorMapping.findOrCreate({
      vendorName,
      userId: transaction.userId,
      category: categoryId,
      subCategory: subCategoryId,
      language: 'he' // Assuming Hebrew as default
    });

    await transaction.categorize(categoryId, subCategoryId, CategorizationMethod.MANUAL);
    return transaction;
  }

  /**
   * Find similar pending transactions for batch verification
   */
  async findSimilarPendingTransactions(transactionId, userId) {
    const baseTx = await PendingTransaction.findOne({
      _id: convertToObjectId(transactionId),
      userId: convertToObjectId(userId)
    }).populate(['category', 'subCategory']);

    if (!baseTx) {
      throw new Error('Transaction not found');
    }

    // Find potential matches with pending transactions
    const potentialMatches = await PendingTransaction.find({
      _id: { $ne: baseTx._id },
      userId: convertToObjectId(userId)
    }).populate(['category', 'subCategory']);

    // No category filter in query, let similarity scoring handle it

    // Calculate similarity scores
    const similarTransactions = potentialMatches
      .map(transaction => ({
        transaction,
        similarity: this._calculateSimilarityScore(baseTx, transaction)
      }))
      .filter(({ similarity }) => similarity >= 0.7) // Only include highly similar transactions
      .sort((a, b) => b.similarity - a.similarity); // Sort by similarity score

    return {
      transactions: similarTransactions.map(({ transaction }) => transaction),
      similarity: similarTransactions.length > 0 ? similarTransactions[0].similarity : 0
    };
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
    if (category) query.category = convertToObjectId(category);
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
}

module.exports = new TransactionService();
