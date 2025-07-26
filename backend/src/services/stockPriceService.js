const { StockPrice, RSUGrant } = require('../models');
const cron = require('node-cron');

class StockPriceService {
  constructor() {
    this.updateInProgress = new Set(); // Track symbols being updated to avoid duplicates
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Initialize the service and start scheduled tasks
   */
  async initialize() {
    console.log('Initializing Stock Price Service...');
    
    // Check for today's prices on startup
    await this.checkAndUpdateTodaysPrices();
    
    // Schedule daily price updates at 6 PM (after market close)
    cron.schedule('0 18 * * 1-5', async () => {
      console.log('Running scheduled daily stock price update...');
      await this.updateAllActivePrices();
    }, {
      timezone: 'America/New_York' // US market timezone
    });

    console.log('Stock Price Service initialized with scheduled tasks');
  }

  /**
   * Get current price for a symbol with automatic update if stale
   * @param {string} symbol - Stock symbol
   * @param {boolean} forceUpdate - Force update even if not stale
   * @returns {Object} Stock price data
   */
  async getCurrentPrice(symbol, forceUpdate = false) {
    try {
      let stockPrice = await StockPrice.getLatestPrice(symbol);
      
      if (!stockPrice) {
        // Create new stock price record and fetch current price
        stockPrice = await this.fetchAndCreatePrice(symbol);
      } else if (forceUpdate || stockPrice.isStale) {
        // Update existing price if stale or forced
        await this.updatePrice(symbol);
        stockPrice = await StockPrice.getLatestPrice(symbol);
      }
      
      return stockPrice;
    } catch (error) {
      console.error(`Error getting current price for ${symbol}:`, error);
      throw new Error(`Failed to get current price for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Update price for a specific symbol
   * @param {string} symbol - Stock symbol
   * @returns {Object} Updated stock price
   */
  async updatePrice(symbol) {
    const upperSymbol = symbol.toUpperCase();
    
    // Prevent concurrent updates for the same symbol
    if (this.updateInProgress.has(upperSymbol)) {
      return null;
    }

    this.updateInProgress.add(upperSymbol);
    
    try {
      
      // Try multiple API sources with fallback
      let priceData = null;
      const sources = [
        () => this.fetchFromYahooFinance(upperSymbol),
        () => this.fetchFromAlphaVantage(upperSymbol),
        () => this.fetchFromFinnhub(upperSymbol)
      ];

      for (let i = 0; i < sources.length; i++) {
        try {
          priceData = await this.retryWithBackoff(sources[i], this.retryAttempts);
          if (priceData && priceData.price > 0) {
            break;
          }
        } catch (error) {
          console.warn(`Source ${i + 1} failed for ${upperSymbol}:`, error.message);
          continue;
        }
      }

      if (!priceData || priceData.price <= 0) {
        throw new Error(`No valid price data found for ${upperSymbol}`);
      }

      // Create new price record for today
      const today = new Date();
      const stockPrice = await StockPrice.upsertPrice(
        upperSymbol,
        today,
        priceData.price,
        priceData.source,
        {
          change: priceData.change || 0,
          changePercent: priceData.changePercent || 0,
          volume: priceData.volume || 0,
          marketCap: priceData.marketCap || 0,
          open: priceData.open,
          high: priceData.high,
          low: priceData.low,
          close: priceData.close,
          companyName: priceData.companyName || '',
          exchange: priceData.exchange || '',
          sector: priceData.sector || ''
        }
      );

      return stockPrice;
    } catch (error) {
      console.error(`Failed to update price for ${upperSymbol}:`, error);
      throw error;
    } finally {
      this.updateInProgress.delete(upperSymbol);
    }
  }

  /**
   * Update prices for all active symbols
   * @returns {Object} Update summary
   */
  async updateAllActivePrices() {
    try {
      console.log('Starting bulk price update for all active symbols...');
      
      const activeStocks = await StockPrice.getActiveSymbols();
      const updateResults = {
        total: activeStocks.length,
        updated: 0,
        failed: 0,
        errors: []
      };

      // Process in batches to avoid hitting API rate limits
      const batchSize = 5;
      for (let i = 0; i < activeStocks.length; i += batchSize) {
        const batch = activeStocks.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (stock) => {
            try {
              await this.updatePrice(stock.symbol);
              updateResults.updated++;
            } catch (error) {
              updateResults.failed++;
              updateResults.errors.push({
                symbol: stock.symbol,
                error: error.message
              });
            }
          })
        );

        // Wait between batches to respect rate limits
        if (i + batchSize < activeStocks.length) {
          await this.delay(2000); // 2 second delay between batches
        }
      }

      console.log(`Bulk update completed: ${updateResults.updated} updated, ${updateResults.failed} failed`);
      return updateResults;
    } catch (error) {
      console.error('Error in bulk price update:', error);
      throw error;
    }
  }

  /**
   * Fetch price from Yahoo Finance API
   * @param {string} symbol - Stock symbol
   * @returns {Object} Price data
   */
  async fetchFromYahooFinance(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result) {
        throw new Error('Invalid response from Yahoo Finance');
      }

      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];
      
      return {
        symbol: symbol,
        price: meta.regularMarketPrice || meta.previousClose,
        change: meta.regularMarketChange || 0,
        changePercent: meta.regularMarketChangePercent || 0,
        volume: quote?.volume?.[quote.volume.length - 1] || 0,
        marketCap: meta.marketCap || 0,
        open: meta.regularMarketOpen,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        close: meta.regularMarketPrice,
        companyName: meta.longName || meta.shortName,
        exchange: meta.exchangeName,
        source: 'yahoo'
      };
    } catch (error) {
      throw new Error(`Yahoo Finance fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch price from Alpha Vantage API
   * @param {string} symbol - Stock symbol
   * @returns {Object} Price data
   */
  async fetchFromAlphaVantage(symbol) {
    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) {
        throw new Error('Alpha Vantage API key not configured');
      }

      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();
      const quote = data['Global Quote'];
      
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error('Invalid response from Alpha Vantage');
      }

      const price = parseFloat(quote['05. price']);
      const change = parseFloat(quote['09. change']);
      const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

      return {
        symbol: symbol,
        price: price,
        change: change,
        changePercent: changePercent,
        volume: parseInt(quote['06. volume']) || 0,
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        close: price,
        companyName: quote['01. symbol'],
        source: 'alphavantage'
      };
    } catch (error) {
      throw new Error(`Alpha Vantage fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch price from Finnhub API
   * @param {string} symbol - Stock symbol
   * @returns {Object} Price data
   */
  async fetchFromFinnhub(symbol) {
    try {
      const apiKey = process.env.FINNHUB_API_KEY;
      if (!apiKey) {
        throw new Error('Finnhub API key not configured');
      }

      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.c || data.c <= 0) {
        throw new Error('Invalid response from Finnhub');
      }

      return {
        symbol: symbol,
        price: data.c, // current price
        change: data.d, // change
        changePercent: data.dp, // change percent
        open: data.o, // open price
        high: data.h, // high price
        low: data.l, // low price
        close: data.c, // close price (same as current)
        volume: 0, // Not provided in quote endpoint
        source: 'finnhub'
      };
    } catch (error) {
      throw new Error(`Finnhub fetch failed: ${error.message}`);
    }
  }

  /**
   * Create a new stock price record and fetch initial price
   * @param {string} symbol - Stock symbol
   * @param {number} initialPrice - Initial price (optional)
   * @returns {Object} Created stock price
   */
  async fetchAndCreatePrice(symbol, initialPrice = null) {
    try {
      const upperSymbol = symbol.toUpperCase();
      console.log(`Creating new stock price record for ${upperSymbol}...`);

      if (initialPrice && initialPrice > 0) {
        // Use provided initial price
        const today = new Date();
        const stockPrice = await StockPrice.upsertPrice(
          upperSymbol,
          today,
          initialPrice,
          'manual'
        );
        
        console.log(`Created stock price record for ${upperSymbol}: $${initialPrice}`);
        return stockPrice;
      } else {
        // Fetch current market price
        return await this.updatePrice(upperSymbol);
      }
    } catch (error) {
      console.error(`Error creating stock price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Handle new grant creation - update stock price if needed
   * @param {string} symbol - Stock symbol
   * @param {number} grantPrice - Price from grant
   * @returns {Object} Stock price record
   */
  async handleNewGrant(symbol, grantPrice) {
    try {
      const upperSymbol = symbol.toUpperCase();
      let stockPrice = await StockPrice.getLatestPrice(upperSymbol);

      if (!stockPrice) {
        // Create new record with grant price, then try to get current market price
        console.log(`New stock symbol ${upperSymbol} from grant, creating record...`);
        stockPrice = await this.fetchAndCreatePrice(upperSymbol, grantPrice);
        
        // Try to update with current market price (non-blocking)
        setImmediate(async () => {
          try {
            await this.updatePrice(upperSymbol);
          } catch (error) {
            console.warn(`Failed to update market price for new symbol ${upperSymbol}:`, error.message);
          }
        });
      } else if (stockPrice.isStale) {
        // Update stale price
        console.log(`Updating stale price for ${upperSymbol}...`);
        try {
          await this.updatePrice(upperSymbol);
          stockPrice = await StockPrice.getLatestPrice(upperSymbol);
        } catch (error) {
          console.warn(`Failed to update price for ${upperSymbol}:`, error.message);
        }
      }

      return stockPrice;
    } catch (error) {
      console.error(`Error handling new grant for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get market summary for dashboard
   * @param {Array} symbols - Array of symbols to include (optional)
   * @returns {Object} Market summary
   */
  async getMarketSummary(symbols = []) {
    try {
      const summary = await StockPrice.getMarketSummary(symbols);
      return summary.length > 0 ? summary[0] : null;
    } catch (error) {
      console.error('Error getting market summary:', error);
      throw error;
    }
  }

  /**
   * Utility: Retry function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxAttempts - Maximum retry attempts
   * @returns {any} Function result
   */
  async retryWithBackoff(fn, maxAttempts = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.delay(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Utility: Delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check and update today's prices on startup
   * @returns {Object} Update summary
   */
  async checkAndUpdateTodaysPrices() {
    try {
      console.log('Checking for today\'s stock prices...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find all active stock symbols from existing price records
      const activeStocks = await StockPrice.getActiveSymbols();
      
      // Also find stock symbols from RSU grants that might not have StockPrice records yet
      const grantsWithSymbols = await RSUGrant.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$stockSymbol' } },
        { $project: { symbol: '$_id', _id: 0 } }
      ]);
      
      // Combine symbols from both sources
      const allSymbols = new Set();
      activeStocks.forEach(stock => allSymbols.add(stock.symbol));
      grantsWithSymbols.forEach(grant => allSymbols.add(grant.symbol));
      
      console.log(`Found ${allSymbols.size} unique stock symbols (${activeStocks.length} in StockPrice, ${grantsWithSymbols.length} in grants)`);
      
      if (allSymbols.size === 0) {
        console.log('No stock symbols found - no updates needed');
        return {
          total: 0,
          needingUpdate: 0,
          updated: 0,
          failed: 0,
          errors: [],
          skipped: 0
        };
      }
      
      // Find stocks that don't have a price update today
      const stocksNeedingUpdate = [];
      
      for (const symbol of allSymbols) {
        const todayPrice = await StockPrice.getPriceOnDate(symbol, today);
        
        if (!todayPrice) {
          stocksNeedingUpdate.push(symbol);
          console.log(`${symbol}: No price record for today`);
        } else {
          console.log(`${symbol}: Already has today's price`);
        }
      }

      const updateResults = {
        total: allSymbols.size,
        needingUpdate: stocksNeedingUpdate.length,
        updated: 0,
        failed: 0,
        errors: [],
        skipped: allSymbols.size - stocksNeedingUpdate.length
      };

      if (stocksNeedingUpdate.length === 0) {
        console.log('All stocks have today\'s prices - no updates needed');
        return updateResults;
      }

      console.log(`Found ${stocksNeedingUpdate.length} stocks needing today's prices: ${stocksNeedingUpdate.join(', ')}`);

      // Update stocks that need today's prices
      const batchSize = 5;
      for (let i = 0; i < stocksNeedingUpdate.length; i += batchSize) {
        const batch = stocksNeedingUpdate.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (symbol) => {
            try {
              await this.updatePrice(symbol);
              updateResults.updated++;
              console.log(`Updated today's price for ${symbol}`);
            } catch (error) {
              updateResults.failed++;
              updateResults.errors.push({
                symbol: symbol,
                error: error.message
              });
              console.warn(`Failed to update today's price for ${symbol}:`, error.message);
            }
          })
        );

        // Wait between batches to respect rate limits
        if (i + batchSize < stocksNeedingUpdate.length) {
          await this.delay(2000); // 2 second delay between batches
        }
      }

      console.log(`Today's price check completed: ${updateResults.updated} updated, ${updateResults.failed} failed, ${updateResults.skipped} already current`);
      return updateResults;
      
    } catch (error) {
      console.error('Error checking today\'s prices:', error);
      throw error;
    }
  }

  /**
   * Fetch historical stock price data
   * @param {string} symbol - Stock symbol
   * @param {Date} startDate - Start date for historical data
   * @param {Date} endDate - End date for historical data (default: today)
   * @returns {Array} Array of historical price data
   */
  async fetchHistoricalPrices(symbol, startDate, endDate = new Date()) {
    try {
      const upperSymbol = symbol.toUpperCase();

      // Try different sources for historical data
      const sources = [
        () => this.fetchHistoricalFromYahoo(upperSymbol, startDate, endDate),
        () => this.fetchHistoricalFromAlphaVantage(upperSymbol, startDate, endDate)
      ];

      for (let i = 0; i < sources.length; i++) {
        try {
          const historicalData = await this.retryWithBackoff(sources[i], this.retryAttempts);
          if (historicalData && historicalData.length > 0) {
            return historicalData;
          }
        } catch (error) {
          console.warn(`Historical data source ${i + 1} failed for ${upperSymbol}:`, error.message);
          continue;
        }
      }

      throw new Error(`No historical data available for ${upperSymbol}`);
    } catch (error) {
      console.error(`Error fetching historical prices for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch historical data from Yahoo Finance
   * @param {string} symbol - Stock symbol
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Historical price data
   */
  async fetchHistoricalFromYahoo(symbol, startDate, endDate) {
    try {
      const period1 = Math.floor(startDate.getTime() / 1000);
      const period2 = Math.floor(endDate.getTime() / 1000);
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Yahoo Finance historical API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];
      
      if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
        throw new Error('Invalid historical response from Yahoo Finance');
      }

      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0].close;
      const opens = result.indicators.quote[0].open;
      const highs = result.indicators.quote[0].high;
      const lows = result.indicators.quote[0].low;
      const volumes = result.indicators.quote[0].volume;
      
      const historicalData = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (prices[i] !== null) {
          historicalData.push({
            date: new Date(timestamps[i] * 1000),
            price: prices[i],
            open: opens?.[i],
            high: highs?.[i],
            low: lows?.[i],
            close: prices[i],
            volume: volumes?.[i] || 0
          });
        }
      }

      return historicalData;
    } catch (error) {
      throw new Error(`Yahoo Finance historical fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch historical data from Alpha Vantage
   * @param {string} symbol - Stock symbol
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Historical price data
   */
  async fetchHistoricalFromAlphaVantage(symbol, startDate, endDate) {
    try {
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (!apiKey) {
        throw new Error('Alpha Vantage API key not configured');
      }

      // Alpha Vantage TIME_SERIES_DAILY function
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=full`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Alpha Vantage historical API error: ${response.status}`);
      }

      const data = await response.json();
      const timeSeries = data['Time Series (Daily)'];
      
      if (!timeSeries) {
        throw new Error('Invalid historical response from Alpha Vantage');
      }

      const historicalData = [];
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();

      for (const [dateStr, priceData] of Object.entries(timeSeries)) {
        const date = new Date(dateStr);
        const dateTime = date.getTime();
        
        if (dateTime >= startTime && dateTime <= endTime) {
          historicalData.push({
            date: date,
            price: parseFloat(priceData['4. close']),
            open: parseFloat(priceData['1. open']),
            high: parseFloat(priceData['2. high']),
            low: parseFloat(priceData['3. low']),
            close: parseFloat(priceData['4. close']),
            volume: parseInt(priceData['5. volume']) || 0
          });
        }
      }

      // Sort by date (oldest first)
      historicalData.sort((a, b) => a.date - b.date);
      
      return historicalData;
    } catch (error) {
      throw new Error(`Alpha Vantage historical fetch failed: ${error.message}`);
    }
  }

  /**
   * Populate historical prices for a stock symbol
   * @param {string} symbol - Stock symbol
   * @param {Date} startDate - Start date for historical data
   * @param {Date} endDate - End date (default: today)
   * @returns {Object} Population result
   */
  async populateHistoricalPrices(symbol, startDate, endDate = new Date()) {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      // Fetch historical data
      const historicalData = await this.fetchHistoricalPrices(upperSymbol, startDate, endDate);
      
      if (!historicalData || historicalData.length === 0) {
        throw new Error(`No historical data found for ${upperSymbol}`);
      }

      // Prepare bulk upsert data
      const priceData = historicalData.map(dataPoint => ({
        symbol: upperSymbol,
        date: dataPoint.date,
        price: dataPoint.price,
        source: 'yahoo', // Historical data is typically from Yahoo Finance
        open: dataPoint.open,
        high: dataPoint.high,
        low: dataPoint.low,
        close: dataPoint.close,
        volume: dataPoint.volume
      }));

      // Bulk upsert all historical prices
      const result = await StockPrice.bulkUpsertPrices(priceData);
      
      return {
        symbol: upperSymbol,
        recordsProcessed: historicalData.length,
        upsertedCount: result.upsertedCount,
        modifiedCount: result.modifiedCount
      };
    } catch (error) {
      console.error(`Error populating historical prices for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get historical price for a specific date
   * @param {string} symbol - Stock symbol
   * @param {Date} date - Specific date
   * @returns {number|null} Price on that date or null if not found
   */
  async getPriceOnDate(symbol, date) {
    try {
      const upperSymbol = symbol.toUpperCase();
      const targetDate = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today for comparison
      
      // If the requested date is in the future, return the most recent available price
      if (targetDate > today) {
        const latestPrice = await StockPrice.getLatestPrice(upperSymbol);
        return latestPrice ? latestPrice.price : null;
      }
      
      // First, try to get the exact date
      const stockPrice = await StockPrice.getPriceOnDate(upperSymbol, targetDate);
      
      if (stockPrice) {
        return stockPrice.price;
      }

      // If no exact match, look for the most recent trading day before this date
      const lastTradingDayPrice = await this.findLastTradingDayPrice(upperSymbol, targetDate);
      
      if (lastTradingDayPrice) {
        return lastTradingDayPrice.price;
      }

      // If still no data, try to fetch historical data around this period
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - 10); // Look back 10 days to capture weekends/holidays
      
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + 1);

      try {
        await this.populateHistoricalPrices(upperSymbol, startDate, endDate);
        
        // Try to find exact date again after populating
        const updatedStockPrice = await StockPrice.getPriceOnDate(upperSymbol, targetDate);
        if (updatedStockPrice) {
          return updatedStockPrice.price;
        }
        
        // Try to find last trading day again after populating
        const updatedLastTradingDayPrice = await this.findLastTradingDayPrice(upperSymbol, targetDate);
        if (updatedLastTradingDayPrice) {
          return updatedLastTradingDayPrice.price;
        }
        
        return null;
      } catch (error) {
        console.warn(`Could not fetch historical price for ${upperSymbol} around ${targetDate.toDateString()}:`, error.message);
        return null;
      }
    } catch (error) {
      console.error(`Error getting price on date for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Find the most recent trading day price before or on the given date
   * @param {string} symbol - Stock symbol (should be uppercase)
   * @param {Date} date - Target date
   * @returns {Object|null} Price record with price and date, or null if not found
   */
  async findLastTradingDayPrice(symbol, date) {
    try {
      // Look for the most recent price within the last 14 days (to handle long weekends/holidays)
      const lookbackDate = new Date(date);
      lookbackDate.setDate(lookbackDate.getDate() - 14);
      
      const lastTradingDay = await StockPrice.findOne({
        symbol: symbol,
        date: {
          $gte: lookbackDate,
          $lte: date
        },
        isActive: true
      }).sort({ date: -1 }); // Sort by date descending to get the most recent
      
      return lastTradingDay ? {
        price: lastTradingDay.price,
        date: lastTradingDay.date
      } : null;
    } catch (error) {
      console.error(`Error finding last trading day price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Manual price update for admin/testing
   * @param {string} symbol - Stock symbol
   * @param {number} price - Manual price
   * @param {Date} date - Date for the price (default: today)
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Updated stock price
   */
  async setManualPrice(symbol, price, date = new Date(), metadata = {}) {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      const stockPrice = await StockPrice.upsertPrice(
        upperSymbol,
        date,
        price,
        'manual',
        metadata
      );

      console.log(`Manually set price for ${upperSymbol} on ${date.toDateString()}: $${price}`);
      
      return stockPrice;
    } catch (error) {
      console.error(`Error setting manual price for ${symbol}:`, error);
      throw error;
    }
  }
}

module.exports = new StockPriceService();
