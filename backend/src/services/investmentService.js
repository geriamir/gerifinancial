const { Investment, InvestmentSnapshot } = require('../models');
const bankScraperService = require('./bankScraperService');
const logger = require('../utils/logger');

class InvestmentService {
  // Process investments from a portfolio (new structure from israeli-bank-scrapers)
  async processPortfolioInvestments(portfolioInvestments, portfolioMongoId, bankAccount) {
    const results = {
      newInvestments: 0,
      updatedInvestments: 0,
      errors: []
    };

    if (!portfolioInvestments || portfolioInvestments.length === 0) {
      return results;
    }

    for (const investmentData of portfolioInvestments) {
      try {
        // Skip investments with missing paperId (required for identification)
        if (!investmentData.paperId) {
          logger.warn(`Skipping investment with missing paperId:`, investmentData);
          continue;
        }

        // Use paperId as the unique identifier
        const accountNumber = investmentData.paperId;
        
        const existingInvestment = await Investment.findOne({
          userId: bankAccount.userId,
          bankAccountId: bankAccount._id,
          portfolioId: portfolioMongoId,
          accountNumber: accountNumber
        });

        // Ensure numeric values are valid numbers, not NaN or undefined
        const quantity = Number(investmentData.amount) || 0;
        const value = Number(investmentData.value) || 0;
        const currentPrice = quantity > 0 ? value / quantity : 0;
        
        const holdingData = {
          symbol: investmentData.symbol || investmentData.paperName || 'UNKNOWN',
          name: investmentData.paperName || investmentData.symbol || 'Unknown Investment',
          quantity: quantity,
          currentPrice: currentPrice,
          marketValue: value,
          currency: investmentData.currency || 'ILS',
          holdingType: 'stock' // Default, could be enhanced based on symbol analysis
        };

        if (existingInvestment) {
          // Update existing investment
          existingInvestment.holdings = [holdingData];
          existingInvestment.calculateMarketValue();
          existingInvestment.lastUpdated = new Date();
          existingInvestment.status = 'active';
          existingInvestment.rawData = investmentData;
          
          await existingInvestment.save();
          results.updatedInvestments++;
          
          logger.info(`Updated investment ${investmentData.symbol} (${accountNumber}) in portfolio ${portfolioMongoId}`);
        } else {
          // Create new investment
          const newInvestment = new Investment({
            userId: bankAccount.userId,
            bankAccountId: bankAccount._id,
            portfolioId: portfolioMongoId,
            accountNumber: accountNumber,
            accountType: 'investment',
            accountName: investmentData.paperName,
            balance: 0,
            currency: investmentData.currency,
            holdings: [holdingData],
            cashBalance: 0,
            status: 'active',
            rawData: investmentData
          });
          
          newInvestment.calculateMarketValue();
          await newInvestment.save();
          results.newInvestments++;
          
          logger.info(`Created new investment ${investmentData.symbol} (${accountNumber}) in portfolio ${portfolioMongoId}`);
        }
      } catch (error) {
        results.errors.push({
          paperId: investmentData.paperId,
          symbol: investmentData.symbol,
          error: error.message
        });
        logger.error(`Error processing portfolio investment ${investmentData.symbol}: ${error.message}`);
      }
    }
    
    return results;
  }

