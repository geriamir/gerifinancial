const { Transaction, SubCategory, Category } = require('../models');
const { ObjectId } = require('mongodb');
const bankScraperService = require('./bankScraperService');
const categoryAIService = require('./categoryAIService');
const VendorMapping = require('../models/VendorMapping');
const { CategorizationMethod, TransactionType, TransactionStatus } = require('../constants/enums');

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
        try {
          const savedTx = await Transaction.createFromScraperData(
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

  async attemptAutoCategorization(transaction, bankAccountId) {
    try {

      // First try to match by vendor mapping
      const vendorMapping = await VendorMapping.findOne({
        vendorName: transaction.description.toLowerCase(),
        userId: transaction.userId
      });

      if (vendorMapping) {
        await transaction.categorize(
          vendorMapping.category,
          vendorMapping.subCategory,
          CategorizationMethod.PREVIOUS_DATA
        );
        return;
      }

      // Try to find a similar transaction with matching description
      const searchTerms = [
        transaction.description,
        transaction.memo,
        transaction.rawData?.description,
        transaction.rawData?.memo,
        transaction.rawData?.category
      ].filter(Boolean);

      const searchQueries = searchTerms.map(term => ({
        $or: [
          { description: term },
          { memo: term },
          { 'rawData.description': term },
          { 'rawData.memo': term },
          { 'rawData.category': term }
        ]
      }));

      const similarTransaction = await Transaction.findOne({
        userId: transaction.userId,
        category: { $ne: null },
        _id: { $ne: transaction._id },
        $or: searchQueries
      }).populate('category subCategory');

      if (similarTransaction) {
        await transaction.categorize(
          similarTransaction.category,
          similarTransaction.subCategory,
          CategorizationMethod.PREVIOUS_DATA
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
          CategorizationMethod.PREVIOUS_DATA
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
        transaction.userId,
        transaction.rawData?.category || ''
      );

      if (suggestion.confidence >= 0.8) {
        await transaction.categorize(
          suggestion.categoryId,
          suggestion.subCategoryId,
          CategorizationMethod.AI
        );

        // Suggest new keywords for future matching
        const newKeywords = await categoryAIService.suggestNewKeywords(transaction.description);
        if (newKeywords.length > 0) {
          const subCategory = await SubCategory.findById(suggestion.subCategoryId);
          if (subCategory) {
            const existingKeywords = new Set(subCategory.keywords || []);
            newKeywords.forEach(keyword => existingKeywords.add(keyword.toLowerCase()));
            subCategory.keywords = Array.from(existingKeywords);
            await subCategory.save();
          }
        }
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

  async categorizeTransaction(transactionId, categoryId, subCategoryId) {
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
