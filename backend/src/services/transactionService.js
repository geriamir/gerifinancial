const { Transaction, SubCategory } = require('../models');
const { ObjectId } = require('mongodb');
const bankScraperService = require('./bankScraperService');

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
      errors: []
    };

    for (const account of scrapedAccounts) {
      for (const transaction of account.txns) {
        // Log raw transaction data for debugging
        try {
          await Transaction.createFromScraperData(
            transaction, 
            bankAccount._id, 
            bankAccount.defaultCurrency,
            bankAccount.userId // Add userId from the bank account
          );
          results.newTransactions++;
          
          // Attempt auto-categorization
          await this.attemptAutoCategorization(transaction, bankAccount._id);
        } catch (error) {
          if (error.code === 11000) { // Duplicate key error
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

  async attemptAutoCategorization(transaction, bankAccountId) {
    try {
      // Find the transaction in our database
      const dbTransaction = await Transaction.findOne({
        identifier: transaction.identifier,
        accountId: bankAccountId
      });

      if (!dbTransaction || dbTransaction.category) {
        return; // Transaction not found or already categorized
      }

      // Look for matching subcategories based on description
      const matchingSubCategories = await SubCategory.findMatchingSubCategories(
        transaction.description
      );

      if (matchingSubCategories.length === 1) {
        // If we have exactly one match, use it for auto-categorization
        const subCategory = matchingSubCategories[0];
        await dbTransaction.categorize(
          subCategory.parentCategory._id,
          subCategory._id,
          true
        );
      }
    } catch (error) {
      console.error('Auto-categorization failed:', error);
      // Don't throw - auto-categorization failure shouldn't stop the process
    }
  }

  async getTransactionsByDateRange(accountId, startDate, endDate) {
    return Transaction.findByDateRange(accountId, startDate, endDate);
  }

  async getUncategorizedTransactions(accountId) {
    return Transaction.findUncategorized(accountId);
  }

  async categorizeTransaction(transactionId, categoryId, subCategoryId) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    await transaction.categorize(categoryId, subCategoryId, false);
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
    // Build base query - userId is required for security
    if (!userId) {
      throw new Error('userId is required');
    }

    const query = {
      userId: convertToObjectId(userId)
    };
    
    // Only add accountId filter if specifically requested
    if (accountId) {
      query.accountId = convertToObjectId(accountId);
    }

    // Add other filters - ensure proper date handling with start/end of day
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
      console.log('Processing type filter:', { 
        rawType: type,
        typeType: typeof type,
        validTypes: ['Expense', 'Income', 'Transfer'],
        isValidType: ['Expense', 'Income', 'Transfer'].includes(type)
      });
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

    // Log the query for debugging
    console.log('MongoDB query:', {
      userId: query.userId.toString(),
      dateRange: query.date,
      type: query.type,
      description: query.description
    });

    // Debug: Check collection for matching documents
    const count = await Transaction.countDocuments(query);
    console.log('Query results:', {
      matchingDocuments: count,
      totalUserDocs: await Transaction.countDocuments({ userId: query.userId })
    });
    if (count === 0) {
      const userCount = await Transaction.countDocuments({
        userId: convertToObjectId(userId)
      });
      console.log('Total transactions for user:', userCount);
    }

    // Get total count for pagination
    const total = await Transaction.countDocuments(query);

    // Get paginated transactions
    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate('category subCategory');

    // Calculate if there are more transactions
    const hasMore = total > skip + transactions.length;

    console.log(`Fetched ${transactions.length} transactions, total: ${total}, hasMore: ${hasMore}`);

    return {
      transactions,
      total,
      hasMore
    };
  }
}

module.exports = new TransactionService();
