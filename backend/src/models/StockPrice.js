const mongoose = require('mongoose');

const historicalPriceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const stockPriceSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: 10
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  priceDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    enum: ['yahoo', 'alphavantage', 'manual'],
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
  historicalPrices: {
    type: [historicalPriceSchema],
    default: [],
    validate: {
      validator: function(prices) {
        return prices.length <= 365; // Limit to 1 year of daily prices
      },
      message: 'Historical prices cannot exceed 365 entries'
    }
  },
  isActive: {
    type: Boolean,
    default: true
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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
stockPriceSchema.index({ symbol: 1 }, { unique: true });
stockPriceSchema.index({ lastUpdated: 1 });
stockPriceSchema.index({ source: 1 });
stockPriceSchema.index({ isActive: 1 });

// Virtual fields
stockPriceSchema.virtual('isStale').get(function() {
  const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  return (Date.now() - this.lastUpdated) > staleThreshold;
});

stockPriceSchema.virtual('priceHistory30Days').get(function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.historicalPrices
    .filter(p => p.date >= thirtyDaysAgo)
    .sort((a, b) => a.date - b.date);
});

stockPriceSchema.virtual('priceHistory7Days').get(function() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return this.historicalPrices
    .filter(p => p.date >= sevenDaysAgo)
    .sort((a, b) => a.date - b.date);
});

// Pre-save middleware
stockPriceSchema.pre('save', function(next) {
  // Update lastUpdated timestamp
  this.lastUpdated = new Date();
  
  // Add current price to historical prices if it's a new day or date
  const priceDateStr = this.priceDate.toDateString();
  const existingEntry = this.historicalPrices.find(p => p.date.toDateString() === priceDateStr);
  
  if (!existingEntry) {
    // Add new historical entry
    this.historicalPrices.push({
      date: this.priceDate,
      price: this.price
    });
    
    // Sort by date (most recent last)
    this.historicalPrices.sort((a, b) => a.date - b.date);
    
    // Keep only last 365 days
    if (this.historicalPrices.length > 365) {
      this.historicalPrices = this.historicalPrices.slice(-365);
    }
  } else {
    // Update existing entry if price is different
    if (existingEntry.price !== this.price) {
      existingEntry.price = this.price;
    }
  }
  
  next();
});

// Instance methods
stockPriceSchema.methods.isSameDay = function(date1, date2) {
  return date1.toDateString() === date2.toDateString();
};

stockPriceSchema.methods.updatePrice = function(newPrice, source = 'manual', metadata = {}) {
  const oldPrice = this.price;
  this.price = newPrice;
  this.source = source;
  this.change = newPrice - oldPrice;
  this.changePercent = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
  
  // Update metadata if provided
  if (metadata.volume !== undefined) this.volume = metadata.volume;
  if (metadata.marketCap !== undefined) this.marketCap = metadata.marketCap;
  if (metadata.companyName) this.metadata.companyName = metadata.companyName;
  if (metadata.exchange) this.metadata.exchange = metadata.exchange;
  if (metadata.sector) this.metadata.sector = metadata.sector;
  
  return this;
};

stockPriceSchema.methods.getPriceChange = function(days = 1) {
  if (this.historicalPrices.length < days) {
    return { change: 0, changePercent: 0 };
  }
  
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - days);
  
  // Find the closest historical price to the target date
  let closestPrice = null;
  let minDiff = Infinity;
  
  for (const historical of this.historicalPrices) {
    const diff = Math.abs(historical.date - targetDate);
    if (diff < minDiff) {
      minDiff = diff;
      closestPrice = historical;
    }
  }
  
  if (!closestPrice) {
    return { change: 0, changePercent: 0 };
  }
  
  const change = this.price - closestPrice.price;
  const changePercent = closestPrice.price > 0 ? (change / closestPrice.price) * 100 : 0;
  
  return { change, changePercent, fromPrice: closestPrice.price, fromDate: closestPrice.date };
};

stockPriceSchema.methods.getMovingAverage = function(days = 30) {
  const relevantPrices = this.historicalPrices.slice(-days);
  
  if (relevantPrices.length === 0) {
    return this.price;
  }
  
  const sum = relevantPrices.reduce((total, p) => total + p.price, 0);
  return sum / relevantPrices.length;
};

// Static methods
stockPriceSchema.statics.findOrCreate = async function(symbol, initialPrice = 0, source = 'manual') {
  let stockPrice = await this.findOne({ symbol: symbol.toUpperCase() });
  
  if (!stockPrice) {
    stockPrice = new this({
      symbol: symbol.toUpperCase(),
      price: initialPrice,
      source,
      lastUpdated: new Date()
    });
    await stockPrice.save();
  }
  
  return stockPrice;
};

stockPriceSchema.statics.getActiveSymbols = function() {
  return this.find({ isActive: true }).select('symbol metadata.companyName price lastUpdated');
};

stockPriceSchema.statics.getStalePrices = function(hours = 24) {
  const staleThreshold = new Date();
  staleThreshold.setHours(staleThreshold.getHours() - hours);
  
  return this.find({
    isActive: true,
    lastUpdated: { $lt: staleThreshold }
  });
};

stockPriceSchema.statics.bulkUpdatePrices = async function(priceUpdates) {
  const bulkOps = priceUpdates.map(update => ({
    updateOne: {
      filter: { symbol: update.symbol.toUpperCase() },
      update: {
        $set: {
          price: update.price,
          source: update.source || 'api',
          change: update.change || 0,
          changePercent: update.changePercent || 0,
          volume: update.volume || 0,
          marketCap: update.marketCap || 0,
          lastUpdated: new Date(),
          'metadata.companyName': update.companyName || undefined,
          'metadata.exchange': update.exchange || undefined,
          'metadata.sector': update.sector || undefined
        }
      },
      upsert: true
    }
  }));
  
  return this.bulkWrite(bulkOps);
};

stockPriceSchema.statics.cleanupOldPrices = function(daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.updateMany(
    {},
    {
      $pull: {
        historicalPrices: {
          date: { $lt: cutoffDate }
        }
      }
    }
  );
};

stockPriceSchema.statics.getMarketSummary = function(symbols = []) {
  const match = symbols.length > 0 ? { symbol: { $in: symbols.map(s => s.toUpperCase()) } } : {};
  
  return this.aggregate([
    { $match: { ...match, isActive: true } },
    {
      $group: {
        _id: null,
        totalSymbols: { $sum: 1 },
        averagePrice: { $avg: '$price' },
        totalMarketCap: { $sum: '$marketCap' },
        totalVolume: { $sum: '$volume' },
        positiveMovers: {
          $sum: {
            $cond: [{ $gt: ['$change', 0] }, 1, 0]
          }
        },
        negativeMovers: {
          $sum: {
            $cond: [{ $lt: ['$change', 0] }, 1, 0]
          }
        },
        lastUpdated: { $max: '$lastUpdated' }
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
        neutralMovers: { $subtract: ['$totalSymbols', { $add: ['$positiveMovers', '$negativeMovers'] }] },
        lastUpdated: 1
      }
    }
  ]);
};

const StockPrice = mongoose.model('StockPrice', stockPriceSchema);

module.exports = StockPrice;
