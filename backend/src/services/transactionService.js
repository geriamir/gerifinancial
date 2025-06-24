const { createScraper } = require('israeli-bank-scrapers');
const { Transaction, SubCategory } = require('../models');

class TransactionService {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 5000; // 5 seconds
  }

  async scrapeTransactions(bankAccount, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days by default
      showBrowser = false
    } = options;

    let attempts = 0;
    let error = null;

    while (attempts < this.MAX_RETRIES) {
      try {
        const scraper = createScraper({
          companyId: bankAccount.bankId,
          verbose: process.env.NODE_ENV === 'development',
          showBrowser
        });

        const scraperResult = await scraper.scrape({
          credentials: {
            username: bankAccount.credentials.username,
            password: bankAccount.credentials.password
          },
          startDate
        });

        if (!scraperResult.success) {
          throw new Error(scraperResult.errorType || 'Unknown error during scraping');
        }

        return await this.processScrapedTransactions(scraperResult.accounts, bankAccount._id);
      } catch (err) {
        error = err;
        attempts++;
        if (attempts < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    throw new Error(`Failed to scrape after ${this.MAX_RETRIES} attempts: ${error.message}`);
  }

  async processScrapedTransactions(scrapedAccounts, bankAccountId) {
    const results = {
      newTransactions: 0,
      duplicates: 0,
      errors: []
    };

    for (const account of scrapedAccounts) {
      for (const transaction of account.txns) {
        try {
          await Transaction.createFromScraperData(transaction, bankAccountId);
          results.newTransactions++;
          
          // Attempt auto-categorization
          await this.attemptAutoCategorization(transaction, bankAccountId);
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
