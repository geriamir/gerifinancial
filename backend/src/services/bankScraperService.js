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
    const {
      startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // Last 6 months by default
      showBrowser = false,
      verbose = false,
      timeout = this.DEFAULT_TIMEOUT
    } = options;

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

    logger.info(`Starting transaction scraping for bank account ${bankAccount._id}...`);
    while (attempts < this.MAX_RETRIES) {
      try {
        const scraperResult = await scraper.scrape(bankAccount.getScraperOptions().credentials);

        if (!scraperResult.success) {
          const errorType = scraperResult.errorType || 'Unknown';
          const errorMessage = scraperResult.errorMessage || 'No additional error details';
          throw new Error(`Scraping failed: ${errorType} - ${errorMessage}`);
        }

        return scraperResult.accounts;
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

  async validateCredentials(bankId, credentials) {
    // Create a temporary bank account object for validation
    const tempAccount = { 
      bankId, 
      _id: 'validation',
      getScraperOptions: () => ({ credentials: { username: credentials.username, password: credentials.password } })
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
