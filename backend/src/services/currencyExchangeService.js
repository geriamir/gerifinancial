const cron = require('node-cron');
const logger = require('../utils/logger');

class CurrencyExchangeService {
  constructor() {
    this.updateInProgress = new Set(); // Track currency pairs being updated to avoid duplicates
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
    this.supportedCurrencies = ['USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CAD', 'CHF', 'AUD'];
    this.CurrencyExchange = null; // Will be set during initialization
  }

  /**
   * Initialize the service and start scheduled tasks
   */
  async initialize() {
    logger.info('Initializing Currency Exchange Service...');
    
    // Load models after MongoDB connection is established
    const { CurrencyExchange } = require('../models');
    this.CurrencyExchange = CurrencyExchange;
    
    // Check for today's rates on startup
    await this.checkAndUpdateTodaysRates();
    
    // Schedule daily rate updates at 9 AM (after markets open)
    cron.schedule('0 9 * * 1-5', async () => {
      logger.info('Running scheduled daily currency exchange rate update...');
      await this.updateAllActivePairs();
    }, {
      timezone: 'UTC'
    });

    logger.info('Currency Exchange Service initialized with scheduled tasks');
  }

  /**
   * Get current exchange rate between two currencies
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @param {boolean} forceUpdate - Force update even if not stale
   * @returns {number} Exchange rate
   */
  async getCurrentRate(fromCurrency, toCurrency, forceUpdate = false) {
    try {
      // Check if same currency
      if (fromCurrency === toCurrency) {
        return 1;
      }

      let rate = await this.CurrencyExchange.getRate(fromCurrency, toCurrency);
      
      if (!rate || forceUpdate) {
        // Try to update the rate
        await this.updateExchangeRate(fromCurrency, toCurrency);
        rate = await this.CurrencyExchange.getRate(fromCurrency, toCurrency);
      }
      
      if (!rate) {
        throw new Error(`Exchange rate not available for ${fromCurrency} to ${toCurrency}`);
      }
      
      return rate;
    } catch (error) {
      logger.error(`Error getting current rate for ${fromCurrency}/${toCurrency}:`, error);
      throw new Error(`Failed to get current rate for ${fromCurrency}/${toCurrency}: ${error.message}`);
    }
  }

