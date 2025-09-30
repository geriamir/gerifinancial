const { BankAccount, Transaction } = require('../models');
const { TransactionType } = require('../constants/enums');
const { ForeignCurrencyAccount } = require('../../foreign-currency');
const bankScraperService = require('./bankScraperService');
const logger = require('../../shared/utils/logger');
const queuedDataSyncService = require('./queuedDataSyncService');

class DataSyncService {
  constructor() {
    // Delay strategy initialization to avoid circular dependencies
    this.strategies = null;
  }

  // Get strategies from global registry
  getStrategies() {
    if (!global.syncStrategies) {
      throw new Error('Sync strategies not initialized. Please ensure app.js has initialized the strategy registry.');
    }
    return global.syncStrategies;
  }

  /**
   * Syncs bank account data using the async queue system.
   * @param {BankAccount} bankAccount - The bank account to sync data for.
   * @param {Object} [options={}] - Additional options for the sync process.
   */
  async syncBankAccountData(bankAccount, options = {}) {
    logger.info(`Starting queue-based data sync for bank account ${bankAccount._id} (${bankAccount.name}) starting from ${bankAccount.lastScraped ? bankAccount.lastScraped.toISOString() : 'initial scrape'}...`);

    // Import queue service (lazy import to avoid circular dependencies)
    
    const priority = options.priority || 'normal';
    
    // Queue all strategies for comprehensive sync
    const result = await queuedDataSyncService.queueBankAccountSync(
      bankAccount._id,
      { ...options, priority }
    );
    
    logger.info(`Queued comprehensive sync jobs for account ${bankAccount._id}:`, result.queuedJobs);
    
    // Return simplified result structure for queue-based processing
    return {
      message: 'Comprehensive sync jobs queued successfully',
      jobIds: result.queuedJobs,
      totalJobs: result.totalJobs,
      priority,
      queuedAt: new Date().toISOString(),
      estimatedCompletionTime: '2-5 minutes',
      note: 'Results will be processed by background workers. Use queue/stats endpoint to monitor progress.',
      // Minimal compatibility properties
      hasErrors: false,
      hasAnySuccess: true,
      isQueueBased: true
    };
  }

