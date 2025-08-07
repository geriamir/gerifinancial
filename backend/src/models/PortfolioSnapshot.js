const mongoose = require('mongoose');

const portfolioSnapshotInvestmentSchema = new mongoose.Schema({
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
  investmentType: {
    type: String,
    enum: ['stock', 'bond', 'etf', 'mutual_fund', 'commodity', 'cash', 'other'],
    default: 'stock'
  }
}, { _id: false });

const portfolioSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
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
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  totalMarketValue: {
    type: Number,
    required: true,
    min: 0
  },
  cashBalance: {
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
  investments: [portfolioSnapshotInvestmentSchema],
  dayChange: {
    type: Number,
    default: 0
  },
  dayChangePercent: {
    type: Number,
    default: 0
  },
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
portfolioSnapshotSchema.index({ userId: 1, date: -1 });
portfolioSnapshotSchema.index({ portfolioId: 1, date: -1 });
portfolioSnapshotSchema.index({ userId: 1, portfolioId: 1, date: -1 });
portfolioSnapshotSchema.index({ date: -1 });

// Static method to get historical values for a portfolio
portfolioSnapshotSchema.statics.getHistoricalValues = async function(portfolioId, startDate, endDate = new Date()) {
  const query = {
    portfolioId: new mongoose.Types.ObjectId(portfolioId),
    date: { $gte: startDate, $lte: endDate }
  };

  return this.find(query)
    .select('date totalValue totalMarketValue cashBalance dayChange dayChangePercent')
    .sort({ date: 1 })
    .lean();
};

// Static method to get portfolio performance history for a user
portfolioSnapshotSchema.statics.getPortfolioHistory = async function(userId, days = 30) {
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
        date: { $first: '$date' },
        totalValue: { $sum: '$totalValue' },
        totalMarketValue: { $sum: '$totalMarketValue' },
        totalCashBalance: { $sum: '$cashBalance' },
        portfolioCount: { $sum: 1 },
        dayChange: { $sum: '$dayChange' }
      }
    },
    {
      $addFields: {
        dayChangePercent: {
          $cond: {
            if: { $gt: [{ $subtract: ['$totalValue', '$dayChange'] }, 0] },
            then: { $multiply: [{ $divide: ['$dayChange', { $subtract: ['$totalValue', '$dayChange'] }] }, 100] },
            else: 0
          }
        }
      }
    },
    { $sort: { date: 1 } }
  ];

  return this.aggregate(pipeline);
};

// Static method to get performance metrics for a user
portfolioSnapshotSchema.statics.getPerformanceMetrics = async function(userId, days = 30) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const pipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$date',
        totalValue: { $sum: '$totalValue' },
        dayChange: { $sum: '$dayChange' }
      }
    },
    {
      $sort: { _id: 1 }
    },
    {
      $group: {
        _id: null,
        values: { $push: '$totalValue' },
        changes: { $push: '$dayChange' },
        startValue: { $first: '$totalValue' },
        endValue: { $last: '$totalValue' },
        daysTracked: { $sum: 1 },
        totalChange: { $sum: '$dayChange' },
        periodStart: { $first: '$_id' },
        periodEnd: { $last: '$_id' }
      }
    },
    {
      $addFields: {
        totalGain: '$totalChange',
        totalGainPercent: {
          $cond: {
            if: { $gt: ['$startValue', 0] },
            then: { $multiply: [{ $divide: ['$totalChange', '$startValue'] }, 100] },
            else: 0
          }
        },
        averageDailyChange: { $divide: ['$totalChange', '$daysTracked'] },
        volatility: {
          $sqrt: {
            $divide: [
              {
                $reduce: {
                  input: '$changes',
                  initialValue: 0,
                  in: { $add: ['$$value', { $pow: [{ $subtract: ['$$this', { $divide: ['$totalChange', '$daysTracked'] }] }, 2] }] }
                }
              },
              '$daysTracked'
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalGain: 1,
        totalGainPercent: 1,
        periodStart: 1,
        periodEnd: 1,
        daysTracked: 1,
        averageDailyChange: 1,
        volatility: 1,
        startValue: 1,
        endValue: 1
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalGain: 0,
    totalGainPercent: 0,
    periodStart: null,
    periodEnd: null,
    daysTracked: 0,
    averageDailyChange: 0,
    volatility: 0,
    startValue: 0,
    endValue: 0
  };
};

// Static method to get investment holdings history across all portfolios
portfolioSnapshotSchema.statics.getInvestmentsHistory = async function(userId, symbol, days = 90) {
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
    { $unwind: '$investments' },
    {
      $match: {
        'investments.symbol': symbol
      }
    },
    {
      $group: {
        _id: '$date',
        date: { $first: '$date' },
        totalQuantity: { $sum: '$investments.quantity' },
        averagePrice: { $avg: '$investments.price' },
        totalMarketValue: { $sum: '$investments.marketValue' },
        portfolioCount: { $sum: 1 }
      }
    },
    { $sort: { date: 1 } }
  ];

  return this.aggregate(pipeline);
};

// Static method to get latest snapshot for each portfolio of a user
portfolioSnapshotSchema.statics.getLatestSnapshots = async function(userId) {
  const pipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId)
      }
    },
    {
      $sort: { portfolioId: 1, date: -1 }
    },
    {
      $group: {
        _id: '$portfolioId',
        latestSnapshot: { $first: '$$ROOT' }
      }
    },
    {
      $replaceRoot: { newRoot: '$latestSnapshot' }
    }
  ];

  return this.aggregate(pipeline);
};

module.exports = mongoose.model('PortfolioSnapshot', portfolioSnapshotSchema);