  /**
   * Get exchange rate for a specific date, with fallback to nearest available rate
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @param {Date} date - Target date for conversion
   * @param {boolean} allowFallback - Whether to fall back to nearest available rate
   * @returns {Object} Rate information with metadata
   */
  async getRateForDate(fromCurrency, toCurrency, date, allowFallback = true) {
    try {
      // Check if same currency
      if (fromCurrency === toCurrency) {
        return {
          rate: 1,
          date: date,
          source: 'same-currency',
          fallback: false
        };
      }

      // Step 0: If future date, override requested date to today
      const now = new Date();
      const originalDate = date;
      let effectiveDate = date;
      let isFutureDateOverride = false;
      
      if (date > now) {
        effectiveDate = new Date(now);
        effectiveDate.setHours(0, 0, 0, 0); // Start of today
        isFutureDateOverride = true;
        logger.info(`Future date ${originalDate.toDateString()} overridden to today ${effectiveDate.toDateString()} for ${fromCurrency}/${toCurrency}`);
      }

      // Try to get rate for effectiveDate (today if original was future) and fallback dates
      const datesToTry = [effectiveDate];
      
      // Add 1-7 days back if fallback is allowed
      if (allowFallback) {
        for (let daysBack = 1; daysBack <= 7; daysBack++) {
          const fallbackDate = new Date(effectiveDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));
          datesToTry.push(fallbackDate);
        }
      }

      // Try each date in order
      for (let i = 0; i < datesToTry.length; i++) {
        const tryDate = datesToTry[i];
        const daysBack = i; // 0 for effectiveDate, 1+ for fallback dates
        
        // Step 1: Check DB - if we have it, return that rate
        let rate = await this.CurrencyExchange.getRate(fromCurrency, toCurrency, tryDate);
        
        if (rate) {
          return {
            rate: rate,
            date: originalDate,
            rateDate: tryDate,
            source: daysBack === 0 ? (isFutureDateOverride ? 'current-date-override' : 'exact-date') : 'fallback-db',
            fallback: daysBack > 0 || isFutureDateOverride,
            daysDifference: Math.abs((originalDate.getTime() - tryDate.getTime()) / (1000 * 60 * 60 * 24))
          };
        }

        // Step 2: If not in DB - try to retrieve from online source
        try {
          await this.updateExchangeRateForDate(fromCurrency, toCurrency, tryDate);
          rate = await this.CurrencyExchange.getRate(fromCurrency, toCurrency, tryDate);
          
          if (rate) {
            return {
              rate: rate,
              date: originalDate,
              rateDate: tryDate,
              source: daysBack === 0 ? (isFutureDateOverride ? 'fetched-current-override' : 'fetched-on-demand') : 'fetched-fallback',
              fallback: daysBack > 0 || isFutureDateOverride,
              daysDifference: Math.abs((originalDate.getTime() - tryDate.getTime()) / (1000 * 60 * 60 * 24))
            };
          }
        } catch (fetchError) {
          logger.warn(`Could not fetch rate for ${fromCurrency}/${toCurrency} on ${tryDate.toDateString()} (${daysBack} days back): ${fetchError.message}`);
          // Continue to next date
        }
      }

      throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency} on ${originalDate.toDateString()} or up to 7 days back`);
    } catch (error) {
      logger.error(`Error getting rate for ${fromCurrency}/${toCurrency} on ${date.toDateString()}:`, error);
      throw error;
    }
  }

  /**
   * Find the nearest available exchange rate to a given date
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @param {Date} targetDate - Target date
   * @param {number} maxDaysDifference - Maximum days difference to consider (default: 30)
   * @returns {Object|null} Nearest rate information
   */
  async getNearestAvailableRate(fromCurrency, toCurrency, targetDate, maxDaysDifference = 30) {
    try {
      // Search for rates within the acceptable range
      const maxDate = new Date(targetDate.getTime() + (maxDaysDifference * 24 * 60 * 60 * 1000));
      const minDate = new Date(targetDate.getTime() - (maxDaysDifference * 24 * 60 * 60 * 1000));

      // Try direct rate first
      let rate = await this.CurrencyExchange.findOne({
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        date: {
          $gte: minDate,
          $lte: maxDate
        }
      }).sort({
        // Sort by distance from target date (closest first)
        date: -1
      }).limit(1);

      if (rate) {
        return {
          rate: rate.rate,
          rateDate: rate.date
        };
      }

      // Try reverse rate
      rate = await this.CurrencyExchange.findOne({
        fromCurrency: toCurrency.toUpperCase(),
        toCurrency: fromCurrency.toUpperCase(),
        date: {
          $gte: minDate,
          $lte: maxDate
        }
      }).sort({
        date: -1
      }).limit(1);

      if (rate) {
        return {
          rate: 1 / rate.rate,
          rateDate: rate.date
        };
      }

      return null;
    } catch (error) {
      logger.error(`Error finding nearest rate for ${fromCurrency}/${toCurrency}:`, error);
      return null;
    }
  }

  /**
   * Update exchange rate for a specific currency pair and date
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @param {Date} date - Target date (default: today)
   * @returns {Object} Updated exchange rate record
   */
  async updateExchangeRateForDate(fromCurrency, toCurrency, date = new Date()) {
    const currencyPair = `${fromCurrency.toUpperCase()}/${toCurrency.toUpperCase()}`;
    const dateKey = `${currencyPair}-${date.toDateString()}`;
    
    // Prevent concurrent updates for the same currency pair and date
    if (this.updateInProgress.has(dateKey)) {
      return null;
    }

    this.updateInProgress.add(dateKey);
    
    try {
      logger.info(`Updating exchange rate for ${currencyPair} on ${date.toDateString()}...`);
      
      let rateData = null;
      
      // Try to fetch current rate from available sources
      const sources = [
        () => this.fetchFromExchangeRateAPI(fromCurrency, toCurrency),
        () => this.fetchFromFixer(fromCurrency, toCurrency),
        () => this.fetchFromCurrencyAPI(fromCurrency, toCurrency)
      ];

      for (let i = 0; i < sources.length; i++) {
        try {
          rateData = await this.retryWithBackoff(sources[i], this.retryAttempts);
          if (rateData && rateData.rate > 0) {
            break;
          }
        } catch (error) {
          logger.warn(`Exchange rate source ${i + 1} failed for ${currencyPair}:`, error.message);
          continue;
        }
      }

      if (!rateData || rateData.rate <= 0) {
        throw new Error(`No valid exchange rate data found for ${currencyPair} on ${date.toDateString()}`);
      }

      // Store the exchange rate for the specific date
      const exchangeRate = await this.CurrencyExchange.updateRate(
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase(),
        rateData.rate,
        date,
        rateData.source,
        {
          provider: rateData.provider || rateData.source,
          timestamp: rateData.timestamp || new Date().toISOString(),
          lastUpdated: new Date(),
          onDemandFetch: true
        }
      );

      logger.info(`Updated exchange rate ${currencyPair} for ${date.toDateString()}: ${rateData.rate} (${rateData.source})`);
      return exchangeRate;
    } catch (error) {
      logger.error(`Failed to update exchange rate for ${currencyPair} on ${date.toDateString()}:`, error);
      throw error;
    } finally {
      this.updateInProgress.delete(dateKey);
    }
  }

  /**
   * Update exchange rate for a specific currency pair
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @returns {Object} Updated exchange rate record
   */
  async updateExchangeRate(fromCurrency, toCurrency) {
    return this.updateExchangeRateForDate(fromCurrency, toCurrency, new Date());
  }

  /**
   * Update rates for all common currency pairs
   * @returns {Object} Update summary
   */
  async updateAllActivePairs() {
    try {
      logger.info('Starting bulk exchange rate update for all active pairs...');
      
      // Get all existing currency pairs from the database
      const existingRates = await this.CurrencyExchange.getLatestRates();
      const existingPairs = new Set();
      existingRates.forEach(rate => {
        existingPairs.add(`${rate.fromCurrency}/${rate.toCurrency}`);
      });

      // Add common currency pairs that should always be available
      const commonPairs = this.getCommonCurrencyPairs();
      commonPairs.forEach(pair => existingPairs.add(pair));

      const updateResults = {
        total: existingPairs.size,
        updated: 0,
        failed: 0,
        errors: []
      };

      // Process in batches to avoid hitting API rate limits
      const batchSize = 3;
      const pairsArray = Array.from(existingPairs);
      
      for (let i = 0; i < pairsArray.length; i += batchSize) {
        const batch = pairsArray.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (pair) => {
            try {
              const [fromCurrency, toCurrency] = pair.split('/');
              await this.updateExchangeRate(fromCurrency, toCurrency);
              updateResults.updated++;
            } catch (error) {
              updateResults.failed++;
              updateResults.errors.push({
                pair: pair,
                error: error.message
              });
            }
          })
        );

        // Wait between batches to respect rate limits
        if (i + batchSize < pairsArray.length) {
          await this.delay(2000); // 2 second delay between batches
        }
      }

      logger.info(`Bulk exchange rate update completed: ${updateResults.updated} updated, ${updateResults.failed} failed`);
      return updateResults;
    } catch (error) {
      logger.error('Error in bulk exchange rate update:', error);
      throw error;
    }
  }

  /**
   * Fetch exchange rate from ExchangeRate-API (free, no API key required)
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Object} Rate data
   */
  async fetchFromExchangeRateAPI(fromCurrency, toCurrency) {
    try {
      const url = `https://api.exchangerate-api.com/v4/latest/${fromCurrency.toUpperCase()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`ExchangeRate-API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.rates || !data.rates[toCurrency.toUpperCase()]) {
        throw new Error(`Currency ${toCurrency} not found in ExchangeRate-API response`);
      }

      return {
        rate: data.rates[toCurrency.toUpperCase()],
        source: 'exchangerate-api',
        provider: 'ExchangeRate-API',
        timestamp: data.time_last_updated || new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`ExchangeRate-API fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch exchange rate from Fixer.io API
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Object} Rate data
   */
  async fetchFromFixer(fromCurrency, toCurrency) {
    try {
      const apiKey = process.env.FIXER_API_KEY;
      if (!apiKey) {
        throw new Error('Fixer.io API key not configured');
      }

      const url = `http://data.fixer.io/api/latest?access_key=${apiKey}&base=${fromCurrency.toUpperCase()}&symbols=${toCurrency.toUpperCase()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Fixer.io API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Fixer.io API error: ${data.error?.info || 'Unknown error'}`);
      }

      if (!data.rates || !data.rates[toCurrency.toUpperCase()]) {
        throw new Error(`Currency ${toCurrency} not found in Fixer.io response`);
      }

      return {
        rate: data.rates[toCurrency.toUpperCase()],
        source: 'fixer-api',
        provider: 'Fixer.io',
        timestamp: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Fixer.io fetch failed: ${error.message}`);
    }
  }

  /**
   * Fetch exchange rate from CurrencyAPI
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Object} Rate data
   */
  async fetchFromCurrencyAPI(fromCurrency, toCurrency) {
    try {
      const apiKey = process.env.CURRENCY_API_KEY;
      if (!apiKey) {
        throw new Error('CurrencyAPI key not configured');
      }

      const url = `https://api.currencyapi.com/v3/latest?apikey=${apiKey}&base_currency=${fromCurrency.toUpperCase()}&currencies=${toCurrency.toUpperCase()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`CurrencyAPI error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data[toCurrency.toUpperCase()]) {
        throw new Error(`Currency ${toCurrency} not found in CurrencyAPI response`);
      }

      const currencyData = data.data[toCurrency.toUpperCase()];

      return {
        rate: currencyData.value,
        source: 'currency-api',
        provider: 'CurrencyAPI',
        timestamp: data.meta?.last_updated_at || new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`CurrencyAPI fetch failed: ${error.message}`);
    }
  }

  /**
   * Convert amount between currencies with enhanced date handling
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @param {Date} date - Date for conversion (default: today)
   * @param {boolean} allowFallback - Whether to allow fallback to nearest rate
   * @returns {Object} Conversion result
   */
  async convertAmount(amount, fromCurrency, toCurrency, date = new Date(), allowFallback = true) {
    try {
      // First try the standard conversion method
      const convertedAmount = await this.CurrencyExchange.convertAmount(amount, fromCurrency, toCurrency, date);
      const rate = await this.CurrencyExchange.getRate(fromCurrency, toCurrency, date);
      
      return {
        originalAmount: amount,
        convertedAmount,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        exchangeRate: rate,
        date: date.toISOString(),
        source: 'exact-rate',
        fallback: false
      };
    } catch (error) {
      // If conversion fails, try to get rate for the specific date with fallback
      try {
        const rateInfo = await this.getRateForDate(fromCurrency, toCurrency, date, allowFallback);
        const convertedAmount = amount * rateInfo.rate;
        
        return {
          originalAmount: amount,
          convertedAmount,
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          exchangeRate: rateInfo.rate,
          date: date.toISOString(),
          rateDate: rateInfo.rateDate ? rateInfo.rateDate.toISOString() : date.toISOString(),
          source: rateInfo.source,
          fallback: rateInfo.fallback,
          daysDifference: rateInfo.daysDifference
        };
      } catch (retryError) {
        logger.error(`Currency conversion failed for ${amount} ${fromCurrency} to ${toCurrency} on ${date.toDateString()}:`, retryError);
        throw retryError;
      }
    }
  }

  /**
   * Get common currency pairs that should always be available
   * @returns {Array} Array of currency pair strings
   */
  getCommonCurrencyPairs() {
    const commonPairs = [];
    const baseCurrencies = ['USD', 'EUR', 'ILS'];
    const targetCurrencies = ['USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CAD', 'CHF', 'AUD'];
    
    baseCurrencies.forEach(base => {
      targetCurrencies.forEach(target => {
        if (base !== target) {
          commonPairs.push(`${base}/${target}`);
        }
      });
    });
    
    return commonPairs;
  }

  /**
   * Check and update today's exchange rates on startup
   * @returns {Object} Update summary
   */
  async checkAndUpdateTodaysRates() {
    try {
      logger.info('Checking for today\'s exchange rates...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get common currency pairs that should have rates
      const commonPairs = this.getCommonCurrencyPairs();
      const pairsNeedingUpdate = [];
      
      for (const pair of commonPairs) {
        const [fromCurrency, toCurrency] = pair.split('/');
        const existingRate = await this.CurrencyExchange.findOne({
          fromCurrency,
          toCurrency,
          date: {
            $gte: today
          }
        });
        
        if (!existingRate) {
          pairsNeedingUpdate.push(pair);
        }
      }

      const updateResults = {
        total: commonPairs.length,
        needingUpdate: pairsNeedingUpdate.length,
        updated: 0,
        failed: 0,
        errors: [],
        skipped: commonPairs.length - pairsNeedingUpdate.length
      };

      if (pairsNeedingUpdate.length === 0) {
        logger.info('All currency pairs have today\'s rates - no updates needed');
        return updateResults;
      }

      logger.info(`Found ${pairsNeedingUpdate.length} currency pairs needing today's rates: ${pairsNeedingUpdate.join(', ')}`);

      // Update pairs that need today's rates
      const batchSize = 3;
      for (let i = 0; i < pairsNeedingUpdate.length; i += batchSize) {
        const batch = pairsNeedingUpdate.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (pair) => {
            try {
              const [fromCurrency, toCurrency] = pair.split('/');
              await this.updateExchangeRate(fromCurrency, toCurrency);
              updateResults.updated++;
              logger.info(`Updated today's rate for ${pair}`);
            } catch (error) {
              updateResults.failed++;
              updateResults.errors.push({
                pair: pair,
                error: error.message
              });
              logger.warn(`Failed to update today's rate for ${pair}:`, error.message);
            }
          })
        );

        // Wait between batches to respect rate limits
        if (i + batchSize < pairsNeedingUpdate.length) {
          await this.delay(2000); // 2 second delay between batches
        }
      }

      logger.info(`Today's exchange rate check completed: ${updateResults.updated} updated, ${updateResults.failed} failed, ${updateResults.skipped} already current`);
      return updateResults;
      
    } catch (error) {
      logger.error('Error checking today\'s exchange rates:', error);
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
        logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
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
   * Manual rate update for admin/testing
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @param {number} rate - Manual rate
   * @param {Date} date - Date for the rate (default: today)
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Updated exchange rate
   */
  async setManualRate(fromCurrency, toCurrency, rate, date = new Date(), metadata = {}) {
    try {
      const exchangeRate = await this.CurrencyExchange.updateRate(
        fromCurrency.toUpperCase(),
        toCurrency.toUpperCase(),
        rate,
        date,
        'manual',
        metadata
      );

      logger.info(`Manually set exchange rate ${fromCurrency}/${toCurrency} on ${date.toDateString()}: ${rate}`);
      
      return exchangeRate;
    } catch (error) {
      logger.error(`Error setting manual exchange rate for ${fromCurrency}/${toCurrency}:`, error);
      throw error;
    }
  }
}

module.exports = new CurrencyExchangeService();
