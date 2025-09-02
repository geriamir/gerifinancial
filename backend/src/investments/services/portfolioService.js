const { Portfolio, PortfolioSnapshot } = require('../../shared/models');
const logger = require('../../shared/utils/logger');

class PortfolioService {
  async processScrapedPortfolios(scrapedPortfolios, bankAccount) {
    const results = {
      newPortfolios: 0,
      updatedPortfolios: 0,
      errors: [],
      aggregatedInvestmentResults: { newInvestments: 0, updatedInvestments: 0, errors: [] }
    };

    if (!scrapedPortfolios || scrapedPortfolios.length === 0) {
      logger.info(`No portfolios found for bank account ${bankAccount._id}`);
      return results;
    }

    // Process and validate portfolio data
    const processedPortfolios = await this.processPortfolioData(scrapedPortfolios, bankAccount);
    
    for (const portfolioData of processedPortfolios) {
      try {
        // Aggregate investment results from this portfolio
        if (portfolioData.investmentResults) {
          results.aggregatedInvestmentResults.newInvestments += portfolioData.investmentResults.newInvestments || 0;
          results.aggregatedInvestmentResults.updatedInvestments += portfolioData.investmentResults.updatedInvestments || 0;
          results.aggregatedInvestmentResults.errors.push(...(portfolioData.investmentResults.errors || []));
        }

        const existingPortfolio = await Portfolio.findOne({
          userId: bankAccount.userId,
          bankAccountId: bankAccount._id,
          portfolioId: portfolioData.portfolioId
        });

        if (portfolioData.isExisting) {
          // Update existing portfolio (already found in processPortfolioData)
          const existingPortfolio = await Portfolio.findById(portfolioData.portfolioMongoId);
          await this.updatePortfolio(existingPortfolio, portfolioData);
          results.updatedPortfolios++;
          
          logger.info(`Updated portfolio ${portfolioData.portfolioId} for bank account ${bankAccount._id}`);
        } else {
          // Portfolio was already created in processPortfolioData, just count it
          results.newPortfolios++;
          
          logger.info(`Created new portfolio ${portfolioData.portfolioId} for bank account ${bankAccount._id}`);
        }
      } catch (error) {
        results.errors.push({
          portfolioId: portfolioData.portfolioId,
          error: error.message
        });
        logger.error(`Error processing portfolio ${portfolioData.portfolioId}: ${error.message}`);
      }
    }
    
    // Create snapshots for all processed portfolios
    if (results.newPortfolios > 0 || results.updatedPortfolios > 0) {
      try {
        await this.createSnapshotsAfterScraping(bankAccount);
        logger.info(`Created daily snapshots after processing portfolios for account ${bankAccount._id}`);
      } catch (error) {
        logger.warn(`Failed to create snapshots after processing: ${error.message}`);
      }
    }
    
    logger.info(`Portfolio processing completed for account ${bankAccount._id}:`, results);
    return results;
  }

  // Helper method to process and validate portfolio data from scraper
  async processPortfolioData(portfolios, bankAccount) {
    if (!portfolios || !Array.isArray(portfolios)) {
      return [];
    }

    const processedPortfolios = [];
    
    for (const portfolio of portfolios) {
      if (!this.validatePortfolioData(portfolio)) continue;
      
      const externalPortfolioId = portfolio.portfolioId || portfolio.paperId?.toString() || portfolio.accountNumber;
      
      // First, create/find the portfolio document to get the MongoDB _id
      const existingPortfolio = await Portfolio.findOne({
        userId: bankAccount.userId,
        bankAccountId: bankAccount._id,
        portfolioId: externalPortfolioId
      });

      let portfolioMongoId;
      if (existingPortfolio) {
        portfolioMongoId = existingPortfolio._id;
      } else {
        // Create a temporary portfolio document to get the _id
        const tempPortfolio = new Portfolio({
          userId: bankAccount.userId,
          bankAccountId: bankAccount._id,
          portfolioId: externalPortfolioId,
          portfolioName: portfolio.portfolioName || portfolio.name || '',
          accountNumber: portfolio.accountNumber || portfolio.paperId?.toString(),
          portfolioType: this.mapPortfolioType(portfolio.type || portfolio.accountType),
          totalValue: portfolio.totalValue || portfolio.value || 0,
          cashBalance: portfolio.cashBalance || portfolio.cash || 0,
          currency: portfolio.currency || 'ILS',
          rawData: portfolio,
          status: 'active'
        });
        const savedPortfolio = await tempPortfolio.save();
        portfolioMongoId = savedPortfolio._id;
      }
      
      // Process investments through investment service with the portfolio MongoDB _id
      const investmentProcessing = await this.processInvestmentsData(
        portfolio.investments || [],
        portfolioMongoId,
        bankAccount
      );
      
      processedPortfolios.push({
        portfolioId: externalPortfolioId,
        portfolioMongoId: portfolioMongoId,
        portfolioName: portfolio.portfolioName || portfolio.name || '',
        accountNumber: portfolio.accountNumber || portfolio.paperId?.toString(),
        portfolioType: this.mapPortfolioType(portfolio.type || portfolio.accountType),
        totalValue: portfolio.totalValue || portfolio.value || 0,
        cashBalance: portfolio.cashBalance || portfolio.cash || 0,
        currency: portfolio.currency || 'ILS',
        investmentResults: investmentProcessing.investmentResults,
        rawData: portfolio,
        isExisting: !!existingPortfolio
      });
    }
    
    return processedPortfolios;
  }

