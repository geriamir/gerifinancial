const { Investment, InvestmentSnapshot, InvestmentTransaction } = require('../models');
const bankScraperService = require('./bankScraperService');
const INVESTMENT_CONSTANTS = require('../constants/investmentConstants');
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

        // Ensure numeric values are valid finite numbers, not NaN, undefined, or Infinity
        const quantity = Number.isFinite(Number(investmentData.amount)) ? Number(investmentData.amount) : 0;
        const value = Number.isFinite(Number(investmentData.value)) ? Number(investmentData.value) : 0;
        const currentPrice = quantity > 0 ? value / quantity : 0;
        
        const holdingData = {
          symbol: investmentData.symbol || investmentData.paperName || INVESTMENT_CONSTANTS.FALLBACK_SYMBOLS.UNKNOWN_SYMBOL,
          name: investmentData.paperName || investmentData.symbol || INVESTMENT_CONSTANTS.FALLBACK_SYMBOLS.PLACEHOLDER_NAME,
          quantity: quantity,
          currentPrice: currentPrice,
          marketValue: value,
          currency: investmentData.currency || INVESTMENT_CONSTANTS.DEFAULT_CURRENCY,
          holdingType: INVESTMENT_CONSTANTS.HOLDING_TYPES.STOCK // Default, could be enhanced based on symbol analysis
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

  // === NEW INVESTMENT TRANSACTION METHODS ===

  // Process investment transactions from scraped portfolio data
  async processPortfolioTransactions(investmentTransactions, bankAccount) {
    const results = {
      newTransactions: 0,
      updatedTransactions: 0,
      duplicatesSkipped: 0,
      errors: []
    };

    if (!investmentTransactions || investmentTransactions.length === 0) {
      logger.info(`No investment transactions found for bank account ${bankAccount._id}`);
      return results;
    }

    // Get all investments for this bank account to link transactions
    const investments = await Investment.findByUser(bankAccount.userId, { 
      bankAccountId: bankAccount._id 
    });

    // Create a map for quick investment lookup by paperId
    const investmentMap = new Map();
    investments.forEach(investment => {
      if (investment.holdings && investment.holdings.length > 0) {
        investment.holdings.forEach(holding => {
          if (holding.paperId) {
            investmentMap.set(holding.paperId, investment);
          }
        });
      }
      // Also try to match by account number if it matches paperId
      if (investment.accountNumber) {
        investmentMap.set(investment.accountNumber, investment);
      }
    });

    for (const transactionData of investmentTransactions) {
      try {
        // Find matching investment by paperId
        const matchingInvestment = investmentMap.get(transactionData.paperId);
        
        if (!matchingInvestment) {
          logger.warn(`No matching investment found for paperId: ${transactionData.paperId}, symbol: ${transactionData.symbol}`);
          results.errors.push({
            paperId: transactionData.paperId,
            symbol: transactionData.symbol,
            error: 'No matching investment account found'
          });
          continue;
        }

        // Check for existing transaction to prevent duplicates
        const existingTransaction = await InvestmentTransaction.findOne({
          userId: bankAccount.userId,
          investmentId: matchingInvestment._id,
          paperId: transactionData.paperId,
          executionDate: transactionData.executionDate,
          amount: transactionData.amount,
          value: transactionData.value
        });

        if (existingTransaction) {
          results.duplicatesSkipped++;
          continue;
        }

        // Classify transaction type
        const transactionType = InvestmentTransaction.classifyTransactionType(transactionData.amount);

        // Create new investment transaction
        const newTransaction = new InvestmentTransaction({
          userId: bankAccount.userId,
          investmentId: matchingInvestment._id,
          bankAccountId: bankAccount._id,
          portfolioId: transactionData.portfolioId,
          
          // Security identification
          paperId: transactionData.paperId,
          paperName: transactionData.paperName,
          symbol: transactionData.symbol,
          
          // Transaction details
          amount: transactionData.amount,
          value: transactionData.value,
          currency: transactionData.currency,
          taxSum: transactionData.taxSum,
          executionDate: transactionData.executionDate,
          executablePrice: transactionData.executablePrice,
          
          // Derived fields
          transactionType: transactionType,
          rawData: transactionData.rawData
        });

        await newTransaction.save();
        results.newTransactions++;
        
        logger.info(`Created investment transaction: ${transactionData.symbol} ${transactionType} ${Math.abs(transactionData.amount)} shares on ${transactionData.executionDate.toISOString().split('T')[0]}`);

      } catch (error) {
        results.errors.push({
          paperId: transactionData.paperId,
          symbol: transactionData.symbol,
          error: error.message
        });
        logger.error(`Error processing investment transaction ${transactionData.symbol}: ${error.message}`);
      }
    }
    
    logger.info(`Investment transaction processing completed for account ${bankAccount._id}:`, {
      newTransactions: results.newTransactions,
      duplicatesSkipped: results.duplicatesSkipped,
      errors: results.errors.length
    });
    
    return results;
  }

  // Get investment transactions for a user with filtering options
  async getInvestmentTransactions(userId, options = {}) {
    try {
      const {
        investmentId,
        symbol,
        transactionType,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = options;

      const query = { userId };

      if (investmentId) {
        query.investmentId = investmentId;
      }

      if (symbol) {
        query.symbol = symbol.toUpperCase();
      }

      if (transactionType) {
        query.transactionType = transactionType;
      }

      if (startDate || endDate) {
        query.executionDate = {};
        if (startDate) query.executionDate.$gte = startDate;
        if (endDate) query.executionDate.$lte = endDate;
      }

      const transactions = await InvestmentTransaction.find(query)
        .sort({ executionDate: -1 })
        .limit(limit)
        .skip(offset)
        .populate('investmentId', 'accountName accountNumber')
        .populate('bankAccountId', 'name bankId');

      const totalCount = await InvestmentTransaction.countDocuments(query);

      return {
        transactions,
        totalCount,
        hasMore: totalCount > offset + limit
      };
    } catch (error) {
      logger.error(`Error fetching investment transactions: ${error.message}`);
      throw error;
    }
  }

  // Get transactions by symbol
  async getTransactionsBySymbol(userId, symbol, options = {}) {
    try {
      const {
        startDate,
        endDate,
        limit = 50
      } = options;

      return await InvestmentTransaction.findBySymbol(userId, symbol, {
        startDate,
        endDate,
        limit
      });
    } catch (error) {
      logger.error(`Error fetching transactions by symbol: ${error.message}`);
      throw error;
    }
  }

  // Get transaction summary for user
  async getInvestmentTransactionSummary(userId, options = {}) {
    try {
      const { startDate, endDate } = options;
      
      const summary = await InvestmentTransaction.getTransactionSummary(userId, {
        startDate,
        endDate
      });
      
      return summary;
    } catch (error) {
      logger.error(`Error fetching investment transaction summary: ${error.message}`);
      throw error;
    }
  }

  // Calculate performance metrics using transactions
  async calculatePerformanceFromTransactions(investmentId) {
    try {
      const transactions = await InvestmentTransaction.findByInvestment(investmentId)
        .sort({ executionDate: 1 });

      if (!transactions || transactions.length === 0) {
        return null;
      }

      let totalInvested = 0;
      let totalShares = 0;
      let realizedGains = 0;
      let totalDividends = 0;

      transactions.forEach(transaction => {
        switch (transaction.transactionType) {
          case 'BUY':
            totalInvested += transaction.value + transaction.taxSum;
            totalShares += Math.abs(transaction.amount);
            break;
          case 'SELL':
            const sharessSold = Math.abs(transaction.amount);
            const avgCost = totalShares > 0 ? totalInvested / totalShares : 0;
            const costBasis = sharessSold * avgCost;
            realizedGains += (transaction.value - transaction.taxSum) - costBasis;
            
            // Update totals
            totalShares -= sharessSold;
            totalInvested -= costBasis;
            break;
          case 'DIVIDEND':
            totalDividends += transaction.value - transaction.taxSum;
            break;
        }
      });

      const avgCostPerShare = totalShares > 0 ? totalInvested / totalShares : 0;

      return {
        totalInvested,
        totalShares,
        avgCostPerShare,
        realizedGains,
        totalDividends,
        transactionCount: transactions.length,
        firstTransactionDate: transactions[0].executionDate,
        lastTransactionDate: transactions[transactions.length - 1].executionDate
      };
    } catch (error) {
      logger.error(`Error calculating performance from transactions: ${error.message}`);
      throw error;
    }
  }

  // Get cost basis for a symbol across all investments
  async getCostBasisBySymbol(userId, symbol) {
    try {
      return await InvestmentTransaction.calculateCostBasis(userId, symbol);
    } catch (error) {
      logger.error(`Error calculating cost basis by symbol: ${error.message}`);
      throw error;
    }
  }

  // Check if historical transaction data exists and trigger resync if needed
  async checkAndResyncHistoricalTransactions(bankAccount, forceResync = false) {
    try {
      const investments = await Investment.findByUser(bankAccount.userId, { 
        bankAccountId: bankAccount._id 
      });

      if (!investments || investments.length === 0) {
        logger.info(`No investments found for bank account ${bankAccount._id}, skipping transaction resync`);
        return { message: 'No investments to sync transactions for' };
      }

      let needsResync = forceResync;

      if (!forceResync) {
        // Check if we have transaction data for investments
        for (const investment of investments) {
          const transactionCount = await InvestmentTransaction.countDocuments({
            userId: bankAccount.userId,
            investmentId: investment._id
          });

          // If investment exists but has no transactions, we need historical data
          if (transactionCount === 0) {
            needsResync = true;
            logger.info(`Investment ${investment.accountName} has no transaction history, will resync`);
            break;
          }
        }
      }

      if (needsResync) {
        logger.info(`Resyncing historical transaction data for bank account ${bankAccount._id}`);
        
        // Scrape with extended date range for historical transactions (6 months back)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const scrapingResult = await bankScraperService.scrapeTransactions(bankAccount, {
          startDate: sixMonthsAgo,
          verbose: true
        });

        if (scrapingResult.investmentTransactions && scrapingResult.investmentTransactions.length > 0) {
          const transactionResult = await this.processPortfolioTransactions(
            scrapingResult.investmentTransactions, 
            bankAccount
          );
          
          return {
            message: 'Historical transaction resync completed',
            result: transactionResult
          };
        } else {
          return {
            message: 'No historical transactions found during resync'
          };
        }
      } else {
        return {
          message: 'Investment transactions are up to date, no resync needed'
        };
      }
    } catch (error) {
      logger.error(`Error during historical transaction resync: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new InvestmentService();