  // Get comprehensive sync status for a bank account
  async getSyncStatus(bankAccountId, userId) {
    try {
      const bankAccount = await BankAccount.findOne({ _id: bankAccountId, userId });
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      const transactionCount = await Transaction.countDocuments({ 
        accountId: bankAccountId, 
        userId 
      });
      
      const { Investment } = require('../../investments');
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

  // NEW: Process foreign currency accounts from scraping results
  async processForeignCurrencyAccounts(foreignCurrencyAccounts, bankAccount) {
    const results = {
      newAccounts: 0,
      updatedAccounts: 0,
      newTransactions: 0,
      errors: []
    };

    try {
      for (const fcAccount of foreignCurrencyAccounts) {
        try {
          // Validate required fields - use originalAccountNumber from scraper data as accountNumber
          if (!fcAccount.originalAccountNumber || !fcAccount.currency) {
            logger.warn(`Skipping foreign currency account with missing required fields:`, fcAccount);
            results.errors.push({
              type: 'account',
              currency: fcAccount.currency || 'unknown',
              accountNumber: fcAccount.originalAccountNumber || 'unknown',
              error: 'Missing required accountNumber or currency'
            });
            continue;
          }

          // Find or create the foreign currency account
          // Use originalAccountNumber from scraper as the accountNumber in our model
          const foreignCurrencyAccount = await ForeignCurrencyAccount.findOrCreate(
            bankAccount.userId,
            bankAccount._id,
            fcAccount.originalAccountNumber, // This becomes accountNumber in our model
            fcAccount.currency,
            {
              accountType: fcAccount.accountType,
              balance: fcAccount.balance,
              transactionCount: fcAccount.transactionCount,
              lastTransactionDate: fcAccount.transactions.length > 0 
                ? new Date(Math.max(...fcAccount.transactions.map(t => new Date(t.date)))) 
                : null,
              rawAccountData: fcAccount.rawAccountData
            }
          );

          // Track if this was a new account
          const wasNewAccount = foreignCurrencyAccount.createdAt >= new Date(Date.now() - 1000);
          if (wasNewAccount) {
            results.newAccounts++;
          } else {
            results.updatedAccounts++;
          }

          // Process transactions for this foreign currency account
          let transactionsProcessed = 0;
          for (const transaction of fcAccount.transactions) {
            try {
              // Check if transaction already exists
              const existingTransaction = await Transaction.findOne({
                identifier: transaction.identifier,
                userId: bankAccount.userId,
                currency: transaction.currency
              });

              if (!existingTransaction) {
                // Create new foreign currency transaction
                const newTransaction = new Transaction({
                  identifier: transaction.identifier,
                  userId: bankAccount.userId,
                  accountId: foreignCurrencyAccount._id, // Link to foreign currency account
                  amount: transaction.amount,
                  currency: transaction.currency,
                  date: new Date(transaction.date),
                  description: transaction.description,
                  memo: transaction.memo,
                  type: transaction.amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
                  rawData: {
                    ...transaction.rawData,
                    originalAmount: transaction.originalAmount,
                    exchangeRate: transaction.exchangeRate,
                    foreignCurrencyAccount: true
                  }
                });

                await newTransaction.save();
                transactionsProcessed++;
                results.newTransactions++;
                
                logger.debug(`Created foreign currency transaction: ${transaction.currency} ${transaction.amount} - ${transaction.description}`);
              }
            } catch (transactionError) {
              logger.error(`Failed to process foreign currency transaction:`, transactionError);
              results.errors.push({
                type: 'transaction',
                currency: transaction.currency,
                identifier: transaction.identifier,
                error: transactionError.message
              });
            }
          }

          // Update account transaction statistics
          if (transactionsProcessed > 0) {
            await foreignCurrencyAccount.updateTransactionStats(
              foreignCurrencyAccount.transactionCount + transactionsProcessed,
              fcAccount.transactions.length > 0 
                ? new Date(Math.max(...fcAccount.transactions.map(t => new Date(t.date))))
                : foreignCurrencyAccount.lastTransactionDate
            );
          }

          // Update account balance using proper exchange rate service
          if (fcAccount.balance !== undefined) {
            try {
              // Get proper exchange rate from currency exchange service instead of transaction data
              const { currencyExchangeService } = require('../../foreign-currency');
              const currentRate = await currencyExchangeService.getCurrentRate(fcAccount.currency, 'ILS');
              
              if (currentRate) {
                await foreignCurrencyAccount.updateBalance(fcAccount.balance, currentRate);
                logger.info(`Updated ${fcAccount.currency} account balance using proper exchange rate: ${currentRate}`);
              } else {
                // Fallback to updating balance without exchange rate
                await foreignCurrencyAccount.updateBalance(fcAccount.balance);
                logger.warn(`No exchange rate available for ${fcAccount.currency}, updated balance without conversion`);
              }
            } catch (rateError) {
              logger.warn(`Failed to get proper exchange rate for ${fcAccount.currency}, updating balance without conversion:`, rateError.message);
              // Fallback to updating balance without exchange rate
              await foreignCurrencyAccount.updateBalance(fcAccount.balance);
            }
          }

          logger.info(`Processed foreign currency account: ${foreignCurrencyAccount.displayName} with ${transactionsProcessed} new transactions`);

        } catch (accountError) {
          logger.error(`Failed to process foreign currency account:`, accountError);
          results.errors.push({
            type: 'account',
            currency: fcAccount.currency,
            accountNumber: fcAccount.originalAccountNumber,
            error: accountError.message
          });
        }
      }

      logger.info(`Foreign currency processing complete: ${results.newAccounts} new accounts, ${results.updatedAccounts} updated, ${results.newTransactions} transactions, ${results.errors.length} errors`);

    } catch (error) {
      logger.error(`Failed to process foreign currency accounts:`, error);
      results.errors.push({
        type: 'general',
        error: error.message
      });
    }

    return results;
  }
}

module.exports = new DataSyncService();
