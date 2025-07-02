const { Transaction, SubCategory, Category } = require('../models');
const { ObjectId } = require('mongodb');
const bankScraperService = require('./bankScraperService');
const categoryAIService = require('./categoryAIService');

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
      console.log('Attempting auto-categorization for transaction:', {
        identifier: transaction.identifier,
        description: transaction.description,
        amount: transaction.amount
      });

      // Find the transaction in our database
      const dbTransaction = await Transaction.findOne({
        identifier: transaction.identifier,
        accountId: bankAccountId
      });

      if (!dbTransaction || dbTransaction.category) {
        console.log('Skipping auto-categorization:', {
          reason: !dbTransaction ? 'Transaction not found' : 'Already categorized',
          transactionId: dbTransaction?._id
        });
        return;
      }

      // First try keyword-based matching
      const matchingSubCategories = await SubCategory.findMatchingSubCategories(
        transaction.description
      );

      if (matchingSubCategories.length === 1) {
        console.log('Found exact keyword match:', {
          description: transaction.description,
          matchedSubCategory: matchingSubCategories[0].name,
          keywords: matchingSubCategories[0].keywords
        });
        // If we have exactly one match, use it for auto-categorization
        const subCategory = matchingSubCategories[0];
        await dbTransaction.categorize(
          subCategory.parentCategory._id,
          subCategory._id,
          true
        );
        return;
      }

      // If no keyword matches, try AI categorization
      const availableCategories = await Category.find({ userId: dbTransaction.userId })
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
        }))
      );

      console.log('AI suggestion received:', {
        description: transaction.description,
        suggestion
      });

      if (suggestion.confidence >= 0.8) {
        console.log('Applying AI suggestion:', {
          confidence: suggestion.confidence,
          categoryId: suggestion.categoryId,
          subCategoryId: suggestion.subCategoryId,
          reasoning: suggestion.reasoning
        });
        await dbTransaction.categorize(
          suggestion.categoryId,
          suggestion.subCategoryId,
          true
        );

        // If AI categorization was successful, suggest new keywords
        const newKeywords = await categoryAIService.suggestNewKeywords(
          transaction.description
        );

        if (newKeywords.length > 0) {
          const subCategory = await SubCategory.findById(suggestion.subCategoryId);
          if (subCategory) {
            // Add new keywords if they don't exist
            const existingKeywords = new Set(subCategory.keywords || []);
            newKeywords.forEach(keyword => existingKeywords.add(keyword.toLowerCase()));
            subCategory.keywords = Array.from(existingKeywords);
            await subCategory.save();
          }
        }
      }
    } catch (error) {
      console.error('Auto-categorization failed:', error);
      // Don't throw - auto-categorization failure shouldn't stop the process
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