  // Helper method to validate portfolio data structure
  validatePortfolioData(portfolio) {
    // Check if portfolio has required identifiers
    const hasId = portfolio.portfolioId || portfolio.paperId || portfolio.accountNumber;
    
    if (!hasId) {
      logger.warn(`Portfolio data missing required identifier fields`);
      return false;
    }

    return true;
  }

  // Helper method to map portfolio types from scraper to our enum
  mapPortfolioType(type) {
    if (!type) return 'investment';
    
    const typeMap = {
      'investment': 'investment',
      'pension': 'pension',
      'savings': 'savings',
      'managed': 'managed',
      'self_directed': 'self_directed',
      'portfolio': 'investment'
    };
    
    return typeMap[type.toLowerCase()] || 'other';
  }

  // Delegate investment processing to investment service
  async processInvestmentsData(investments, portfolioMongoId, bankAccount) {
    const investmentService = require('./investmentService');
    
    if (!investments || !Array.isArray(investments)) {
      return { newInvestments: 0, updatedInvestments: 0, errors: [] };
    }

    // Delegate to investment service to handle persistence with portfolio MongoDB _id
    const results = await investmentService.processPortfolioInvestments(investments, portfolioMongoId, bankAccount);
    
    return {
      investmentResults: results
    };
  }

  // Helper method to map investment types from scraper to our enum
  mapInvestmentType(type) {
    if (!type) return 'stock';
    
    const typeMap = {
      'stock': 'stock',
      'bond': 'bond',
      'etf': 'etf',
      'mutual_fund': 'mutual_fund',
      'commodity': 'commodity',
      'cash': 'cash'
    };
    
    return typeMap[type.toLowerCase()] || 'other';
  }

  // Helper method to create a new portfolio
  async createPortfolio(portfolioData, bankAccount) {
    const newPortfolio = new Portfolio({
      userId: bankAccount.userId,
      bankAccountId: bankAccount._id,
      portfolioId: portfolioData.portfolioId,
      portfolioName: portfolioData.portfolioName,
      accountNumber: portfolioData.accountNumber,
      portfolioType: portfolioData.portfolioType,
      totalValue: portfolioData.totalValue,
      cashBalance: portfolioData.cashBalance,
      currency: portfolioData.currency,
      rawData: portfolioData.rawData,
      status: 'active'
    });
    
    await newPortfolio.save();
    return newPortfolio;
  }

  // Helper method to update an existing portfolio
  async updatePortfolio(existingPortfolio, portfolioData) {
    existingPortfolio.portfolioName = portfolioData.portfolioName || existingPortfolio.portfolioName;
    existingPortfolio.accountNumber = portfolioData.accountNumber || existingPortfolio.accountNumber;
    existingPortfolio.portfolioType = portfolioData.portfolioType || existingPortfolio.portfolioType;
    existingPortfolio.totalValue = portfolioData.totalValue;
    existingPortfolio.cashBalance = portfolioData.cashBalance;
    existingPortfolio.currency = portfolioData.currency;
    existingPortfolio.rawData = portfolioData.rawData;
    existingPortfolio.lastUpdated = new Date();
    existingPortfolio.status = 'active';
    
    await existingPortfolio.save();
    return existingPortfolio;
  }

