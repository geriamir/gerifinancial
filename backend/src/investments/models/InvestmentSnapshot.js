const mongoose = require('mongoose');

const holdingSnapshotSchema = new mongoose.Schema({
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
    required: true,
    min: 0
  },
  price: {
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
    default: 'ILS'
  },
  sector: {
    type: String,
    required: false
  },
  holdingType: {
    type: String,
    enum: ['stock', 'bond', 'etf', 'mutual_fund', 'other'],
    default: 'stock'
  }
}, { _id: false });

const investmentSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  investmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    required: true
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  // Portfolio values for this day
  totalValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalMarketValue: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  cashBalance: {
    type: Number,
    required: true,
    min: 0,
    default: 0
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
    default: 'ILS'
  },
  // Holdings snapshot for this day
  holdings: [holdingSnapshotSchema],
  // Performance metrics
  dayChange: {
    type: Number,
    default: 0
  },
  dayChangePercent: {
    type: Number,
    default: 0
  },
  // Store raw data from scraper for debugging
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  }
}, {
  timestamps: true
});

// Unique constraint: one snapshot per investment per day
investmentSnapshotSchema.index(
  { userId: 1, investmentId: 1, date: 1 }, 
  { unique: true }
);

// Efficient queries for historical data
investmentSnapshotSchema.index({ userId: 1, date: -1 });
investmentSnapshotSchema.index({ investmentId: 1, date: -1 });
investmentSnapshotSchema.index({ bankAccountId: 1, date: -1 });
investmentSnapshotSchema.index({ date: -1 });

// Virtual for calculating total portfolio value
investmentSnapshotSchema.virtual('calculatedTotalValue').get(function() {
  return (this.balance || 0) + (this.totalMarketValue || 0) + (this.cashBalance || 0);
});

// Static method to get historical values for a specific investment
investmentSnapshotSchema.statics.getHistoricalValues = function(investmentId, startDate, endDate) {
  const query = { investmentId };
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }
  
  return this.find(query)
    .sort({ date: 1 })
    .select('-rawData'); // Exclude raw data for performance
};

// Static method to get portfolio history aggregated by date
investmentSnapshotSchema.statics.getPortfolioHistory = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  
  const pipeline = [
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(userId), 
        date: { $gte: startDate } 
      } 
    },
    {
      $group: {
        _id: '$date',
        totalValue: { $sum: '$totalValue' },
        totalMarketValue: { $sum: '$totalMarketValue' },
        totalCashBalance: { $sum: '$cashBalance' },
        totalBalance: { $sum: '$balance' },
        dayChange: { $sum: '$dayChange' },
        accountCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        totalValue: 1,
        totalMarketValue: 1,
        totalCashBalance: 1,
        totalBalance: 1,
        dayChange: 1,
        dayChangePercent: {
          $cond: {
            if: { $gt: [{ $subtract: ['$totalValue', '$dayChange'] }, 0] },
            then: { 
              $multiply: [
                { $divide: ['$dayChange', { $subtract: ['$totalValue', '$dayChange'] }] },
                100
              ]
            },
            else: 0
          }
        },
        accountCount: 1
      }
    },
    { $sort: { date: 1 } }
  ];

  return this.aggregate(pipeline);
};

// Static method to get latest snapshot for each investment
investmentSnapshotSchema.statics.getLatestSnapshots = function(userId, investmentIds = null) {
  const matchStage = { userId: new mongoose.Types.ObjectId(userId) };
  
  if (investmentIds && investmentIds.length > 0) {
    matchStage.investmentId = { 
      $in: investmentIds.map(id => new mongoose.Types.ObjectId(id)) 
    };
  }
  
  const pipeline = [
    { $match: matchStage },
    { $sort: { investmentId: 1, date: -1 } },
    {
      $group: {
        _id: '$investmentId',
        latestSnapshot: { $first: '$$ROOT' }
      }
    },
    { $replaceRoot: { newRoot: '$latestSnapshot' } },
    { $sort: { date: -1 } }
  ];

  return this.aggregate(pipeline);
};

// Static method to get holdings evolution over time
investmentSnapshotSchema.statics.getHoldingsHistory = async function(userId, symbol, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  
  const pipeline = [
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(userId), 
        date: { $gte: startDate },
        'holdings.symbol': symbol
      } 
    },
    { $unwind: '$holdings' },
    { $match: { 'holdings.symbol': symbol } },
    {
      $group: {
        _id: '$date',
        totalQuantity: { $sum: '$holdings.quantity' },
        averagePrice: { $avg: '$holdings.price' },
        totalMarketValue: { $sum: '$holdings.marketValue' },
        accounts: { $addToSet: '$investmentId' }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        totalQuantity: 1,
        averagePrice: 1,
        totalMarketValue: 1,
        accountCount: { $size: '$accounts' }
      }
    },
    { $sort: { date: 1 } }
  ];

  return this.aggregate(pipeline);
};

// Static method to calculate performance metrics
investmentSnapshotSchema.statics.getPerformanceMetrics = async function(userId, days = 30) {
  const history = await this.getPortfolioHistory(userId, days);
  
  if (history.length < 2) {
    return {
      totalGain: 0,
      totalGainPercent: 0,
      periodStart: null,
      periodEnd: null,
      daysTracked: history.length,
      averageDailyChange: 0,
      volatility: 0
    };
  }
  
  const firstDay = history[0];
  const lastDay = history[history.length - 1];
  
  const totalGain = lastDay.totalValue - firstDay.totalValue;
  const totalGainPercent = firstDay.totalValue > 0 
    ? (totalGain / firstDay.totalValue) * 100 
    : 0;
  
  // Calculate average daily change
  const dailyChanges = history.map(day => day.dayChange || 0);
  const averageDailyChange = dailyChanges.reduce((sum, change) => sum + change, 0) / dailyChanges.length;
  
  // Calculate volatility (standard deviation of daily changes)
  const variance = dailyChanges.reduce((sum, change) => {
    return sum + Math.pow(change - averageDailyChange, 2);
  }, 0) / dailyChanges.length;
  const volatility = Math.sqrt(variance);
  
  return {
    totalGain,
    totalGainPercent,
    periodStart: firstDay.date,
    periodEnd: lastDay.date,
    daysTracked: history.length,
    averageDailyChange,
    volatility,
    startValue: firstDay.totalValue,
    endValue: lastDay.totalValue
  };
};

// Method to update performance metrics
investmentSnapshotSchema.methods.calculateDayChange = async function() {
  const yesterday = new Date(this.date);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const yesterdaySnapshot = await this.constructor.findOne({
    investmentId: this.investmentId,
    date: yesterday
  });
  
  if (yesterdaySnapshot && yesterdaySnapshot.totalValue > 0) {
    this.dayChange = this.totalValue - yesterdaySnapshot.totalValue;
    this.dayChangePercent = (this.dayChange / yesterdaySnapshot.totalValue) * 100;
  } else {
    this.dayChange = 0;
    this.dayChangePercent = 0;
  }
  
  return this;
};

module.exports = mongoose.model('InvestmentSnapshot', investmentSnapshotSchema);
