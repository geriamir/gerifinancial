const mongoose = require('mongoose');

const stockPriceSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 10,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  source: {
    type: String,
    enum: ['yahoo', 'alphavantage', 'finnhub', 'manual'],
    required: true,
    default: 'manual'
  },
  change: {
    type: Number,
    default: 0
  },
  changePercent: {
    type: Number,
    default: 0
  },
  volume: {
    type: Number,
    min: 0,
    default: 0
  },
  marketCap: {
    type: Number,
    min: 0,
    default: 0
  },
  open: {
    type: Number,
    min: 0
  },
  high: {
    type: Number,
    min: 0
  },
  low: {
    type: Number,
    min: 0
  },
  close: {
    type: Number,
    min: 0
  },
  metadata: {
    companyName: {
      type: String,
      trim: true,
      maxlength: 200
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      maxlength: 3
    },
    exchange: {
      type: String,
      trim: true,
      maxlength: 50
    },
    sector: {
      type: String,
      trim: true,
      maxlength: 100
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
stockPriceSchema.index({ symbol: 1, date: 1 }, { unique: true }); // One record per symbol+date
stockPriceSchema.index({ symbol: 1, date: -1 }); // For latest price queries
stockPriceSchema.index({ date: -1 }); // For date-based queries
stockPriceSchema.index({ symbol: 1, isActive: 1 });
stockPriceSchema.index({ createdAt: -1 }); // For cleanup operations

// Virtual fields
stockPriceSchema.virtual('isToday').get(function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.date >= today && this.date < tomorrow;
});

stockPriceSchema.virtual('isStale').get(function() {
  const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  return (Date.now() - this.updatedAt) > staleThreshold;
});

// Instance methods
stockPriceSchema.methods.updatePrice = function(newPrice, source = 'manual', metadata = {}) {
  const oldPrice = this.price;
  this.price = newPrice;
  this.source = source;
  this.change = newPrice - oldPrice;
  this.changePercent = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
  
  // Update metadata if provided
  if (metadata.volume !== undefined) this.volume = metadata.volume;
  if (metadata.marketCap !== undefined) this.marketCap = metadata.marketCap;
  if (metadata.open !== undefined) this.open = metadata.open;
  if (metadata.high !== undefined) this.high = metadata.high;
  if (metadata.low !== undefined) this.low = metadata.low;
  if (metadata.close !== undefined) this.close = metadata.close;
  if (metadata.companyName) this.metadata.companyName = metadata.companyName;
  if (metadata.exchange) this.metadata.exchange = metadata.exchange;
  if (metadata.sector) this.metadata.sector = metadata.sector;
  
  return this;
};

// Static methods

/**
 * Get the latest price for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Object} Latest stock price record
 */
stockPriceSchema.statics.getLatestPrice = async function(symbol) {
  return this.findOne({ 
    symbol: symbol.toUpperCase(), 
    isActive: true 
  }).sort({ date: -1 });
};

/**
 * Get price for a specific symbol and date
 * @param {string} symbol - Stock symbol
 * @param {Date} date - Specific date
 * @returns {Object} Stock price record for that date
 */
stockPriceSchema.statics.getPriceOnDate = async function(symbol, date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  return this.findOne({
    symbol: symbol.toUpperCase(),
    date: {
      $gte: targetDate,
      $lt: nextDay
    },
    isActive: true
  });
};

/**
 * Get price history for a symbol within a date range
 * @param {string} symbol - Stock symbol
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Array of stock price records
 */
stockPriceSchema.statics.getPriceHistory = async function(symbol, startDate, endDate) {
  return this.find({
    symbol: symbol.toUpperCase(),
    date: {
      $gte: startDate,
      $lte: endDate
    },
    isActive: true
  }).sort({ date: 1 });
};

/**
 * Create or update a stock price record
 * @param {string} symbol - Stock symbol
 * @param {Date} date - Price date
 * @param {number} price - Stock price
 * @param {string} source - Data source
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Created or updated stock price record
 */
stockPriceSchema.statics.upsertPrice = async function(symbol, date, price, source = 'manual', metadata = {}) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const updateData = {
    symbol: symbol.toUpperCase(),
    date: targetDate,
    price,
    source,
    change: metadata.change || 0,
    changePercent: metadata.changePercent || 0,
    volume: metadata.volume || 0,
    marketCap: metadata.marketCap || 0,
    open: metadata.open,
    high: metadata.high,
    low: metadata.low,
    close: metadata.close,
    isActive: true
  };
  
  if (metadata.companyName) updateData['metadata.companyName'] = metadata.companyName;
  if (metadata.exchange) updateData['metadata.exchange'] = metadata.exchange;
  if (metadata.sector) updateData['metadata.sector'] = metadata.sector;
  if (metadata.currency) updateData['metadata.currency'] = metadata.currency;
  
  return this.findOneAndUpdate(
    { symbol: symbol.toUpperCase(), date: targetDate },
    { $set: updateData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Bulk upsert multiple price records
 * @param {Array} priceData - Array of price data objects
 * @returns {Object} Bulk operation result
 */
stockPriceSchema.statics.bulkUpsertPrices = async function(priceData) {
  const bulkOps = priceData.map(data => {
    const targetDate = new Date(data.date);
    targetDate.setHours(0, 0, 0, 0);
    
    const updateData = {
      symbol: data.symbol.toUpperCase(),
      date: targetDate,
      price: data.price,
      source: data.source || 'manual',
      change: data.change || 0,
      changePercent: data.changePercent || 0,
      volume: data.volume || 0,
      marketCap: data.marketCap || 0,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      isActive: true
    };
    
    if (data.metadata) {
      if (data.metadata.companyName) updateData['metadata.companyName'] = data.metadata.companyName;
      if (data.metadata.exchange) updateData['metadata.exchange'] = data.metadata.exchange;
      if (data.metadata.sector) updateData['metadata.sector'] = data.metadata.sector;
      if (data.metadata.currency) updateData['metadata.currency'] = data.metadata.currency;
    }
    
    return {
      updateOne: {
        filter: { symbol: data.symbol.toUpperCase(), date: targetDate },
        update: { $set: updateData },
        upsert: true
      }
    };
  });
  
  return this.bulkWrite(bulkOps);
};

/**
 * Get all active symbols
 * @returns {Array} Array of unique active symbols with latest price info
 */
stockPriceSchema.statics.getActiveSymbols = async function() {
  return this.aggregate([
    { $match: { isActive: true } },
    { $sort: { symbol: 1, date: -1 } },
    {
      $group: {
        _id: '$symbol',
        symbol: { $first: '$symbol' },
        latestPrice: { $first: '$price' },
        latestDate: { $first: '$date' },
        companyName: { $first: '$metadata.companyName' },
        exchange: { $first: '$metadata.exchange' }
      }
    },
    {
      $project: {
        _id: 0,
        symbol: 1,
        price: '$latestPrice',
        lastUpdated: '$latestDate',
        'metadata.companyName': '$companyName',
        'metadata.exchange': '$exchange'
      }
    },
    { $sort: { symbol: 1 } }
  ]);
};

/**
 * Get stale prices (older than specified hours)
 * @param {number} hours - Hours threshold for staleness
 * @returns {Array} Array of stale price records
 */
stockPriceSchema.statics.getStalePrices = async function(hours = 24) {
  const staleThreshold = new Date();
  staleThreshold.setHours(staleThreshold.getHours() - hours);
  
  return this.aggregate([
    { $match: { isActive: true } },
    { $sort: { symbol: 1, date: -1 } },
    {
      $group: {
        _id: '$symbol',
        symbol: { $first: '$symbol' },
        latestDate: { $first: '$date' },
        latestPrice: { $first: '$price' }
      }
    },
    {
      $match: {
        latestDate: { $lt: staleThreshold }
      }
    }
  ]);
};

/**
 * Clean up old price records
 * @param {number} daysToKeep - Number of days of history to keep
 * @returns {Object} Deletion result
 */
stockPriceSchema.statics.cleanupOldPrices = function(daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.deleteMany({
    date: { $lt: cutoffDate }
  });
};

/**
 * Get market summary statistics
 * @param {Array} symbols - Optional array of symbols to include
 * @returns {Object} Market summary
 */
stockPriceSchema.statics.getMarketSummary = function(symbols = []) {
  const match = symbols.length > 0 ? { symbol: { $in: symbols.map(s => s.toUpperCase()) } } : {};
  
  return this.aggregate([
    { $match: { ...match, isActive: true } },
    { $sort: { symbol: 1, date: -1 } },
    {
      $group: {
        _id: '$symbol',
        latestPrice: { $first: '$price' },
        latestChange: { $first: '$change' },
        latestVolume: { $first: '$volume' },
        latestMarketCap: { $first: '$marketCap' }
      }
    },
    {
      $group: {
        _id: null,
        totalSymbols: { $sum: 1 },
        averagePrice: { $avg: '$latestPrice' },
        totalMarketCap: { $sum: '$latestMarketCap' },
        totalVolume: { $sum: '$latestVolume' },
        positiveMovers: {
          $sum: {
            $cond: [{ $gt: ['$latestChange', 0] }, 1, 0]
          }
        },
        negativeMovers: {
          $sum: {
            $cond: [{ $lt: ['$latestChange', 0] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalSymbols: 1,
        averagePrice: { $round: ['$averagePrice', 2] },
        totalMarketCap: 1,
        totalVolume: 1,
        positiveMovers: 1,
        negativeMovers: 1,
        neutralMovers: { $subtract: ['$totalSymbols', { $add: ['$positiveMovers', '$negativeMovers'] }] }
      }
    }
  ]);
};

/**
 * Get price changes for a symbol over specified days
 * @param {string} symbol - Stock symbol
 * @param {number} days - Number of days back to calculate change
 * @returns {Object} Price change information
 */
stockPriceSchema.statics.getPriceChange = async function(symbol, days = 1) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  
  const prices = await this.find({
    symbol: symbol.toUpperCase(),
    date: { $gte: startDate, $lte: endDate },
    isActive: true
  }).sort({ date: -1 }).limit(2);
  
  if (prices.length < 2) {
    return { change: 0, changePercent: 0 };
  }
  
  const latest = prices[0];
  const previous = prices[1];
  const change = latest.price - previous.price;
  const changePercent = previous.price > 0 ? (change / previous.price) * 100 : 0;
  
  return { 
    change, 
    changePercent, 
    fromPrice: previous.price, 
    fromDate: previous.date,
    toPrice: latest.price,
    toDate: latest.date
  };
};

/**
 * Get moving average for a symbol
 * @param {string} symbol - Stock symbol
 * @param {number} days - Number of days for moving average
 * @returns {number} Moving average price
 */
stockPriceSchema.statics.getMovingAverage = async function(symbol, days = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const prices = await this.find({
    symbol: symbol.toUpperCase(),
    date: { $gte: startDate, $lte: endDate },
    isActive: true
  }).sort({ date: -1 }).limit(days);
  
  if (prices.length === 0) {
    return 0;
  }
  
  const sum = prices.reduce((total, p) => total + p.price, 0);
  return sum / prices.length;
};

const StockPrice = mongoose.model('StockPrice', stockPriceSchema);

module.exports = StockPrice;
