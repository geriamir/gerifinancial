const scraperModule = ['test', 'e2e'].includes(process.env.NODE_ENV)
  ? require('../test/mocks/bankScraper')
  : require('israeli-bank-scrapers');

const { createScraper } = scraperModule;
const logger = require('../utils/logger');


class BankScraperService {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 5000; // 5 seconds
    this.DEFAULT_TIMEOUT = 210000; // 3 minutes
  }

  createScraper(bankAccount, options = {}) {
    // Get smart start date from bank account (uses lastScraped if available, otherwise 6 months back)
    const scraperOptions = bankAccount.getScraperOptions();
    
    const {
      startDate = scraperOptions.startDate, // Use smart start date from bank account
      showBrowser = false,
      verbose = false,
      timeout = this.DEFAULT_TIMEOUT
    } = options;

    // Create a copy to avoid mutating the input parameter
    const startDateCopy = new Date(startDate);
    startDateCopy.setDate(startDateCopy.getDate() + 1);

    // Log the scraping strategy being used
    const isIncrementalScraping = bankAccount.lastScraped;
    logger.info(`Creating scraper for bank account ${bankAccount._id}  with ${isIncrementalScraping ? 'incremental' : 'initial'} scraping from ${startDateCopy.toISOString()}`);

    const scraper = createScraper({
      companyId: bankAccount.bankId,
      verbose,
      showBrowser,
      timeout,
      defaultTimeout: timeout,
      startDate: startDateCopy,
      combineInstallments: false,
      excludePendingTransactions: true
    });
    
    return scraper;
  }

  async login(bankAccount, options = {}) {
    const scraper = this.createScraper(bankAccount, options);
    let attempts = 0;
    let error = null;

    while (attempts < this.MAX_RETRIES) {
      try {
        const loginResult = await scraper.login(bankAccount.getScraperOptions().credentials);

        if (!loginResult) {
          throw new Error('Login failed - invalid credentials');
        }

        logger.info(`Successfully logged in to bank account ${bankAccount._id}`);
        return scraper;
      } catch (err) {
        error = err;
        attempts++;
        
        if (attempts < this.MAX_RETRIES) {
          logger.info(`Login attempt ${attempts} failed for bank account ${bankAccount._id}, retrying in ${this.RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    this.handleScraperError(error, 'Login', bankAccount._id);
  }

  async scrapeTransactions(bankAccount, options = {}) {
    const scraper = this.createScraper(bankAccount, options);
    let attempts = 0;
    let error = null;

    logger.info(`Starting scraping for bank account ${bankAccount._id} (${bankAccount.name})...`);
    
    // Initialize scraping status
    await this.updateScrapingStatus(bankAccount._id, {
      isActive: true,
      status: 'connecting',
      progress: 10,
      message: 'Connecting to bank...',
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      transactionsImported: 0,
      transactionsCategorized: 0
    });

    while (attempts < this.MAX_RETRIES) {
      try {
        // Update status: scraping
        await this.updateScrapingStatus(bankAccount._id, {
          status: 'scraping',
          progress: 30,
          message: 'Downloading transactions...',
          lastUpdatedAt: new Date()
        });

        const scraperResult = await scraper.scrape(bankAccount.getScraperOptions().credentials);

        if (!scraperResult.success) {
          const errorType = scraperResult.errorType || 'Unknown';
          const errorMessage = scraperResult.errorMessage || 'No additional error details';
          throw new Error(`Scraping failed: ${errorType} - ${errorMessage}`);
        }

        // Calculate transaction count for status update
        const totalTransactions = (scraperResult.accounts || []).reduce((total, account) => {
          return total + (account.txns ? account.txns.length : 0);
        }, 0);

        // Update status: processing
        await this.updateScrapingStatus(bankAccount._id, {
          status: 'categorizing',
          progress: 80,
          message: `Processing ${totalTransactions} transactions...`,
          lastUpdatedAt: new Date(),
          transactionsImported: totalTransactions
        });

        logger.info(`Successfully scraped bank account ${bankAccount._id} (${bankAccount.name}) - ${scraperResult.accounts?.length || 0} accounts found`);
        
        // Log if portfolios are available (new structure)
        if (scraperResult.portfolios && scraperResult.portfolios.length > 0) {
          logger.info(`Successfully scraped accounts and ${scraperResult.portfolios.length} portfolios for bank account ${bankAccount._id}`);
        }
        // Log if legacy investments are available
        else if (scraperResult.investments && scraperResult.investments.length > 0) {
          logger.info(`Successfully scraped accounts and ${scraperResult.investments.length} legacy investment accounts for bank account ${bankAccount._id}`);
        } else {
          logger.info(`Successfully scraped accounts for bank account ${bankAccount._id}`);
        }

        // Update status: processing (don't mark as complete yet - categorization happens later)
        await this.updateScrapingStatus(bankAccount._id, {
          status: 'categorizing',
          progress: 90,
          message: `Downloaded ${totalTransactions} transactions, categorizing...`,
          lastUpdatedAt: new Date(),
          transactionsImported: totalTransactions,
          transactionsCategorized: 0 // Not categorized yet
        });

        // Extract investment transactions from portfolios
        const investmentTransactions = this.extractInvestmentTransactions(scraperResult.portfolios || []);

        // Extract foreign currency accounts from both dedicated foreign currency accounts and regular accounts with foreign currency transactions
        const foreignCurrencyAccountsFromDedicated = this.extractForeignCurrencyAccountsFromDedicated(scraperResult.foreignCurrencyAccounts || []);
        const foreignCurrencyAccountsFromRegular = this.extractForeignCurrencyAccounts(scraperResult.accounts || []);
        
        // Combine both sources of foreign currency accounts
        const foreignCurrencyAccounts = [...foreignCurrencyAccountsFromDedicated, ...foreignCurrencyAccountsFromRegular];

        // Return accounts, portfolios (new structure), investments (legacy), investment transactions, and foreign currency accounts
        return {
          accounts: scraperResult.accounts || [],
          portfolios: scraperResult.portfolios || [],
          investments: scraperResult.investments || [],
          investmentTransactions: investmentTransactions,
          foreignCurrencyAccounts: foreignCurrencyAccounts
        };
      } catch (err) {
        error = err;
        attempts++;

        if (attempts < this.MAX_RETRIES) {
          logger.info(`Scraping attempt ${attempts} failed for bank account ${bankAccount._id} with error ${error}, retrying in ${this.RETRY_DELAY}ms...`);
          
          // Update status: retrying
          await this.updateScrapingStatus(bankAccount._id, {
            status: 'connecting',
            progress: 20,
            message: `Retrying connection (attempt ${attempts + 1}/${this.MAX_RETRIES})...`,
            lastUpdatedAt: new Date()
          });

          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    // Update status: error
    await this.updateScrapingStatus(bankAccount._id, {
      status: 'error',
      progress: 0,
      message: error.message,
      lastUpdatedAt: new Date(),
      isActive: false
    });

    this.handleScraperError(error, 'Transaction scraping', bankAccount._id);
  }

  // Helper method to validate investment data structure
  validateInvestmentData(investment) {
    // Updated for new israeli-bank-scrapers format
    const requiredFields = ['paperId']; // paperId is the unique identifier for investments
    const missingFields = requiredFields.filter(field => !investment[field]);
    
    if (missingFields.length > 0) {
      logger.warn(`Investment data missing required fields: ${missingFields.join(', ')}`);
      return false;
    }

    return true;
  }

  // Helper method to process investment data for storage
  processInvestmentData(investments) {
    if (!investments || !Array.isArray(investments)) {
      return [];
    }

    return investments
      .filter(investment => this.validateInvestmentData(investment))
      .map(investment => ({
        // Use paperId as unique identifier since that's what the new format provides
        accountNumber: investment.paperId?.toString() || investment.accountNumber,
        accountType: 'investment',
        balance: investment.value || investment.balance || 0,
        currency: investment.currency || 'ILS',
        holdings: [{
          symbol: investment.symbol || '',
          name: investment.paperName || '',
          quantity: investment.amount || 0,
          value: investment.value || 0,
          paperId: investment.paperId
        }],
        lastUpdated: new Date(),
        rawData: investment
      }));
  }

  // NEW: Extract investment transactions from portfolio data
  extractInvestmentTransactions(portfolios) {
    if (!portfolios || !Array.isArray(portfolios)) {
      return [];
    }

    const allTransactions = [];

    portfolios.forEach(portfolio => {
      if (!portfolio.transactions || !Array.isArray(portfolio.transactions)) {
        return;
      }

      portfolio.transactions.forEach(transaction => {
        // Validate required transaction fields
        if (!transaction.paperId || !transaction.executionDate || transaction.amount === undefined) {
          logger.warn(`Skipping invalid investment transaction:`, transaction);
          return;
        }

        // Process and normalize transaction data
        const processedTransaction = {
          portfolioId: portfolio.portfolioId,
          portfolioName: portfolio.portfolioName,
          
          // Security identification
          paperId: transaction.paperId,
          paperName: transaction.paperName || '',
          symbol: transaction.symbol || '',
          
          // Transaction details - ensure numeric values are valid
          amount: Number.isFinite(Number(transaction.amount)) ? Number(transaction.amount) : 0,
          value: Number.isFinite(Number(transaction.value)) ? Math.abs(Number(transaction.value)) : 0,
          currency: transaction.currency || 'ILS',
          taxSum: Number.isFinite(Number(transaction.taxSum)) ? Number(transaction.taxSum) : 0,
          executablePrice: Number.isFinite(Number(transaction.executablePrice)) ? Number(transaction.executablePrice) : 0,
          
          // Date handling - ensure proper date parsing
          executionDate: new Date(transaction.executionDate),
          
          // Store original data for debugging
          rawData: transaction
        };

        // Validate processed data
        if (!processedTransaction.executionDate || isNaN(processedTransaction.executionDate.getTime())) {
          logger.warn(`Invalid execution date for investment transaction:`, transaction);
          return;
        }

        allTransactions.push(processedTransaction);
      });
    });

    logger.info(`Extracted ${allTransactions.length} investment transactions from ${portfolios.length} portfolios`);
    return allTransactions;
  }

  // NEW: Extract foreign currency accounts from dedicated foreign currency accounts (TransactionsForeignAccount[])
  extractForeignCurrencyAccountsFromDedicated(foreignCurrencyAccounts) {
    if (!foreignCurrencyAccounts || !Array.isArray(foreignCurrencyAccounts)) {
      return [];
    }

    const processedAccounts = [];

    foreignCurrencyAccounts.forEach(foreignAccount => {
      if (!foreignAccount.accountNumber || !foreignAccount.currency) {
        logger.warn(`Skipping invalid dedicated foreign currency account:`, foreignAccount);
        return;
      }

      // Process dedicated foreign currency account
      const processedAccount = {
        originalAccountNumber: foreignAccount.accountNumber,
        currency: foreignAccount.currency,
        accountType: foreignAccount.type === 'foreignCurrency' ? 'checking' : (foreignAccount.type || 'checking'),
        balance: foreignAccount.balance || 0,
        transactionCount: (foreignAccount.txns || []).length,
        transactions: (foreignAccount.txns || []).map(txn => ({
          identifier: txn.identifier || `${txn.date}_${txn.chargedAmount}_${foreignAccount.currency}`,
          date: txn.date,
          amount: txn.chargedAmount || txn.originalAmount || 0,
          currency: foreignAccount.currency,
          originalAmount: txn.originalAmount || txn.chargedAmount, // Amount in original currency
          exchangeRate: txn.originalCurrency && txn.originalAmount && txn.chargedAmount ? 
            Math.abs(txn.chargedAmount / txn.originalAmount) : null,
          description: txn.description,
          memo: txn.memo,
          rawData: txn
        })),
        rawAccountData: foreignAccount,
        source: 'dedicated' // Mark as coming from dedicated foreign currency accounts
      };

      processedAccounts.push(processedAccount);
    });

    if (processedAccounts.length > 0) {
      logger.info(`Extracted ${processedAccounts.length} dedicated foreign currency accounts with currencies: ${[...new Set(processedAccounts.map(fca => fca.currency))].join(', ')}`);
    }

    return processedAccounts;
  }

  // NEW: Extract foreign currency accounts from scraped account data
  extractForeignCurrencyAccounts(accounts) {
    if (!accounts || !Array.isArray(accounts)) {
      return [];
    }

    const foreignCurrencyAccounts = [];

    accounts.forEach(account => {
      // Check if account has transactions in foreign currency
      if (account.txns && Array.isArray(account.txns)) {
        const currenciesFound = new Set();
        
        account.txns.forEach(transaction => {
          if (transaction.originalCurrency && transaction.originalCurrency !== 'ILS') {
            currenciesFound.add(transaction.originalCurrency);
          }
          // Also check the main currency field
          if (transaction.currency && transaction.currency !== 'ILS') {
            currenciesFound.add(transaction.currency);
          }
        });

        // If foreign currencies found, create foreign currency account entries
        currenciesFound.forEach(currency => {
          const foreignCurrencyTransactions = account.txns.filter(txn => 
            txn.originalCurrency === currency || 
            (txn.currency === currency && currency !== 'ILS')
          );

          if (foreignCurrencyTransactions.length > 0) {
            foreignCurrencyAccounts.push({
              originalAccountNumber: account.accountNumber,
              currency: currency,
              accountType: account.type || 'checking',
              balance: this.calculateForeignCurrencyBalance(foreignCurrencyTransactions),
              transactionCount: foreignCurrencyTransactions.length,
              transactions: foreignCurrencyTransactions.map(txn => ({
                identifier: txn.identifier || `${txn.date}_${txn.chargedAmount}_${currency}`,
                date: txn.date,
                amount: txn.originalAmount || txn.chargedAmount,
                currency: currency,
                originalAmount: txn.chargedAmount, // Amount in ILS
                exchangeRate: txn.originalAmount ? Math.abs(txn.chargedAmount / txn.originalAmount) : null,
                description: txn.description,
                memo: txn.memo,
                rawData: txn
              })),
              rawAccountData: account,
              source: 'regular' // Mark as coming from regular accounts with foreign currency transactions
            });
          }
        });
      }

      // Also check if the account itself has a non-ILS currency
      if (account.currency && account.currency !== 'ILS') {
        const existingForeignAccount = foreignCurrencyAccounts.find(
          fca => fca.originalAccountNumber === account.accountNumber && fca.currency === account.currency
        );

        if (!existingForeignAccount) {
          foreignCurrencyAccounts.push({
            originalAccountNumber: account.accountNumber,
            currency: account.currency,
            accountType: account.type || 'checking',
            balance: account.balance || 0,
            transactionCount: (account.txns || []).length,
            transactions: (account.txns || []).map(txn => ({
              identifier: txn.identifier || `${txn.date}_${txn.chargedAmount}_${account.currency}`,
              date: txn.date,
              amount: txn.chargedAmount,
              currency: account.currency,
              description: txn.description,
              memo: txn.memo,
              rawData: txn
            })),
            rawAccountData: account
          });
        }
      }
    });

    if (foreignCurrencyAccounts.length > 0) {
      logger.info(`Extracted ${foreignCurrencyAccounts.length} foreign currency accounts with currencies: ${[...new Set(foreignCurrencyAccounts.map(fca => fca.currency))].join(', ')}`);
    }

    return foreignCurrencyAccounts;
  }

  // Helper method to calculate balance from foreign currency transactions
  calculateForeignCurrencyBalance(transactions) {
    return transactions.reduce((balance, txn) => {
      const amount = txn.originalAmount || txn.chargedAmount || 0;
      return balance + amount;
    }, 0);
  }

  async validateCredentials(bankId, credentials) {
    // Create a temporary bank account object for validation
    const tempAccount = { 
      bankId, 
      _id: 'validation',
      lastScraped: null,
      getScraperOptions: () => ({ 
        credentials: { username: credentials.username, password: credentials.password },
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 6 months back for validation
      })
    };
    
    try {
      await this.login(tempAccount, { verbose: true });
      return true;
    } catch (error) {
      throw error; // Let the caller handle the error
    }
  }

  async testConnection(bankAccount) {
    try {
      await this.login(bankAccount);
      logger.info(`Connection test successful for bank account ${bankAccount._id}`);
      return true;
    } catch (error) {
      throw error; // Let the caller handle the error
    }
  }

  handleScraperError(error, operation, bankAccountId) {
    let errorMsg = `${operation} failed: `;
    
    if (error.name === 'TimeoutError') {
      errorMsg += 'Bank website is responding too slowly';
    } else if (error.message.includes('Navigation timeout')) {
      errorMsg += 'Bank website failed to load';
    } else if (error.message.includes('Invalid credentials')) {
      errorMsg += 'Invalid bank credentials';
    } else if (error.message.includes('Forbidden') || error.message.includes('403')) {
      errorMsg += 'Access blocked by bank website';
    } else {
      errorMsg += error.message;
    }

    logger.error(`${operation} failed for bank account ${bankAccountId}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Helper method to update scraping status in BankAccount
  async updateScrapingStatus(bankAccountId, statusUpdate) {
    try {
      const { BankAccount } = require('../models');
      const updateData = {};
      
      // Prefix all fields with 'scrapingStatus.'
      Object.keys(statusUpdate).forEach(key => {
        updateData[`scrapingStatus.${key}`] = statusUpdate[key];
      });
      
      await BankAccount.findByIdAndUpdate(bankAccountId, { $set: updateData });
      logger.debug(`Updated scraping status for bank account ${bankAccountId}:`, statusUpdate);
    } catch (error) {
      logger.error(`Failed to update scraping status for bank account ${bankAccountId}:`, error);
      // Don't throw error - scraping should continue even if status update fails
    }
  }

  getScraperInfo() {
    return {
      supportedBanks: ['hapoalim', 'leumi', 'discount', 'otsarHahayal', 'visaCal', 'max', 'isracard'],
      defaultSettings: {
        timeout: this.DEFAULT_TIMEOUT,
        maxRetries: this.MAX_RETRIES,
        retryDelay: this.RETRY_DELAY
      }
    };
  }
}

module.exports = new BankScraperService();