  async getUserPortfolios(userId, options = {}) {
    try {
      return await Portfolio.findByUser(userId, options);
    } catch (error) {
      logger.error(`Error fetching user portfolios: ${error.message}`);
      throw error;
    }
  }

  async getPortfolioById(portfolioId, userId) {
    try {
      const portfolio = await Portfolio.findOne({ 
        _id: portfolioId, 
        userId 
      }).populate('bankAccountId', 'name bankId');
      
      if (!portfolio) {
        throw new Error('Portfolio not found or access denied');
      }
      
      return portfolio;
    } catch (error) {
      logger.error(`Error fetching portfolio by ID: ${error.message}`);
      throw error;
    }
  }

  async getPortfolioSummary(userId) {
    try {
      const summary = await Portfolio.getPortfolioSummary(userId);
      const investments = await Portfolio.getInvestmentsSummary(userId);
      const allocation = await Portfolio.getInvestmentAllocation(userId);
      const sectorAllocation = await Portfolio.getSectorAllocation(userId);
      
      return {
        ...summary,
        topInvestments: investments.slice(0, 10), // Top 10 investments by value
        totalInvestments: investments.length,
        allocation,
        sectorAllocation
      };
    } catch (error) {
      logger.error(`Error fetching portfolio summary: ${error.message}`);
      throw error;
    }
  }

  async updatePortfolioPrices(userId, priceUpdates) {
    try {
      const portfolios = await Portfolio.findByUser(userId);
      let updatedCount = 0;
      
      for (const portfolio of portfolios) {
        const hasUpdates = portfolio.updateInvestmentPrices(priceUpdates);
        
        if (hasUpdates) {
          await portfolio.save();
          updatedCount++;
        }
      }
      
      logger.info(`Updated prices for ${updatedCount} portfolios for user ${userId}`);
      return updatedCount;
    } catch (error) {
      logger.error(`Error updating portfolio prices: ${error.message}`);
      throw error;
    }
  }

  async deletePortfolio(portfolioId, userId) {
    try {
      const result = await Portfolio.findOneAndUpdate(
        { _id: portfolioId, userId },
        { status: 'closed', lastUpdated: new Date() },
        { new: true }
      );
      
      if (!result) {
        throw new Error('Portfolio not found or access denied');
      }
      
      logger.info(`Marked portfolio ${portfolioId} as closed for user ${userId}`);
      return result;
    } catch (error) {
      logger.error(`Error deleting portfolio: ${error.message}`);
      throw error;
    }
  }

  async getPortfoliosByBankAccount(userId, bankAccountId) {
    try {
      return await Portfolio.findByUser(userId, { bankAccountId });
    } catch (error) {
      logger.error(`Error fetching portfolios by bank account: ${error.message}`);
      throw error;
    }
  }

  // New method: Create daily snapshot for a portfolio
  async createDailySnapshot(portfolio) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day

      // Check if snapshot already exists for today
      const existingSnapshot = await PortfolioSnapshot.findOne({
        portfolioId: portfolio._id,
        date: today
      });

      if (existingSnapshot) {
        // Update existing snapshot
        return this.updateSnapshot(existingSnapshot, portfolio);
      }

