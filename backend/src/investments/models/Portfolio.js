const mongoose = require('mongoose');
const INVESTMENT_CONSTANTS = require('../../shared/constants/investmentConstants');

const portfolioInvestmentSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: false
  },
  name: {
    type: String,
    required: false
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  currentPrice: {
    type: Number,
    required: false,
    min: 0
  },
  marketValue: {
    type: Number,
    required: false,
    min: 0
  },
  currency: {
    type: String,
    default: INVESTMENT_CONSTANTS.DEFAULT_CURRENCY
  },
  sector: {
    type: String,
    required: false
  },
  investmentType: {
    type: String,
    enum: Object.values(INVESTMENT_CONSTANTS.HOLDING_TYPES).concat(['commodity', 'cash']),
    default: INVESTMENT_CONSTANTS.HOLDING_TYPES.STOCK
  },
  paperId: {
    type: String,
    required: false
  },
  // Additional fields for more detailed investment info
  isin: {
    type: String,
    required: false
  },
  exchange: {
    type: String,
    required: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const portfolioSchema = new mongoose.Schema({
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
    type: String,
    required: true
  },
  portfolioName: {
    type: String,
    required: false
  },
  accountNumber: {
    type: String,
    required: false
  },
  portfolioType: {
    type: String,
    enum: Object.values(INVESTMENT_CONSTANTS.ACCOUNT_TYPES).concat(['managed', 'self_directed']),
    default: INVESTMENT_CONSTANTS.ACCOUNT_TYPES.INVESTMENT
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalMarketValue: {
    type: Number,
    min: 0,
    default: 0
  },
  cashBalance: {
    type: Number,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    required: true,
    default: INVESTMENT_CONSTANTS.DEFAULT_CURRENCY
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
  timestamps: true
});

// Indexes for efficient queries
portfolioSchema.index({ userId: 1, bankAccountId: 1 });
portfolioSchema.index({ userId: 1, portfolioId: 1 });
portfolioSchema.index({ userId: 1, status: 1 });
portfolioSchema.index({ lastUpdated: -1 });

// Method to calculate total market value from investments
portfolioSchema.methods.calculateMarketValue = function() {
  if (!this.investments || this.investments.length === 0) {
    this.totalMarketValue = 0;
    return 0;
  }

  this.totalMarketValue = this.investments.reduce((total, investment) => {
    const marketValue = investment.marketValue || (investment.quantity * (investment.currentPrice || 0));
    return total + (Number.isFinite(marketValue) ? marketValue : 0);
  }, 0);

  // Total value is market value plus cash balance
  this.totalValue = this.totalMarketValue + (this.cashBalance || 0);

  return this.totalMarketValue;
};

// Method to update investment prices
portfolioSchema.methods.updateInvestmentPrices = function(priceUpdates) {
  if (!this.investments || !priceUpdates) return;

  let hasUpdates = false;
  this.investments.forEach(investment => {
    if (priceUpdates[investment.symbol]) {
      investment.currentPrice = priceUpdates[investment.symbol];
      investment.marketValue = investment.quantity * investment.currentPrice;
      investment.lastUpdated = new Date();
      hasUpdates = true;
    }
  });

  if (hasUpdates) {
    this.calculateMarketValue();
    this.lastUpdated = new Date();
  }

  return hasUpdates;
};

// Static method to find portfolios by user
portfolioSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId, status: 'active' };
  
  if (options.bankAccountId) {
    query.bankAccountId = options.bankAccountId;
  }
  
  return this.find(query)
    .populate('bankAccountId', 'name bankId')
    .sort({ lastUpdated: -1 });
};

// Static method to get portfolio summary for user
portfolioSchema.statics.getPortfolioSummary = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
    {
      $group: {
        _id: null,
        totalValue: { $sum: '$totalValue' },
        totalMarketValue: { $sum: '$totalMarketValue' },
        totalCashBalance: { $sum: '$cashBalance' },
        portfolioCount: { $sum: 1 },
        lastUpdated: { $max: '$lastUpdated' }
      }
    },
    {
      $project: {
        _id: 0,
        totalValue: 1,
        totalMarketValue: 1,
        totalCashBalance: 1,
        portfolioCount: 1,
        lastUpdated: 1
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalValue: 0,
    totalMarketValue: 0,
    totalCashBalance: 0,
    portfolioCount: 0,
    lastUpdated: null
  };
};

// Static method to get investments summary across all portfolios
portfolioSchema.statics.getInvestmentsSummary = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
    { $unwind: '$investments' },
    {
      $group: {
        _id: '$investments.symbol',
        symbol: { $first: '$investments.symbol' },
        name: { $first: '$investments.name' },
        totalQuantity: { $sum: '$investments.quantity' },
        averagePrice: { $avg: '$investments.currentPrice' },
        totalMarketValue: { $sum: '$investments.marketValue' },
        investmentType: { $first: '$investments.investmentType' },
        sector: { $first: '$investments.sector' },
        portfolioCount: { $sum: 1 }
      }
    },
    { $sort: { totalMarketValue: -1 } }
  ];

  return this.aggregate(pipeline);
};

// Static method to get investment allocation by type
portfolioSchema.statics.getInvestmentAllocation = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
    { $unwind: '$investments' },
    {
      $group: {
        _id: '$investments.investmentType',
        investmentType: { $first: '$investments.investmentType' },
        totalValue: { $sum: '$investments.marketValue' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalValue: -1 } }
  ];

  return this.aggregate(pipeline);
};

// Static method to get sector allocation
portfolioSchema.statics.getSectorAllocation = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
    { $unwind: '$investments' },
    { $match: { 'investments.sector': { $ne: null, $ne: '' } } },
    {
      $group: {
        _id: '$investments.sector',
        sector: { $first: '$investments.sector' },
        totalValue: { $sum: '$investments.marketValue' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalValue: -1 } }
  ];

  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Portfolio', portfolioSchema);
