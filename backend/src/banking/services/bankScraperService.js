const scraperModule = ['test', 'e2e'].includes(process.env.NODE_ENV)
  ? require('../../test/mocks/bankScraper')
  : require('israeli-bank-scrapers');

const { createScraper } = scraperModule;
const logger = require('../../shared/utils/logger');
const { BankAccount } = require('../models');
const { resolveStartDate } = require('../utils/scraperDates');
const { getScraperErrorMessage } = require('../utils/scraperErrors');
const { toIsoCurrency } = require('../utils/currency');


class BankScraperService {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 5000; // 5 seconds
    this.DEFAULT_TIMEOUT = 210000; // 3 minutes
  }

  // Chrome cannot use its sandbox inside a container, and /dev/shm is too small there
  // by default, which crashes the renderer on heavy pages.
  getBrowserArgs() {
    if (process.env.PUPPETEER_ARGS) {
      return process.env.PUPPETEER_ARGS.split(',')
        .map(arg => arg.trim())
        .filter(Boolean);
    }

    if (process.env.NODE_ENV === 'production') {
      return ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    }

    return [];
  }

  // Helper method to normalize currency symbols to ISO codes
  normalizeCurrency(currency) {
    return toIsoCurrency(currency, 'ILS');
  }

  createScraper(bankAccount, options = {}) {
    // Get smart start date from bank account (uses lastScraped if available, otherwise 12 months back)
    const {
      startDate = resolveStartDate(bankAccount.lastScraped),
      showBrowser = false,
      verbose = false,
      timeout = this.DEFAULT_TIMEOUT
    } = options;

    // Create a copy to avoid mutating the input parameter
    const startDateCopy = new Date(startDate);
    // Scan a week back to catch transactions that clear out of order
    startDateCopy.setDate(startDateCopy.getDate() - 7);

    // Log the scraping strategy being used
    const isIncrementalScraping = !!startDate;
    logger.info(`Creating scraper for bank account ${bankAccount._id} with ${isIncrementalScraping ? 'incremental' : 'initial'} scraping from ${startDateCopy.toISOString()} (base date: ${new Date(startDate).toISOString()})`);

    const scraper = createScraper({
      companyId: bankAccount.bankId,
      verbose,
      showBrowser,
      timeout,
      defaultTimeout: timeout,
      startDate: startDateCopy,
      combineInstallments: false,
      excludePendingTransactions: true,
      args: this.getBrowserArgs()
    });
    
    return scraper;
  }

  async login(bankAccount, options = {}) {
    const { credentials } = await bankAccount.getScraperOptions();
    let attempts = 0;
    let error = null;

    while (attempts < this.MAX_RETRIES) {
      const scraper = this.createScraper(bankAccount, options);

      try {
        await scraper.initialize();
        const loginResult = await scraper.login(credentials);

        if (loginResult !== true && loginResult?.success !== true) {
          throw new Error(getScraperErrorMessage(loginResult));
        }

        logger.info(`Successfully logged in to bank account ${bankAccount._id}`);
        return scraper;
      } catch (err) {
        error = err;
        attempts++;
        await this.terminateScraper(scraper, false);
        
        if (attempts < this.MAX_RETRIES) {
          logger.info(`Login attempt ${attempts} failed for bank account ${bankAccount._id}, retrying in ${this.RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    this.handleScraperError(error, 'Login', bankAccount._id);
  }

  async terminateScraper(scraper, success) {
    if (typeof scraper?.terminate !== 'function') {
      return;
    }

    try {
      await scraper.terminate(success);
    } catch (error) {
      logger.warn(`Failed to terminate scraper cleanly: ${error.message}`);
    }
  }

  // REMOVED: Old comprehensive scrapeTransactions method
  // Use dataSyncService.syncBankAccountData() or isolated sync methods instead

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
      const normalizedCurrency = this.normalizeCurrency(foreignAccount.currency);
      const processedAccount = {
        originalAccountNumber: foreignAccount.accountNumber,
        currency: normalizedCurrency,
        accountType: foreignAccount.type === 'foreignCurrency' ? 'checking' : (foreignAccount.type || 'checking'),
        balance: foreignAccount.balance || 0,
        transactionCount: (foreignAccount.txns || []).length,
        transactions: (foreignAccount.txns || []).map(txn => ({
          identifier: txn.identifier || `${txn.date}_${txn.chargedAmount}_${normalizedCurrency}`,
          date: txn.date,
          amount: txn.chargedAmount || txn.originalAmount || 0,
          currency: normalizedCurrency,
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
          const normalizedCurrency = this.normalizeCurrency(currency);
          const foreignCurrencyTransactions = account.txns.filter(txn => 
            txn.originalCurrency === currency || 
            (txn.currency === currency && currency !== 'ILS')
          );

          if (foreignCurrencyTransactions.length > 0) {
            foreignCurrencyAccounts.push({
              originalAccountNumber: account.accountNumber,
              currency: normalizedCurrency,
              accountType: account.type || 'checking',
              balance: this.calculateForeignCurrencyBalance(foreignCurrencyTransactions),
              transactionCount: foreignCurrencyTransactions.length,
              transactions: foreignCurrencyTransactions.map(txn => ({
                identifier: txn.identifier || `${txn.date}_${txn.chargedAmount}_${normalizedCurrency}`,
                date: txn.date,
                amount: txn.originalAmount || txn.chargedAmount,
                currency: normalizedCurrency,
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
        const normalizedAccountCurrency = this.normalizeCurrency(account.currency);
        const existingForeignAccount = foreignCurrencyAccounts.find(
          fca => fca.originalAccountNumber === account.accountNumber && fca.currency === normalizedAccountCurrency
        );

        if (!existingForeignAccount) {
          foreignCurrencyAccounts.push({
            originalAccountNumber: account.accountNumber,
            currency: normalizedAccountCurrency,
            accountType: account.type || 'checking',
            balance: account.balance || 0,
            transactionCount: (account.txns || []).length,
            transactions: (account.txns || []).map(txn => ({
              identifier: txn.identifier || `${txn.date}_${txn.chargedAmount}_${normalizedAccountCurrency}`,
              date: txn.date,
              amount: txn.chargedAmount,
              currency: normalizedAccountCurrency,
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

  // NEW: Process foreign currency accounts from dedicated scraping method
  processForeignCurrencyAccounts(foreignCurrencyAccounts) {
    if (!foreignCurrencyAccounts || !Array.isArray(foreignCurrencyAccounts)) {
      return [];
    }

    const processedAccounts = [];

    foreignCurrencyAccounts.forEach(foreignAccount => {
      if (!foreignAccount || !foreignAccount.accountNumber || !foreignAccount.currency) {
        logger.warn(`Skipping invalid foreign currency account:`, foreignAccount);
        return;
      }

      // Process foreign currency account from dedicated scraping method
      const normalizedCurrency = this.normalizeCurrency(foreignAccount.currency);
      const processedAccount = {
        originalAccountNumber: foreignAccount.accountNumber,
        currency: normalizedCurrency,
        accountType: foreignAccount.type || 'checking',
        balance: foreignAccount.balance || 0,
        transactionCount: (foreignAccount.txns || []).length,
        transactions: (foreignAccount.txns || []).map(txn => ({
          identifier: txn.identifier || `${txn.date}_${txn.chargedAmount}_${normalizedCurrency}`,
          date: txn.date,
          amount: txn.chargedAmount || txn.originalAmount || 0,
          currency: normalizedCurrency,
          originalAmount: txn.originalAmount || txn.chargedAmount, // Amount in original currency
          exchangeRate: txn.originalCurrency && txn.originalAmount && txn.chargedAmount ? 
            Math.abs(txn.chargedAmount / txn.originalAmount) : null,
          description: txn.description,
          memo: txn.memo,
          rawData: txn
        })),
        rawAccountData: foreignAccount,
        source: 'dedicated' // Mark as coming from dedicated foreign currency scraping
      };

      processedAccounts.push(processedAccount);
    });

    if (processedAccounts.length > 0) {
      logger.info(`Processed ${processedAccounts.length} foreign currency accounts with currencies: ${[...new Set(processedAccounts.map(fca => fca.currency))].join(', ')}`);
    }

    return processedAccounts;
  }

  async validateCredentials(bankId, credentials) {
    // Create a temporary bank account object for validation
    const tempAccount = { 
      bankId, 
      _id: 'validation',
      lastScraped: null,
      getScraperOptions: () => ({ 
        credentials,
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // 6 months back for validation
      })
    };
    
    let scraper;
    try {
      scraper = await this.login(tempAccount, { verbose: true });
      return true;
    } finally {
      if (scraper) {
        await this.terminateScraper(scraper, true);
      }
    }
  }

  async testConnection(bankAccount) {
    let scraper;
    try {
      scraper = await this.login(bankAccount);
      logger.info(`Connection test successful for bank account ${bankAccount._id}`);
      return true;
    } finally {
      if (scraper) {
        await this.terminateScraper(scraper, true);
      }
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
      const updateData = {};
      
      // Prefix all fields with 'scrapingStatus.'
      Object.keys(statusUpdate).forEach(key => {
        updateData[`scrapingStatus.${key}`] = statusUpdate[key];
      });
      
      const result = await BankAccount.findByIdAndUpdate(
        bankAccountId, 
        { $set: updateData },
        { new: false, runValidators: false }
      );
      
      if (!result) {
        logger.warn(`Bank account ${bankAccountId} not found when updating scraping status - account may have been deleted`);
        return;
      }
      
      logger.debug(`Updated scraping status for bank account ${bankAccountId}:`, statusUpdate);
    } catch (error) {
      logger.error(`Failed to update scraping status for bank account ${bankAccountId}:`, error);
      // Don't throw error - scraping should continue even if status update fails
    }
  }

  getScraperInfo() {
    return {
      supportedBanks: ['hapoalim', 'leumi', 'discount', 'otsarHahayal', 'visaCal', 'max', 'isracard', 'amex'],
      defaultSettings: {
        timeout: this.DEFAULT_TIMEOUT,
        maxRetries: this.MAX_RETRIES,
        retryDelay: this.RETRY_DELAY
      }
    };
  }
}

module.exports = new BankScraperService();
