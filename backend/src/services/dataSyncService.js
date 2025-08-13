const { BankAccount } = require('../models');
const bankScraperService = require('./bankScraperService');
const transactionService = require('./transactionService');
const investmentService = require('./investmentService');
const portfolioService = require('./portfolioService');
const logger = require('../utils/logger');

class DataSyncService {
  async syncBankAccountData(bankAccount, options = {}) {
    try {
      logger.info(`Starting comprehensive data sync for bank account ${bankAccount._id}...`);
      
      // Single scraping session that gets transactions, portfolios, and legacy investments
      const scrapingResult = await bankScraperService.scrapeTransactions(bankAccount, options);
      
      // Delegate processing to dedicated services
      const transactionResults = await transactionService.processScrapedTransactions(scrapingResult.accounts || [], bankAccount);

      // Update scraping status to complete after transactions are processed and categorized
      await this.updateScrapingStatusComplete(bankAccount._id, transactionResults);
      
      // Process portfolios (new structure) or legacy investments
      let portfolioResults = { newPortfolios: 0, updatedPortfolios: 0, errors: [] };
      let investmentResults = { newInvestments: 0, updatedInvestments: 0, errors: [] };
      
      if (scrapingResult.portfolios && scrapingResult.portfolios.length > 0) {
        // New portfolio structure - each portfolio contains investments
        logger.info(`Processing ${scrapingResult.portfolios.length} portfolios for bank account ${bankAccount._id}`);
        portfolioResults = await portfolioService.processScrapedPortfolios(scrapingResult.portfolios, bankAccount);
        
        // Aggregate investment results from all portfolios
        if (portfolioResults.aggregatedInvestmentResults) {
          investmentResults = portfolioResults.aggregatedInvestmentResults;
        }
      }
      
      // Update bank account status on successful sync
      const syncSuccessful = this.isSyncSuccessful(transactionResults, investmentResults, portfolioResults);
      if (syncSuccessful) {
        await this.updateBankAccountStatus(bankAccount._id, transactionResults);
      }
      
      const combinedResults = {
        transactions: transactionResults,
        investments: investmentResults,
        portfolios: portfolioResults,
        totalNewItems: transactionResults.newTransactions + investmentResults.newInvestments + portfolioResults.newPortfolios,
        totalUpdatedItems: investmentResults.updatedInvestments + portfolioResults.updatedPortfolios,
        hasErrors: transactionResults.errors.length > 0 || investmentResults.errors.length > 0 || portfolioResults.errors.length > 0
      };
      
      // Step 4: Post-categorization credit card detection
      if (syncSuccessful) {
        try {
          const creditCardDetectionService = require('./creditCardDetectionService');
          await creditCardDetectionService.detectAndUpdateCreditCards(bankAccount.userId);
          logger.info(`Credit card detection completed for user ${bankAccount.userId}`);
        } catch (detectionError) {
          logger.warn(`Credit card detection failed for user ${bankAccount.userId}: ${detectionError.message}`);
          // Don't fail the entire sync for detection errors
        }
      }
      
      logger.info(`Data sync completed for account ${bankAccount._id}:`, {
        newTransactions: transactionResults.newTransactions,
        newInvestments: investmentResults.newInvestments,
        updatedInvestments: investmentResults.updatedInvestments,
        newPortfolios: portfolioResults.newPortfolios,
        updatedPortfolios: portfolioResults.updatedPortfolios,
        errors: combinedResults.hasErrors
      });
      
      return combinedResults;
    } catch (error) {
      logger.error(`Data sync failed for bank account ${bankAccount._id}: ${error.message}`);
      
      // Update bank account error status
      await this.updateBankAccountError(bankAccount, error.message);
      
      throw error;
    }
  }

  // Helper method for backward compatibility - delegates to transaction service
  async syncTransactionsOnly(bankAccount, options = {}) {
    try {
      logger.info(`Starting transaction-only sync for bank account ${bankAccount._id}...`);
      
      const scrapingResult = await bankScraperService.scrapeTransactions(bankAccount, options);
      const transactionResults = await transactionService.processScrapedTransactions(scrapingResult.accounts || [], bankAccount);
      
      // Update lastScraped timestamp on successful scraping
      if (transactionResults.errors.length === 0 || transactionResults.newTransactions > 0) {
        await this.updateBankAccountStatus(bankAccount._id, transactionResults);
      }
      
      return transactionResults;
    } catch (error) {
      logger.error(`Transaction-only sync failed for bank account ${bankAccount._id}: ${error.message}`);
      await this.updateBankAccountError(bankAccount, error.message);
      throw error;
    }
  }

  // Helper method for investment-only sync
  async syncInvestmentsOnly(bankAccount, options = {}) {
    try {
      logger.info(`Starting investment-only sync for bank account ${bankAccount._id}...`);
      
      const scrapingResult = await bankScraperService.scrapeTransactions(bankAccount, options);
      const investmentResults = await investmentService.processScrapedInvestments(scrapingResult.investments || [], bankAccount);
      
      return {
        investments: investmentResults,
        hasErrors: investmentResults.errors.length > 0
      };
    } catch (error) {
      logger.error(`Investment-only sync failed for bank account ${bankAccount._id}: ${error.message}`);
      throw error;
    }
  }