  async processScrapedInvestments(scrapedInvestments, bankAccount) {
    const results = {
      newInvestments: 0,
      updatedInvestments: 0,
      errors: []
    };

    if (!scrapedInvestments || scrapedInvestments.length === 0) {
      logger.info(`No investments found for bank account ${bankAccount._id}`);
      return results;
    }

    // Process and validate investment data using the scraper service
    const processedInvestments = bankScraperService.processInvestmentData(scrapedInvestments);
    
    for (const investmentData of processedInvestments) {
      try {
        const existingInvestment = await Investment.findOne({
          userId: bankAccount.userId,
          bankAccountId: bankAccount._id,
          accountNumber: investmentData.accountNumber
        });

        if (existingInvestment) {
          // Update existing investment
          existingInvestment.balance = investmentData.balance;
          existingInvestment.currency = investmentData.currency;
          existingInvestment.holdings = investmentData.holdings || [];
          existingInvestment.cashBalance = investmentData.cashBalance || 0;
          existingInvestment.accountName = investmentData.accountName || existingInvestment.accountName;
          existingInvestment.accountType = investmentData.accountType || existingInvestment.accountType;
          existingInvestment.rawData = investmentData.rawData;
          existingInvestment.lastUpdated = new Date();
          existingInvestment.status = 'active';
          
          // Calculate total market value from holdings
          existingInvestment.calculateMarketValue();
          
          await existingInvestment.save();
          results.updatedInvestments++;
          
          logger.info(`Updated investment account ${investmentData.accountNumber} for bank account ${bankAccount._id}`);
        } else {
          // Create new investment
          const newInvestment = new Investment({
            userId: bankAccount.userId,
            bankAccountId: bankAccount._id,
            accountNumber: investmentData.accountNumber,
            accountType: investmentData.accountType,
            accountName: investmentData.accountName,
            balance: investmentData.balance,
            currency: investmentData.currency,
            holdings: investmentData.holdings || [],
            cashBalance: investmentData.cashBalance || 0,
            rawData: investmentData.rawData,
            status: 'active'
          });
          
          // Calculate total market value from holdings
          newInvestment.calculateMarketValue();
          
          await newInvestment.save();
          results.newInvestments++;
          
          logger.info(`Created new investment account ${investmentData.accountNumber} for bank account ${bankAccount._id}`);
        }
      } catch (error) {
        results.errors.push({
          accountNumber: investmentData.accountNumber,
          error: error.message
        });
        logger.error(`Error processing investment ${investmentData.accountNumber}: ${error.message}`);
      }
    }
    
    // Create snapshots for all processed investments
    if (results.newInvestments > 0 || results.updatedInvestments > 0) {
      try {
        await this.createSnapshotsAfterScraping(bankAccount);
        logger.info(`Created daily snapshots after processing investments for account ${bankAccount._id}`);
      } catch (error) {
        logger.warn(`Failed to create snapshots after processing: ${error.message}`);
      }
    }
    
    logger.info(`Investment processing completed for account ${bankAccount._id}:`, results);
    return results;
  }

  async getUserInvestments(userId, options = {}) {
    try {
      return await Investment.findByUser(userId, options);
    } catch (error) {
      logger.error(`Error fetching user investments: ${error.message}`);
      throw error;
    }
  }

  async getInvestmentById(investmentId, userId) {
    try {
      const investment = await Investment.findOne({ 
        _id: investmentId, 
        userId 
      }).populate('bankAccountId', 'name bankId');
      
      if (!investment) {
        throw new Error('Investment not found or access denied');
      }
      
      return investment;
    } catch (error) {
      logger.error(`Error fetching investment by ID: ${error.message}`);
      throw error;
    }
  }

  async getPortfolioSummary(userId) {
    try {
      const summary = await Investment.getPortfolioSummary(userId);
      const holdings = await Investment.getHoldingsSummary(userId);
      
      return {
        ...summary,
        topHoldings: holdings.slice(0, 10), // Top 10 holdings by value
        totalHoldings: holdings.length
      };
    } catch (error) {
      logger.error(`Error fetching portfolio summary: ${error.message}`);
      throw error;
    }
  }

  async updateInvestmentPrices(userId, priceUpdates) {
    try {
      const investments = await Investment.findByUser(userId);
      let updatedCount = 0;
      
      for (const investment of investments) {
        let hasUpdates = false;
        
        investment.holdings.forEach(holding => {
          if (priceUpdates[holding.symbol]) {
            holding.currentPrice = priceUpdates[holding.symbol];
            holding.marketValue = holding.quantity * holding.currentPrice;
            hasUpdates = true;
          }
        });
        
        if (hasUpdates) {
          investment.calculateMarketValue();
          investment.lastUpdated = new Date();
          await investment.save();
          updatedCount++;
        }
      }
      
      logger.info(`Updated prices for ${updatedCount} investment accounts for user ${userId}`);
      return updatedCount;
    } catch (error) {
      logger.error(`Error updating investment prices: ${error.message}`);
      throw error;
    }
  }

  async deleteInvestment(investmentId, userId) {
    try {
      const result = await Investment.findOneAndUpdate(
        { _id: investmentId, userId },
        { status: 'closed', lastUpdated: new Date() },
        { new: true }
      );
      
      if (!result) {
        throw new Error('Investment not found or access denied');
      }
      
      logger.info(`Marked investment ${investmentId} as closed for user ${userId}`);
      return result;
    } catch (error) {
      logger.error(`Error deleting investment: ${error.message}`);
      throw error;
    }
  }

  async getInvestmentsByBankAccount(userId, bankAccountId) {
    try {
      return await Investment.findByUser(userId, { bankAccountId });
    } catch (error) {
      logger.error(`Error fetching investments by bank account: ${error.message}`);
      throw error;
    }
  }

  // New method: Create daily snapshot for an investment
  async createDailySnapshot(investment) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day

      // Check if snapshot already exists for today
      const existingSnapshot = await InvestmentSnapshot.findOne({
        investmentId: investment._id,
        date: today
      });

      if (existingSnapshot) {
        // Update existing snapshot
        return this.updateSnapshot(existingSnapshot, investment);
      }

