const mongoose = require('mongoose');

const investmentTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  investmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    required: true,
    index: true
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true,
    index: true
  },
  portfolioId: {
    type: String,
    required: true,
    index: true
  },
  
  // Security identification (from israeli-bank-scrapers)
  paperId: {
    type: String,
    required: true,
    index: true
  },
  paperName: {
    type: String,
    required: true,
    trim: true
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true
  },
  
  // Transaction details (from israeli-bank-scrapers)
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return typeof v === 'number' && !isNaN(v);
      },
      message: props => `${props.value} is not a valid amount!`
    }
  },
  value: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) {
        return typeof v === 'number' && !isNaN(v) && v >= 0;
      },
      message: props => `${props.value} is not a valid transaction value!`
    }
  },
  currency: {
    type: String,
    required: true,
    default: 'ILS',
    uppercase: true
  },
  taxSum: {
    type: Number,
    default: 0,
    min: 0
  },
  executionDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v);
      },
      message: props => `${props.value} is not a valid execution date!`
    },
    index: true
  },
  executablePrice: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        return typeof v === 'number' && !isNaN(v) && v > 0;
      },
      message: props => `${props.value} is not a valid price!`
    }
  },
  
  // Derived fields
  transactionType: {
    type: String,
    enum: ['BUY', 'SELL', 'DIVIDEND', 'OTHER'],
    required: true,
    index: true
  },
  
  // Store raw data from scraper for debugging and future enhancements
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
investmentTransactionSchema.index({ userId: 1, investmentId: 1, executionDate: -1 });
investmentTransactionSchema.index({ userId: 1, symbol: 1, executionDate: -1 });
investmentTransactionSchema.index({ bankAccountId: 1, executionDate: -1 });
investmentTransactionSchema.index({ paperId: 1, executionDate: -1 });

// Unique constraint to prevent duplicate transactions
investmentTransactionSchema.index({ 
  userId: 1, 
  investmentId: 1, 
  paperId: 1, 
  executionDate: 1, 
  amount: 1, 
  value: 1 
}, { unique: true });

// Virtual for transaction direction (buy/sell indicator)
investmentTransactionSchema.virtual('direction').get(function() {
  return this.amount > 0 ? 'BUY' : this.amount < 0 ? 'SELL' : 'NEUTRAL';
});

// Virtual for absolute transaction value
investmentTransactionSchema.virtual('absoluteAmount').get(function() {
  return Math.abs(this.amount);
});

// Virtual for total transaction cost (value + tax)
investmentTransactionSchema.virtual('totalCost').get(function() {
  return this.value + (this.taxSum || 0);
});

// Static method to classify transaction type based on amount
investmentTransactionSchema.statics.classifyTransactionType = function(amount) {
  if (amount > 0) return 'BUY';
  if (amount < 0) return 'SELL';
  return 'OTHER'; // For dividends, stock splits, etc.
};

// Static method to find transactions by investment
investmentTransactionSchema.statics.findByInvestment = function(investmentId, options = {}) {
  const query = { investmentId };
  
  if (options.startDate && options.endDate) {
    query.executionDate = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }
  
  if (options.transactionType) {
    query.transactionType = options.transactionType;
  }
  
  return this.find(query)
    .sort({ executionDate: -1 })
    .populate('investmentId', 'accountName symbol holdings')
    .populate('bankAccountId', 'name bankId');
};

// Static method to find transactions by symbol
investmentTransactionSchema.statics.findBySymbol = function(userId, symbol, options = {}) {
  const query = { userId, symbol };
  
  if (options.startDate && options.endDate) {
    query.executionDate = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }
  
  return this.find(query)
    .sort({ executionDate: -1 })
    .populate('investmentId', 'accountName')
    .populate('bankAccountId', 'name bankId');
};

// Static method to get transaction summary for user
investmentTransactionSchema.statics.getTransactionSummary = async function(userId, options = {}) {
  const matchQuery = { userId };
  
  if (options.startDate && options.endDate) {
    matchQuery.executionDate = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }
  
  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: '$transactionType',
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
        totalTax: { $sum: '$taxSum' },
        symbols: { $addToSet: '$symbol' }
      }
    },
    {
      $project: {
        _id: 0,
        transactionType: '$_id',
        count: 1,
        totalValue: 1,
        totalTax: 1,
        uniqueSymbols: { $size: '$symbols' }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to get transactions by date range with aggregation
investmentTransactionSchema.statics.getTransactionsByDateRange = async function(userId, startDate, endDate) {
  return this.find({
    userId,
    executionDate: { $gte: startDate, $lte: endDate }
  })
  .sort({ executionDate: -1 })
  .populate('investmentId', 'accountName')
  .populate('bankAccountId', 'name bankId');
};

// Static method to calculate cost basis for a symbol
investmentTransactionSchema.statics.calculateCostBasis = async function(userId, symbol) {
  const transactions = await this.find({ 
    userId, 
    symbol,
    transactionType: { $in: ['BUY', 'SELL'] }
  }).sort({ executionDate: 1 });
  
  let totalShares = 0;
  let totalCost = 0;
  let realizedGainLoss = 0;
  
  transactions.forEach(transaction => {
    if (transaction.transactionType === 'BUY') {
      totalShares += Math.abs(transaction.amount);
      totalCost += transaction.value + (transaction.taxSum || 0);
    } else if (transaction.transactionType === 'SELL') {
      const sharessSold = Math.abs(transaction.amount);
      if (totalShares > 0) {
        const avgCostPerShare = totalCost / totalShares;
        const costOfSoldShares = sharessSold * avgCostPerShare;
        realizedGainLoss += (transaction.value - (transaction.taxSum || 0)) - costOfSoldShares;
        
        // Update remaining position
        totalShares -= sharessSold;
        totalCost -= costOfSoldShares;
      }
    }
  });
  
  const avgCostPerShare = totalShares > 0 ? totalCost / totalShares : 0;
  
  return {
    symbol,
    totalShares,
    totalCost,
    avgCostPerShare,
    realizedGainLoss,
    transactionCount: transactions.length
  };
};

// Method to check if transaction is a duplicate
investmentTransactionSchema.methods.isDuplicate = async function() {
  const duplicateQuery = {
    userId: this.userId,
    investmentId: this.investmentId,
    paperId: this.paperId,
    executionDate: this.executionDate,
    amount: this.amount,
    value: this.value,
    _id: { $ne: this._id }
  };
  
  const duplicate = await this.constructor.findOne(duplicateQuery);
  return !!duplicate;
};

// Pre-save middleware to set transaction type if not provided
investmentTransactionSchema.pre('save', function(next) {
  if (!this.transactionType) {
    this.transactionType = this.constructor.classifyTransactionType(this.amount);
  }
  next();
});

module.exports = mongoose.model('InvestmentTransaction', investmentTransactionSchema);