      // Calculate day change from yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdaySnapshot = await PortfolioSnapshot.findOne({
        portfolioId: portfolio._id,
        date: yesterday
      });

      const totalValue = portfolio.totalValue || 0;
      const dayChange = yesterdaySnapshot 
        ? totalValue - yesterdaySnapshot.totalValue
        : 0;
      
      const dayChangePercent = yesterdaySnapshot && yesterdaySnapshot.totalValue > 0
        ? (dayChange / yesterdaySnapshot.totalValue) * 100
        : 0;

      // Create new snapshot
      const snapshot = new PortfolioSnapshot({
        userId: portfolio.userId,
        portfolioId: portfolio._id,
        bankAccountId: portfolio.bankAccountId,
        date: today,
        totalValue: totalValue,
        totalMarketValue: portfolio.totalMarketValue || 0,
        cashBalance: portfolio.cashBalance || 0,
        currency: portfolio.currency,
        investments: portfolio.investments.map(investment => ({
          symbol: investment.symbol,
          name: investment.name,
          quantity: investment.quantity,
          price: investment.currentPrice,
          marketValue: investment.marketValue,
          currency: investment.currency,
          sector: investment.sector,
          investmentType: investment.investmentType
        })),
        dayChange,
        dayChangePercent,
        rawData: portfolio.rawData
      });

      await snapshot.save();
      logger.info(`Created daily snapshot for portfolio ${portfolio._id} on ${today.toISOString().split('T')[0]}`);
      return snapshot;
    } catch (error) {
      logger.error(`Error creating daily snapshot for portfolio ${portfolio._id}: ${error.message}`);
      throw error;
    }
  }

  // Helper method: Update existing snapshot
  async updateSnapshot(existingSnapshot, portfolio) {
    try {
      const totalValue = portfolio.totalValue || 0;
      
      // Recalculate day change if total value changed
      if (existingSnapshot.totalValue !== totalValue) {
        const yesterday = new Date(existingSnapshot.date);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const yesterdaySnapshot = await PortfolioSnapshot.findOne({
          portfolioId: portfolio._id,
          date: yesterday
        });

        const dayChange = yesterdaySnapshot 
          ? totalValue - yesterdaySnapshot.totalValue
          : 0;
        
        const dayChangePercent = yesterdaySnapshot && yesterdaySnapshot.totalValue > 0
          ? (dayChange / yesterdaySnapshot.totalValue) * 100
          : 0;

        existingSnapshot.dayChange = dayChange;
        existingSnapshot.dayChangePercent = dayChangePercent;
      }

      // Update snapshot with current portfolio data
      existingSnapshot.totalValue = totalValue;
      existingSnapshot.totalMarketValue = portfolio.totalMarketValue || 0;
      existingSnapshot.cashBalance = portfolio.cashBalance || 0;
      existingSnapshot.currency = portfolio.currency;
      existingSnapshot.investments = portfolio.investments.map(investment => ({
        symbol: investment.symbol,
        name: investment.name,
        quantity: investment.quantity,
        price: investment.currentPrice,
        marketValue: investment.marketValue,
        currency: investment.currency,
        sector: investment.sector,
        investmentType: investment.investmentType
      }));
      existingSnapshot.rawData = portfolio.rawData;

      await existingSnapshot.save();
      logger.info(`Updated daily snapshot for portfolio ${portfolio._id}`);
      return existingSnapshot;
    } catch (error) {
      logger.error(`Error updating snapshot: ${error.message}`);
      throw error;
    }
  }

  // Historical data methods
  async getPortfolioHistory(portfolioId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      
      return await PortfolioSnapshot.getHistoricalValues(portfolioId, startDate);
    } catch (error) {
      logger.error(`Error fetching portfolio history: ${error.message}`);
      throw error;
    }
  }

  async getPortfolioTrends(userId, days = 30) {
    try {
      return await PortfolioSnapshot.getPortfolioHistory(userId, days);
    } catch (error) {
      logger.error(`Error fetching portfolio trends: ${error.message}`);
      throw error;
    }
  }

  async getPerformanceMetrics(userId, days = 30) {
    try {
      return await PortfolioSnapshot.getPerformanceMetrics(userId, days);
    } catch (error) {
      logger.error(`Error fetching performance metrics: ${error.message}`);
      throw error;
    }
  }

  async getInvestmentsHistory(userId, symbol, days = 90) {
    try {
      return await PortfolioSnapshot.getInvestmentsHistory(userId, symbol, days);
    } catch (error) {
      logger.error(`Error fetching investments history: ${error.message}`);
      throw error;
    }
  }

  // Create snapshots for all portfolios after scraping
  async createSnapshotsAfterScraping(bankAccount) {
    try {
      const portfolios = await Portfolio.findByUser(bankAccount.userId, { 
        bankAccountId: bankAccount._id 
      });
      
      const snapshotResults = [];
      for (const portfolio of portfolios) {
        try {
          const snapshot = await this.createDailySnapshot(portfolio);
          snapshotResults.push({ portfolioId: portfolio._id, success: true, snapshot });
        } catch (error) {
          logger.warn(`Failed to create snapshot for portfolio ${portfolio._id}: ${error.message}`);
          snapshotResults.push({ portfolioId: portfolio._id, success: false, error: error.message });
        }
      }
      
      logger.info(`Created ${snapshotResults.filter(r => r.success).length}/${snapshotResults.length} snapshots for bank account ${bankAccount._id}`);
      return snapshotResults;
    } catch (error) {
      logger.error(`Error creating snapshots after scraping: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new PortfolioService();
