const { Transaction } = require('../models');
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

          // Look for similar transaction on same date
          const existingTransaction = await Transaction.findOne({
            accountId: bankAccount._id,
            date: transactionDate,
            description: transaction.description,
            amount: transaction.chargedAmount,
            'rawData.memo': transaction.rawData?.memo || null
          });

          if (existingTransaction) {
            logger.warn(`Similar transaction found: ${transaction.identifier}, date: ${transactionDate}, description: ${transaction.description}`);
            results.duplicates++;
            continue;
          }

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
          await this.attemptAutoCategorization(savedTx);
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
      bankAccount.lastScraped = new Date();
      bankAccount.status = 'active';
      await bankAccount.save();
      console.log(`Updated lastScraped for account ${bankAccount._id} to ${bankAccount.lastScraped}`);
    }
    
    console.log(`Scraping completed for account ${bankAccount._id}:`, results);
    return results;
  }


  async attemptAutoCategorization(transaction) {
    await categoryMappingService.attemptAutoCategorization(transaction);
  }

  async getTransactionsByDateRange(accountId, startDate, endDate, userId) {
    if (!userId) throw new Error('userId is required');
    return Transaction.findByDateRange(accountId, startDate, endDate, userId);
  }

  async getUncategorizedTransactions(accountId, userId) {
    if (!userId) throw new Error('userId is required');
    return Transaction.findUncategorized(accountId, userId);
  }

  async categorizeTransaction(transactionId, categoryId, subCategoryId, saveAsManual = false) {
    // Find and update transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Update and save transaction
    transaction.category = categoryId;
    transaction.subCategory = subCategoryId;
    transaction.categorizationMethod = CategorizationMethod.MANUAL;
    transaction.status = TransactionStatus.VERIFIED;
    await transaction.save();

    // Save manual categorization for future auto-categorization if requested
    if (saveAsManual) {
      await ManualCategorized.saveManualCategorization({
        description: transaction.description.toLowerCase().trim(),
        memo: (transaction.memo || transaction.rawData?.memo)?.toLowerCase().trim() || null,
        userId: transaction.userId,
        category: categoryId,
        subCategory: subCategoryId,
        language: 'he' // Assuming Hebrew as default
      });
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
}

module.exports = new TransactionService();
