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
      showBrowser = true,
      verbose = true,
      timeout = this.DEFAULT_TIMEOUT
    } = options;

    // Log the scraping strategy being used
    const isIncrementalScraping = bankAccount.lastScraped;
    logger.info(`Creating scraper for bank account ${bankAccount._id}  with ${isIncrementalScraping ? 'incremental' : 'initial'} scraping from ${startDate.toISOString()}`);

    const scraper = createScraper({
      companyId: bankAccount.bankId,
      verbose,
      showBrowser,
      timeout,
      defaultTimeout: timeout,
      startDate,
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
    while (attempts < this.MAX_RETRIES) {
      try {
        const scraperResult = await scraper.scrape(bankAccount.getScraperOptions().credentials);

        if (!scraperResult.success) {
          const errorType = scraperResult.errorType || 'Unknown';
          const errorMessage = scraperResult.errorMessage || 'No additional error details';
          throw new Error(`Scraping failed: ${errorType} - ${errorMessage}`);
        }

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

        // Return accounts, portfolios (new structure), and investments (legacy)
        return {
          accounts: scraperResult.accounts || [],
          portfolios: scraperResult.portfolios || [],
          investments: scraperResult.investments || []
        };
      } catch (err) {
        error = err;
        attempts++;

        if (attempts < this.MAX_RETRIES) {
          logger.info(`Scraping attempt ${attempts} failed for bank account ${bankAccount._id} with error ${error}, retrying in ${this.RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }

    this.handleScraperError(error, 'Transaction scraping', bankAccount._id);
  }

  // Helper method to extract just investments from scraping result
  async scrapeInvestments(bankAccount, options = {}) {
    const result = await this.scrapeTransactions(bankAccount, options);
    return result.investments || [];
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
