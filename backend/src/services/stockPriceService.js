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

    // Schedule cleanup of old historical data weekly
    cron.schedule('0 2 * * 0', async () => {
      console.log('Running weekly historical data cleanup...');
      await this.cleanupOldHistoricalData();
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
      let stockPrice = await StockPrice.findOne({ symbol: symbol.toUpperCase() });
      
      if (!stockPrice) {
        // Create new stock price record and fetch current price
        stockPrice = await this.fetchAndCreatePrice(symbol);
      } else if (forceUpdate || stockPrice.isStale) {
        // Update existing price if stale or forced
        await this.updatePrice(symbol);
        stockPrice = await StockPrice.findOne({ symbol: symbol.toUpperCase() });
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
      console.log(`Price update already in progress for ${upperSymbol}`);
      return null;
    }

    this.updateInProgress.add(upperSymbol);
    
    try {
      console.log(`Updating price for ${upperSymbol}...`);
      
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
            console.log(`Successfully fetched ${upperSymbol} price from source ${i + 1}: $${priceData.price}`);
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

      // Update or create stock price record
      let stockPrice = await StockPrice.findOne({ symbol: upperSymbol });
      
      if (!stockPrice) {
        stockPrice = new StockPrice({
          symbol: upperSymbol,
          price: priceData.price,
          priceDate: new Date(), // Current date for real-time price
          source: priceData.source,
          change: priceData.change || 0,
          changePercent: priceData.changePercent || 0,
          volume: priceData.volume || 0,
          marketCap: priceData.marketCap || 0,
          metadata: {
            companyName: priceData.companyName || '',
            exchange: priceData.exchange || '',
            sector: priceData.sector || ''
          }
        });
      } else {
        stockPrice.updatePrice(priceData.price, priceData.source, {
          volume: priceData.volume,
          marketCap: priceData.marketCap,
          companyName: priceData.companyName,
          exchange: priceData.exchange,
          sector: priceData.sector
        });
        stockPrice.priceDate = new Date(); // Update price date for current price
      }

      await stockPrice.save();
      console.log(`Successfully updated ${upperSymbol}: $${priceData.price}`);
      
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

      let priceData = null;
      
      if (initialPrice && initialPrice > 0) {
        // Use provided initial price
        priceData = {
          symbol: upperSymbol,
          price: initialPrice,
          source: 'manual'
        };
      } else {
        // Fetch current market price
        await this.updatePrice(upperSymbol);
        return await StockPrice.findOne({ symbol: upperSymbol });
      }

      const stockPrice = new StockPrice({
        symbol: upperSymbol,
        price: priceData.price,
        source: priceData.source,
        lastUpdated: new Date()
      });

      await stockPrice.save();
      console.log(`Created stock price record for ${upperSymbol}: $${priceData.price}`);
      
      return stockPrice;
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
      let stockPrice = await StockPrice.findOne({ symbol: upperSymbol });

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
          stockPrice = await StockPrice.findOne({ symbol: upperSymbol });
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
   * Clean up old historical data
   * @param {number} daysToKeep - Days of historical data to keep
   * @returns {Object} Cleanup result
   */
  async cleanupOldHistoricalData(daysToKeep = 365) {
    try {
      console.log(`Cleaning up historical data older than ${daysToKeep} days...`);
      const result = await StockPrice.cleanupOldPrices(daysToKeep);
      console.log(`Historical data cleanup completed: ${result.modifiedCount} records updated`);
      return result;
    } catch (error) {
      console.error('Error cleaning up historical data:', error);
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
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      // Find all active stock symbols from StockPrice collection
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
        const fullStock = await StockPrice.findOne({ symbol });
        
        if (!fullStock) {
          // No StockPrice record exists yet
          stocksNeedingUpdate.push(symbol);
          console.log(`${symbol}: No price record exists`);
        } else if (!fullStock.lastUpdated || fullStock.lastUpdated < startOfToday) {
          // Last update was before today
          stocksNeedingUpdate.push(symbol);
          console.log(`${symbol}: Last updated ${fullStock.lastUpdated ? fullStock.lastUpdated.toDateString() : 'never'}`);
        } else {
          // Check if there's a historical price entry for today
          const todayEntry = fullStock.historicalPrices.find(price => 
            price.date >= startOfToday && price.date <= endOfToday
          );
          
          if (!todayEntry) {
            stocksNeedingUpdate.push(symbol);
            console.log(`${symbol}: No historical entry for today`);
          } else {
            console.log(`${symbol}: Already has today's price`);
          }
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
      console.log(`Fetching historical prices for ${upperSymbol} from ${startDate.toDateString()} to ${endDate.toDateString()}`);

      // Try different sources for historical data
      const sources = [
        () => this.fetchHistoricalFromYahoo(upperSymbol, startDate, endDate),
        () => this.fetchHistoricalFromAlphaVantage(upperSymbol, startDate, endDate)
      ];

      for (let i = 0; i < sources.length; i++) {
        try {
          const historicalData = await this.retryWithBackoff(sources[i], this.retryAttempts);
          if (historicalData && historicalData.length > 0) {
            console.log(`Successfully fetched ${historicalData.length} historical prices for ${upperSymbol} from source ${i + 1}`);
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
      
      const historicalData = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (prices[i] !== null) {
          historicalData.push({
            date: new Date(timestamps[i] * 1000),
            price: prices[i]
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
            price: parseFloat(priceData['4. close'])
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
   * @returns {Object} Updated stock price record
   */
  async populateHistoricalPrices(symbol, startDate, endDate = new Date()) {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      // Fetch historical data
      const historicalData = await this.fetchHistoricalPrices(upperSymbol, startDate, endDate);
      
      if (!historicalData || historicalData.length === 0) {
        throw new Error(`No historical data found for ${upperSymbol}`);
      }

      // Find or create stock price record
      let stockPrice = await StockPrice.findOne({ symbol: upperSymbol });
      
      if (!stockPrice) {
        // Create new record with the latest price
        const latestPrice = historicalData[historicalData.length - 1];
        stockPrice = new StockPrice({
          symbol: upperSymbol,
          price: latestPrice.price,
          priceDate: latestPrice.date,
          source: 'yahoo', // Historical data is typically from Yahoo Finance
          lastUpdated: new Date()
        });
      }

      // Add historical prices, avoiding duplicates
      const existingDates = new Set(
        stockPrice.historicalPrices.map(p => p.date.toDateString())
      );

      let addedCount = 0;
      for (const dataPoint of historicalData) {
        const dateStr = dataPoint.date.toDateString();
        if (!existingDates.has(dateStr)) {
          stockPrice.historicalPrices.push({
            date: dataPoint.date,
            price: dataPoint.price
          });
          addedCount++;
        }
      }

      // Sort historical prices by date
      stockPrice.historicalPrices.sort((a, b) => a.date - b.date);

      // Keep only last 365 days
      if (stockPrice.historicalPrices.length > 365) {
        stockPrice.historicalPrices = stockPrice.historicalPrices.slice(-365);
      }

      await stockPrice.save();
      console.log(`Added ${addedCount} historical price entries for ${upperSymbol}`);
      
      return stockPrice;
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
      const stockPrice = await StockPrice.findOne({ symbol: upperSymbol });
      
      if (!stockPrice) {
        return null;
      }

      // Check if we have historical data for that date
      const targetDateStr = date.toDateString();
      const historicalEntry = stockPrice.historicalPrices.find(
        p => p.date.toDateString() === targetDateStr
      );

      if (historicalEntry) {
        return historicalEntry.price;
      }

      // If we don't have data for that specific date, try to fetch it
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 5); // Get a few days around the target date
      
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      try {
        await this.populateHistoricalPrices(upperSymbol, startDate, endDate);
        
        // Try again after populating
        const updatedStockPrice = await StockPrice.findOne({ symbol: upperSymbol });
        const newEntry = updatedStockPrice.historicalPrices.find(
          p => p.date.toDateString() === targetDateStr
        );
        
        return newEntry ? newEntry.price : null;
      } catch (error) {
        console.warn(`Could not fetch historical price for ${upperSymbol} on ${date.toDateString()}:`, error.message);
        return null;
      }
    } catch (error) {
      console.error(`Error getting price on date for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Manual price update for admin/testing
   * @param {string} symbol - Stock symbol
   * @param {number} price - Manual price
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Updated stock price
   */
  async setManualPrice(symbol, price, metadata = {}) {
    try {
      const upperSymbol = symbol.toUpperCase();
      let stockPrice = await StockPrice.findOne({ symbol: upperSymbol });

      if (!stockPrice) {
        stockPrice = new StockPrice({
          symbol: upperSymbol,
          price: price,
          source: 'manual'
        });
      } else {
        stockPrice.updatePrice(price, 'manual', metadata);
      }

      await stockPrice.save();
      console.log(`Manually set price for ${upperSymbol}: $${price}`);
      
      return stockPrice;
    } catch (error) {
      console.error(`Error setting manual price for ${symbol}:`, error);
      throw error;
    }
  }
}

module.exports = new StockPriceService();
