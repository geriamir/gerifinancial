const { Investment, InvestmentSnapshot, InvestmentTransaction } = require('../models');
const INVESTMENT_CONSTANTS = require('../constants/investmentConstants');
const mongoose = require('mongoose');
const logger = require('../../shared/utils/logger');
const { bankScraperService } = require('../../banking');

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
          holdingType: investmentData.holdingType || INVESTMENT_CONSTANTS.HOLDING_TYPES.STOCK,
          // Cost basis from source
          ...(investmentData.costBasis != null && { costBasis: investmentData.costBasis }),
          // Option-specific fields (only set when present)
          ...(investmentData.underlyingSymbol && { underlyingSymbol: investmentData.underlyingSymbol }),
          ...(investmentData.strikePrice != null && { strikePrice: investmentData.strikePrice }),
          ...(investmentData.expirationDate && { expirationDate: investmentData.expirationDate }),
          ...(investmentData.putCall && { putCall: investmentData.putCall }),
          ...(investmentData.multiplier != null && { multiplier: investmentData.multiplier })
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

    // Lazy import to avoid circular dependency during initialization
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

  // Returns a map of bankAccountId -> { cashBalance, currency } from Portfolio documents
  async getPortfolioCashBalances(userId) {
    const Portfolio = require('../models/Portfolio');
    const portfolios = await Portfolio.find(
      { userId, status: 'active' },
      'bankAccountId cashBalance currency'
    );
    const result = {};
    for (const p of portfolios) {
      const key = p.bankAccountId.toString();
      result[key] = {
        cashBalance: (result[key]?.cashBalance || 0) + (p.cashBalance || 0),
        currency: p.currency
      };
    }
    return result;
  }

  // Returns a map of symbol -> { price, change, changePercent } from the StockPrice collection
  async getHoldingsPriceData(userId) {
    const investments = await Investment.findByUser(userId);
    const symbols = new Set();
    for (const inv of investments) {
      for (const h of inv.holdings || []) {
        const sym = h.underlyingSymbol || h.symbol;
        if (sym && h.holdingType !== 'option') symbols.add(sym.toUpperCase());
      }
    }

    const StockPrice = require('../models/StockPrice');
    const result = {};
    for (const symbol of symbols) {
      const sp = await StockPrice.findOne({ symbol, isActive: true }).sort({ date: -1 });
      if (sp) {
        result[symbol] = {
          price: sp.price,
          change: sp.change || 0,
          changePercent: sp.changePercent || 0,
          date: sp.date
        };
      }
    }
    return result;
  }

  // Returns price history and buy/sell events for a holding timeline chart
  async getHoldingTimeline(userId, symbol, days = 365) {
    const StockPrice = require('../models/StockPrice');
    const upperSymbol = symbol.toUpperCase();

    // Get ALL transactions for this symbol to compute position over time
    const allTransactions = await InvestmentTransaction.find({
      userId,
      symbol: upperSymbol
    }).sort({ executionDate: 1 }).lean();

    if (allTransactions.length === 0) {
      return { symbol: upperSymbol, priceHistory: [], events: [], days };
    }

    // Start date is the first transaction
    const firstTxDate = new Date(allTransactions[0].executionDate);
    firstTxDate.setUTCHours(0, 0, 0, 0);

    // Build cumulative position timeline from transactions
    const positionChanges = allTransactions.map(t => ({
      date: new Date(t.executionDate).toISOString().split('T')[0],
      amount: t.amount // positive for buy, negative for sell
    }));

    // Get daily price history starting from first transaction
    let prices = await StockPrice.find({
      symbol: upperSymbol,
      date: { $gte: firstTxDate },
      isActive: true
    }).sort({ date: 1 }).lean();

    // If no prices, try to populate via stockPriceService
    if (prices.length === 0) {
      try {
        const stockPriceService = require('../../rsu/services/stockPriceService');
        await stockPriceService.populateHistoricalPrices(upperSymbol, firstTxDate, new Date());
        prices = await StockPrice.find({
          symbol: upperSymbol,
          date: { $gte: firstTxDate },
          isActive: true
        }).sort({ date: 1 }).lean();
      } catch (err) {
        logger.warn(`Could not populate historical prices for ${upperSymbol}: ${err.message}`);
      }
    }

    // Build position quantity at each date
    let cumulativeQty = 0;
    let txIdx = 0;

    const priceHistory = prices.map(p => {
      const dateKey = new Date(p.date).toISOString().split('T')[0];

      // Apply all transactions up to and including this date
      while (txIdx < positionChanges.length && positionChanges[txIdx].date <= dateKey) {
        cumulativeQty += positionChanges[txIdx].amount;
        txIdx++;
      }

      return {
        date: p.date,
        price: p.price,
        quantity: cumulativeQty,
        holdingValue: cumulativeQty * p.price
      };
    });

    const events = allTransactions.map(t => ({
      date: t.executionDate,
      type: t.transactionType,
      shares: Math.abs(t.amount),
      pricePerShare: t.executablePrice,
      value: t.value,
      symbol: t.symbol
    }));

    // Find covered calls (option holdings on this underlying symbol)
    const investments = await Investment.find({ userId }).lean();
    const coveredCalls = [];
    for (const inv of investments) {
      if (!inv.holdings) continue;
      for (const h of inv.holdings) {
        if (h.holdingType === 'option' && h.underlyingSymbol &&
            h.underlyingSymbol.toUpperCase() === upperSymbol &&
            h.putCall === 'CALL' && h.quantity < 0) {
          // Find when the option was sold
          const optionTx = await InvestmentTransaction.findOne({
            userId,
            symbol: h.symbol,
            transactionType: 'SELL'
          }).sort({ executionDate: 1 }).lean();

          coveredCalls.push({
            strikePrice: h.strikePrice,
            expirationDate: h.expirationDate,
            putCall: h.putCall,
            contracts: Math.abs(h.quantity),
            multiplier: h.multiplier || 100,
            symbol: h.symbol,
            sellDate: optionTx ? optionTx.executionDate : null
          });
        }
      }
    }

    return { symbol: upperSymbol, priceHistory, events, coveredCalls, days };
  }

  async getPortfolioTimeline(userId, days = 365) {
    const StockPrice = require('../models/StockPrice');
    const Portfolio = require('../models/Portfolio');

    // Get all holdings (exclude options — use underlying)
    const investments = await Investment.findByUser(userId);
    const symbolSet = new Set();
    for (const inv of investments) {
      for (const h of (inv.holdings || [])) {
        if (h.holdingType !== 'option' && h.holdingType !== 'future' && h.symbol) {
          symbolSet.add(h.symbol.toUpperCase());
        }
      }
    }
    const symbols = [...symbolSet];

    if (symbols.length === 0) {
      return { symbols: [], series: [] };
    }

    // Get current cash balance from Portfolio documents
    const cashAgg = await Portfolio.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
      { $group: { _id: null, totalCash: { $sum: '$cashBalance' } } }
    ]);
    const currentCash = cashAgg[0]?.totalCash || 0;

    // Compute cutoff date
    const cutoffDate = new Date();
    if (days > 0) {
      cutoffDate.setDate(cutoffDate.getDate() - days);
    } else {
      cutoffDate.setFullYear(2000);
    }
    cutoffDate.setUTCHours(0, 0, 0, 0);

    // Get ALL transactions to reconstruct cash timeline
    // value field sign convention: BUY=negative (cash out), SELL/DIVIDEND=positive (cash in)
    const allTransactions = await InvestmentTransaction.find({
      userId
    }).sort({ executionDate: 1 }).lean();

    // Compute initial cash: currentCash = initialCash + sum(all values)
    const totalTxValue = allTransactions.reduce((sum, t) => sum + (t.value || 0), 0);
    const initialCash = currentCash - totalTxValue;

    // Build daily cash changes from transactions
    const cashChanges = {};
    for (const t of allTransactions) {
      const dateKey = new Date(t.executionDate).toISOString().split('T')[0];
      cashChanges[dateKey] = (cashChanges[dateKey] || 0) + (t.value || 0);
    }

    // For each symbol, build daily holdingValue series
    const symbolSeries = {};
    let earliestDate = null;

    for (const symbol of symbols) {
      const transactions = allTransactions.filter(t => t.symbol === symbol);
      if (transactions.length === 0) continue;

      const firstTxDate = new Date(transactions[0].executionDate);
      firstTxDate.setUTCHours(0, 0, 0, 0);
      if (!earliestDate || firstTxDate < earliestDate) earliestDate = firstTxDate;

      const positionChanges = transactions.map(t => ({
        date: new Date(t.executionDate).toISOString().split('T')[0],
        amount: t.amount
      }));

      const queryStart = firstTxDate < cutoffDate ? cutoffDate : firstTxDate;
      let prices = await StockPrice.find({
        symbol, date: { $gte: queryStart }, isActive: true
      }).sort({ date: 1 }).lean();

      if (prices.length === 0) {
        try {
          const stockPriceService = require('../../rsu/services/stockPriceService');
          await stockPriceService.populateHistoricalPrices(symbol, queryStart, new Date());
          prices = await StockPrice.find({
            symbol, date: { $gte: queryStart }, isActive: true
          }).sort({ date: 1 }).lean();
        } catch (err) {
          logger.warn(`Could not populate prices for ${symbol}: ${err.message}`);
        }
      }

      // Apply transactions up to queryStart to get starting quantity
      let cumulativeQty = 0;
      let txIdx = 0;
      const queryStartKey = queryStart.toISOString().split('T')[0];
      while (txIdx < positionChanges.length && positionChanges[txIdx].date < queryStartKey) {
        cumulativeQty += positionChanges[txIdx].amount;
        txIdx++;
      }

      const series = {};
      for (const p of prices) {
        const dateKey = new Date(p.date).toISOString().split('T')[0];
        while (txIdx < positionChanges.length && positionChanges[txIdx].date <= dateKey) {
          cumulativeQty += positionChanges[txIdx].amount;
          txIdx++;
        }
        series[dateKey] = cumulativeQty * p.price;
      }

      if (Object.keys(series).length > 0) {
        symbolSeries[symbol] = series;
      }
    }

    // Merge all symbols into unified date-keyed timeline
    const allDates = new Set();
    for (const series of Object.values(symbolSeries)) {
      for (const date of Object.keys(series)) {
        allDates.add(date);
      }
    }
    const sortedDates = [...allDates].sort();
    const activeSymbols = Object.keys(symbolSeries);

    // Build cumulative cash at each date
    const cashChangeKeys = Object.keys(cashChanges).sort();
    let cumulativeCashValue = initialCash;
    let cashIdx = 0;

    // Advance cash to the cutoff date
    const cutoffKey = cutoffDate.toISOString().split('T')[0];
    while (cashIdx < cashChangeKeys.length && cashChangeKeys[cashIdx] < cutoffKey) {
      cumulativeCashValue += cashChanges[cashChangeKeys[cashIdx]];
      cashIdx++;
    }

    // Build output series with forward-filled values
    const lastValues = {};
    for (const sym of activeSymbols) lastValues[sym] = 0;
    let lastCash = cumulativeCashValue;

    const result = sortedDates.map(date => {
      // Apply cash changes up to and including this date
      while (cashIdx < cashChangeKeys.length && cashChangeKeys[cashIdx] <= date) {
        cumulativeCashValue += cashChanges[cashChangeKeys[cashIdx]];
        cashIdx++;
      }
      lastCash = cumulativeCashValue;

      const point = { date };
      let total = 0;
      for (const sym of activeSymbols) {
        const val = symbolSeries[sym][date];
        if (val !== undefined) lastValues[sym] = val;
        point[sym] = lastValues[sym];
        total += lastValues[sym];
      }
      point.cash = lastCash;
      point.total = total + lastCash;
      return point;
    });

    return { symbols: activeSymbols, series: result, cashBalance: currentCash };
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
      
      // Include portfolio-level cash from Portfolio documents
      const Portfolio = require('../models/Portfolio');
      const cashAgg = await Portfolio.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
        { $group: { _id: null, totalCash: { $sum: '$cashBalance' } } }
      ]);
      const portfolioCash = cashAgg[0]?.totalCash || 0;
      summary.totalCashBalance = portfolioCash;
      summary.totalValue = summary.totalBalance + summary.totalMarketValue + portfolioCash;
      
      return {
        ...summary,
        topHoldings: holdings.slice(0, 10),
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
        let matchingInvestment = investmentMap.get(transactionData.paperId);
        
        // For cash transactions (amount=0), also try matching by symbol in holdings
        if (!matchingInvestment && transactionData.amount === 0 && transactionData.symbol) {
          for (const inv of investments) {
            const hasSymbol = (inv.holdings || []).some(h => 
              h.symbol && h.symbol.toUpperCase() === transactionData.symbol.toUpperCase()
            );
            if (hasSymbol) { matchingInvestment = inv; break; }
          }
        }
        
        // For account-level cash transactions (interest, fees) with no holding match,
        // use the first investment as a fallback — they still affect account cash
        if (!matchingInvestment && transactionData.amount === 0 && investments.length > 0) {
          matchingInvestment = investments[0];
        }

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
        let existingTransaction;
        if (transactionData.externalId) {
          existingTransaction = await InvestmentTransaction.findOne({
            userId: bankAccount.userId,
            bankAccountId: bankAccount._id,
            externalId: transactionData.externalId
          });
        } else {
          // Fallback dedup only when no externalId — match on full signature
          existingTransaction = await InvestmentTransaction.findOne({
            userId: bankAccount.userId,
            investmentId: matchingInvestment._id,
            paperId: transactionData.paperId,
            executionDate: transactionData.executionDate,
            amount: transactionData.amount,
            value: transactionData.value
          });
        }

        if (existingTransaction) {
          results.duplicatesSkipped++;
          continue;
        }

        // Use provided transactionType (from IBKR cash classification) or classify from amount
        const transactionType = transactionData.transactionType || 
          InvestmentTransaction.classifyTransactionType(transactionData.amount);

        // Create new investment transaction
        const newTransaction = new InvestmentTransaction({
          userId: bankAccount.userId,
          investmentId: matchingInvestment._id,
          bankAccountId: bankAccount._id,
          portfolioId: transactionData.portfolioId || matchingInvestment.portfolioId?.toString() || matchingInvestment.externalPortfolioId,
          
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
          externalId: transactionData.externalId || undefined,
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

}

module.exports = new InvestmentService();
