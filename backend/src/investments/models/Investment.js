const mongoose = require('mongoose');
const INVESTMENT_CONSTANTS = require('../constants/investmentConstants');

const holdingSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: false
  },
  quantity: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    required: false,
    min: 0
  },
  marketValue: {
    type: Number,
    required: false
  },
  currency: {
    type: String,
    default: INVESTMENT_CONSTANTS.DEFAULT_CURRENCY
  },
  sector: {
    type: String,
    required: false
  },
  holdingType: {
    type: String,
    enum: Object.values(INVESTMENT_CONSTANTS.HOLDING_TYPES),
    default: INVESTMENT_CONSTANTS.HOLDING_TYPES.STOCK
  }
}, { _id: false });

const investmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true
  },
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
    required: false
  },
  externalPortfolioId: {
    type: String,
    required: false
  },
  accountNumber: {
    type: String,
    required: true
  },
  accountType: {
    type: String,
    enum: Object.values(INVESTMENT_CONSTANTS.ACCOUNT_TYPES),
    default: INVESTMENT_CONSTANTS.ACCOUNT_TYPES.INVESTMENT
  },
  accountName: {
    type: String,
    required: false
  },
  balance: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    required: true,
    default: INVESTMENT_CONSTANTS.DEFAULT_CURRENCY
  },
  holdings: [holdingSchema],
  totalMarketValue: {
    type: Number,
    default: 0
  },
  cashBalance: {
    type: Number,
    min: 0,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: Object.values(INVESTMENT_CONSTANTS.STATUS_TYPES),
    default: INVESTMENT_CONSTANTS.STATUS_TYPES.ACTIVE
  },
  // Store raw data from scraper for debugging and future enhancements
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
investmentSchema.index({ userId: 1, bankAccountId: 1 });
investmentSchema.index({ userId: 1, accountNumber: 1 });
investmentSchema.index({ userId: 1, status: 1 });
investmentSchema.index({ lastUpdated: -1 });

// Virtual for total portfolio value (balance + market value)
investmentSchema.virtual('totalValue').get(function() {
  return (this.balance || 0) + (this.totalMarketValue || 0) + (this.cashBalance || 0);
});

// Method to calculate total market value from holdings
investmentSchema.methods.calculateMarketValue = function() {
  if (!this.holdings || this.holdings.length === 0) {
    this.totalMarketValue = 0;
    return 0;
  }

  this.totalMarketValue = this.holdings.reduce((total, holding) => {
    // Ensure all values are valid numbers
    const quantity = Number(holding.quantity) || 0;
    const currentPrice = Number(holding.currentPrice) || 0;
    const marketValue = Number(holding.marketValue) || (quantity * currentPrice);
    
    // Only add to total if marketValue is a finite number
    return total + (Number.isFinite(marketValue) ? marketValue : 0);
  }, 0);

  // Ensure the result is a finite number
  this.totalMarketValue = Number.isFinite(this.totalMarketValue) ? this.totalMarketValue : 0;
  
  return this.totalMarketValue;
};

// Method to update holding prices
investmentSchema.methods.updateHoldingPrices = function(priceUpdates) {
  if (!this.holdings || !priceUpdates) return;

  this.holdings.forEach(holding => {
    if (priceUpdates[holding.symbol]) {
      holding.currentPrice = priceUpdates[holding.symbol];
      holding.marketValue = holding.quantity * holding.currentPrice;
    }
  });

  this.calculateMarketValue();
  this.lastUpdated = new Date();
};

// Static method to find investments by user
investmentSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId, status: 'active' };
  
  if (options.bankAccountId) {
    query.bankAccountId = options.bankAccountId;
  }
  
  return this.find(query)
    .populate('bankAccountId', 'name bankId')
    .sort({ lastUpdated: -1 });
};

// Static method to get portfolio summary for user
investmentSchema.statics.getPortfolioSummary = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
        totalMarketValue: { $sum: '$totalMarketValue' },
        totalCashBalance: { $sum: '$cashBalance' },
        accountCount: { $sum: 1 },
        lastUpdated: { $max: '$lastUpdated' },
        currencies: { $addToSet: '$currency' }
      }
    },
    {
      $project: {
        _id: 0,
        totalBalance: 1,
        totalMarketValue: 1,
        totalCashBalance: 1,
        totalValue: { $add: ['$totalBalance', '$totalMarketValue', '$totalCashBalance'] },
        accountCount: 1,
        lastUpdated: 1,
        currencies: 1
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  const summary = result[0] || {
    totalBalance: 0,
    totalMarketValue: 0,
    totalCashBalance: 0,
    totalValue: 0,
    accountCount: 0,
    lastUpdated: null,
    currencies: []
  };

  // Use single currency if all accounts share one, otherwise default to ILS
  summary.currency = summary.currencies?.length === 1 ? summary.currencies[0] : 'ILS';
  delete summary.currencies;
  return summary;
};

// Static method to get holdings summary across all accounts
investmentSchema.statics.getHoldingsSummary = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
    { $unwind: '$holdings' },
    {
      $group: {
        _id: '$holdings.symbol',
        symbol: { $first: '$holdings.symbol' },
        name: { $first: '$holdings.name' },
        totalQuantity: { $sum: '$holdings.quantity' },
        averagePrice: { $avg: '$holdings.currentPrice' },
        totalMarketValue: { $sum: '$holdings.marketValue' },
        holdingType: { $first: '$holdings.holdingType' },
        sector: { $first: '$holdings.sector' }
      }
    },
    { $sort: { totalMarketValue: -1 } }
  ];

  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Investment', investmentSchema);
