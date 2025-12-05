const { BaseSyncStrategy, bankScraperService } = require('../../../banking');
const logger = require('../../../shared/utils/logger');
const portfolioService = require('../portfolioService');
const investmentService = require('../investmentService');

/**
 * Sync strategy for investment portfolios and transactions
 */
class PortfoliosSyncStrategy extends BaseSyncStrategy {
  constructor() {
    super({
      name: 'portfolios',
      displayName: 'Investment Portfolios',
      icon: '📈',
      scrapingMethod: 'scrapePortfolios',
      statusUpdates: {
        start: { progress: 40, message: 'Downloading investment portfolios...' },
        error: (error) => ({ progress: 0, message: `Portfolio sync failed: ${error}` })
      }
    });
  }

  /**
   * Check if the scraper supports portfolio scraping
   */
  isSupported(scraper) {
    return scraper.doesSupportPortfolios();
  }

  /**
   * Get empty result structure for portfolios
   */
  getEmptyResult() {
    return {
      portfolios: { newPortfolios: 0, updatedPortfolios: 0, errors: [] },
      investments: { newInvestments: 0, updatedInvestments: 0, errors: [] },
      investmentTransactions: { newTransactions: 0, errors: [] }
    };
  }

  /**
   * Process scraped portfolio data
   */
  async processScrapedData(scrapingResult, bankAccount, context) {
    const portfolios = scrapingResult.portfolios || [];
    
    // Process portfolios
    let portfolioResults = { newPortfolios: 0, updatedPortfolios: 0, errors: [] };
    let investmentResults = { newInvestments: 0, updatedInvestments: 0, errors: [] };
    
    if (portfolios.length > 0) {
      logger.info(`Processing ${portfolios.length} portfolios`);
      
      portfolioResults = await portfolioService.processScrapedPortfolios(portfolios, bankAccount);
      
      if (portfolioResults.aggregatedInvestmentResults) {
        investmentResults = portfolioResults.aggregatedInvestmentResults;
      }
    }
    
    // Process investment transactions
    let investmentTransactionResults = { newTransactions: 0, errors: [] };
    
    const investmentTransactions = bankScraperService.extractInvestmentTransactions(portfolios);
    
    if (investmentTransactions.length > 0) {
      logger.info(`Processing ${investmentTransactions.length} investment transactions`);
      
      investmentTransactionResults = await investmentService.processPortfolioTransactions(
        investmentTransactions, 
        bankAccount
      );
    }
    
    return {
      portfolios: portfolioResults,
      investments: investmentResults,
      investmentTransactions: investmentTransactionResults
    };
  }
}

module.exports = PortfoliosSyncStrategy;