  // Get comprehensive sync status for a bank account
  async getSyncStatus(bankAccountId, userId) {
    try {
      const { Transaction, Investment } = require('../models');
      
      const bankAccount = await BankAccount.findOne({ _id: bankAccountId, userId });
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      const transactionCount = await Transaction.countDocuments({ 
        accountId: bankAccountId, 
        userId 
      });
      
      const investmentCount = await Investment.countDocuments({ 
        bankAccountId: bankAccountId, 
        userId,
        status: 'active'
      });

      const portfolioSummary = await Investment.getPortfolioSummary(userId);

      return {
        bankAccount: {
          id: bankAccount._id,
          name: bankAccount.name,
          bankId: bankAccount.bankId,
          status: bankAccount.status,
          lastScraped: bankAccount.lastScraped,
          lastError: bankAccount.lastError
        },
        transactions: {
          total: transactionCount,
          lastSync: bankAccount.lastScraped
        },
        investments: {
          accounts: investmentCount,
          totalValue: portfolioSummary.totalValue || 0,
          lastSync: bankAccount.lastScraped
        }
      };
    } catch (error) {
      logger.error(`Error getting sync status: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  isSyncSuccessful(transactionResults, investmentResults, portfolioResults) {
    const transactionSuccess = transactionResults.errors.length === 0 || transactionResults.newTransactions > 0;
    const investmentSuccess = investmentResults.errors.length === 0 || 
                            investmentResults.newInvestments > 0 || 
                            investmentResults.updatedInvestments > 0;
    const portfolioSuccess = portfolioResults.errors.length === 0 || 
                           portfolioResults.newPortfolios > 0 || 
                           portfolioResults.updatedPortfolios > 0;
    
    return transactionSuccess && (investmentSuccess || portfolioSuccess);
  }

  async updateBankAccountStatus(bankAccountId, transactionResults = null) {
    const freshBankAccount = await BankAccount.findById(bankAccountId);
    if (freshBankAccount) {
      // Use the most recent transaction date from sync session, or current date as fallback
      let lastScrapedDate = new Date();
      
      if (transactionResults && transactionResults.mostRecentTransactionDate) {
        lastScrapedDate = transactionResults.mostRecentTransactionDate;
        logger.info(`Using most recent transaction date ${lastScrapedDate.toISOString()} as lastScraped for account ${freshBankAccount._id}`);
      } else {
        logger.info(`No recent transaction date found, using current time as lastScraped for account ${freshBankAccount._id}`);
      }

      // Adding 1 minute to avoid duplicate transactions
      lastScrapedDate.setMinutes(lastScrapedDate.getMinutes() + 1);

      freshBankAccount.lastScraped = lastScrapedDate;
      freshBankAccount.status = 'active';
      freshBankAccount.lastError = null; // Clear any previous errors
      await freshBankAccount.save();
      logger.info(`Updated lastScraped for account ${freshBankAccount._id} to ${freshBankAccount.lastScraped}`);
    }
  }

  async updateBankAccountError(bankAccount, errorMessage) {
    // Only mark account as inactive/error for credentials-related issues
    const isCredentialsError = this.isCredentialsRelatedError(errorMessage);
    
    if (isCredentialsError) {
      bankAccount.status = 'error';
      logger.warn(`Marking bank account ${bankAccount._id} as inactive due to credentials error: ${errorMessage}`);
    } else {
      // For other errors (network, timeout, bank website issues), keep account active
      // but log the error for monitoring
      logger.info(`Non-credentials error for bank account ${bankAccount._id}, keeping account active: ${errorMessage}`);
    }
    
    bankAccount.lastError = {
      message: errorMessage,
      date: new Date(),
      isCredentialsError
    };
    await bankAccount.save();
  }

  // Helper method to determine if an error is credentials-related
  isCredentialsRelatedError(errorMessage) {
    const credentialsErrorPatterns = [
      'invalid credentials',
      'invalid bank credentials',
      'login failed',
      'authentication failed',
      'wrong username',
      'wrong password',
      'incorrect credentials',
      'unauthorized',
      'access denied',
      'forbidden',
      'invalid user',
      'invalid password'
    ];
    
    const lowerErrorMessage = errorMessage.toLowerCase();
    return credentialsErrorPatterns.some(pattern => lowerErrorMessage.includes(pattern));
  }

  // Update scraping status to complete after transactions are processed and categorized
  async updateScrapingStatusComplete(bankAccountId, transactionResults) {
    try {
      const totalTransactions = transactionResults.newTransactions + transactionResults.duplicates;
      const categorizedTransactions = transactionResults.newTransactions; // Newly added transactions are categorized

      await bankScraperService.updateScrapingStatus(bankAccountId, {
        status: 'complete',
        progress: 100,
        message: `Successfully imported and categorized ${totalTransactions} transactions`,
        lastUpdatedAt: new Date(),
        isActive: false,
        hasImportedTransactions: totalTransactions > 0,
        transactionsCategorized: categorizedTransactions
      });

      logger.info(`Scraping marked as complete for bank account ${bankAccountId}: ${totalTransactions} transactions imported, ${categorizedTransactions} categorized`);
    } catch (error) {
      logger.error(`Failed to update scraping status to complete for bank account ${bankAccountId}:`, error);
      // Don't throw error - this shouldn't fail the sync
    }
  }
}

module.exports = new DataSyncService();
