const { Transaction, SubCategory } = require('../models');
const bankScraperService = require('./bankScraperService');

class TransactionService {
  async scrapeTransactions(bankAccount, options = {}) {
    const accounts = await bankScraperService.scrapeTransactions(bankAccount, options);
    return await this.processScrapedTransactions(accounts, bankAccount);
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
          await Transaction.createFromScraperData(transaction, bankAccount._id, bankAccount.defaultCurrency);
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
}

module.exports = new TransactionService();