      // Calculate day change from yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const yesterdaySnapshot = await InvestmentSnapshot.findOne({
        investmentId: investment._id,
        date: yesterday
      });

      const totalValue = investment.totalValue || (investment.balance + investment.totalMarketValue + investment.cashBalance);
      const dayChange = yesterdaySnapshot 
        ? totalValue - yesterdaySnapshot.totalValue
        : 0;
      
      const dayChangePercent = yesterdaySnapshot && yesterdaySnapshot.totalValue > 0
        ? (dayChange / yesterdaySnapshot.totalValue) * 100
        : 0;

      // Create new snapshot
      const snapshot = new InvestmentSnapshot({
        userId: investment.userId,
        investmentId: investment._id,
        bankAccountId: investment.bankAccountId,
        date: today,
        totalValue: totalValue,
        totalMarketValue: investment.totalMarketValue || 0,
        cashBalance: investment.cashBalance || 0,
        balance: investment.balance || 0,
        currency: investment.currency,
        holdings: investment.holdings.map(holding => ({
          symbol: holding.symbol,
          name: holding.name,
          quantity: holding.quantity,
          price: holding.currentPrice,
          marketValue: holding.marketValue,
          currency: holding.currency,
          sector: holding.sector,
          holdingType: holding.holdingType
        })),
        dayChange,
        dayChangePercent,
        rawData: investment.rawData
      });

      await snapshot.save();
      logger.info(`Created daily snapshot for investment ${investment._id} on ${today.toISOString().split('T')[0]}`);
      return snapshot;
    } catch (error) {
      logger.error(`Error creating daily snapshot for investment ${investment._id}: ${error.message}`);
      throw error;
    }
  }

  // Helper method: Update existing snapshot
  async updateSnapshot(existingSnapshot, investment) {
    try {
      const totalValue = investment.totalValue || (investment.balance + investment.totalMarketValue + investment.cashBalance);
      
      // Recalculate day change if total value changed
      if (existingSnapshot.totalValue !== totalValue) {
        const yesterday = new Date(existingSnapshot.date);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const yesterdaySnapshot = await InvestmentSnapshot.findOne({
          investmentId: investment._id,
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

      // Update snapshot with current investment data
      existingSnapshot.totalValue = totalValue;
      existingSnapshot.totalMarketValue = investment.totalMarketValue || 0;
      existingSnapshot.cashBalance = investment.cashBalance || 0;
      existingSnapshot.balance = investment.balance || 0;
      existingSnapshot.currency = investment.currency;
      existingSnapshot.holdings = investment.holdings.map(holding => ({
        symbol: holding.symbol,
        name: holding.name,
        quantity: holding.quantity,
        price: holding.currentPrice,
        marketValue: holding.marketValue,
        currency: holding.currency,
        sector: holding.sector,
        holdingType: holding.holdingType
      }));
      existingSnapshot.rawData = investment.rawData;

      await existingSnapshot.save();
      logger.info(`Updated daily snapshot for investment ${investment._id}`);
      return existingSnapshot;
    } catch (error) {
      logger.error(`Error updating snapshot: ${error.message}`);
      throw error;
    }
  }

  // Historical data methods
  async getInvestmentHistory(investmentId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      
      return await InvestmentSnapshot.getHistoricalValues(investmentId, startDate);
    } catch (error) {
      logger.error(`Error fetching investment history: ${error.message}`);
      throw error;
    }
  }

  async getPortfolioTrends(userId, days = 30) {
    try {
      return await InvestmentSnapshot.getPortfolioHistory(userId, days);
    } catch (error) {
      logger.error(`Error fetching portfolio trends: ${error.message}`);
      throw error;
    }
  }

  async getPerformanceMetrics(userId, days = 30) {
    try {
      return await InvestmentSnapshot.getPerformanceMetrics(userId, days);
    } catch (error) {
      logger.error(`Error fetching performance metrics: ${error.message}`);
      throw error;
    }
  }

  async getHoldingsHistory(userId, symbol, days = 90) {
    try {
      return await InvestmentSnapshot.getHoldingsHistory(userId, symbol, days);
    } catch (error) {
      logger.error(`Error fetching holdings history: ${error.message}`);
      throw error;
    }
  }

  // Create snapshots for all investments after scraping
  async createSnapshotsAfterScraping(bankAccount) {
    try {
      const investments = await Investment.findByUser(bankAccount.userId, { 
        bankAccountId: bankAccount._id 
      });
      
      const snapshotResults = [];
      for (const investment of investments) {
        try {
          const snapshot = await this.createDailySnapshot(investment);
          snapshotResults.push({ investmentId: investment._id, success: true, snapshot });
        } catch (error) {
          logger.warn(`Failed to create snapshot for investment ${investment._id}: ${error.message}`);
          snapshotResults.push({ investmentId: investment._id, success: false, error: error.message });
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

module.exports = new InvestmentService();
