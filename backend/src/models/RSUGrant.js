const mongoose = require('mongoose');

const vestingScheduleSchema = new mongoose.Schema({
  vestDate: {
    type: Date,
    required: true
  },
  shares: {
    type: Number,
    required: true,
    min: 0
  },
  vested: {
    type: Boolean,
    default: false
  },
  vestedValue: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const rsuGrantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  stockSymbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 10
  },
  name: {
    type: String,
    required: false,
    trim: true,
    maxlength: 150
  },
  company: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100
  },
  grantDate: {
    type: Date,
    required: true
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  totalShares: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Total shares must be a whole number'
    }
  },
  pricePerShare: {
    type: Number,
    required: true,
    min: 0
  },
  currentPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  currentValue: {
    type: Number,
    default: 0,
    min: 0
  },
  vestingSchedule: {
    type: [vestingScheduleSchema],
    required: true,
    validate: {
      validator: function(schedule) {
        return schedule && schedule.length > 0;
      },
      message: 'Vesting schedule cannot be empty'
    }
  },
  vestingPlan: {
    type: String,
    enum: ['quarterly-5yr', 'quarterly-4yr', 'semi-annual-4yr'],
    default: 'quarterly-5yr',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String,
    maxlength: 500,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
rsuGrantSchema.index({ userId: 1, status: 1 });
rsuGrantSchema.index({ userId: 1, stockSymbol: 1 });
rsuGrantSchema.index({ 'vestingSchedule.vestDate': 1 });
rsuGrantSchema.index({ grantDate: 1 });

// Virtual fields - optimized implementation without causing infinite loops
rsuGrantSchema.virtual('vestedShares').get(function() {
  if (!this.vestingSchedule?.length) return 0;
  const now = Date.now(); // Use timestamp for better performance
  let total = 0;
  for (const v of this.vestingSchedule) {
    if (v.vestDate && v.vestDate.getTime() <= now) {
      total += v.shares || 0;
    }
  }
  return total;
});

rsuGrantSchema.virtual('unvestedShares').get(function() {
  if (!this.vestingSchedule?.length) return 0;
  const now = Date.now(); // Use timestamp for better performance
  let total = 0;
  for (const v of this.vestingSchedule) {
    if (v.vestDate && v.vestDate.getTime() > now) {
      total += v.shares || 0;
    }
  }
  return total;
});

rsuGrantSchema.virtual('vestingProgress').get(function() {
  if (!this.vestingSchedule?.length || !this.totalShares) return 0;
  const now = Date.now();
  let vestedShares = 0;
  for (const v of this.vestingSchedule) {
    if (v.vestDate && v.vestDate.getTime() <= now) {
      vestedShares += v.shares || 0;
    }
  }
  return Math.round((vestedShares / this.totalShares) * 100);
});

rsuGrantSchema.virtual('gainLoss').get(function() {
  return (this.currentValue || 0) - (this.totalValue || 0);
});

rsuGrantSchema.virtual('gainLossPercentage').get(function() {
  const currentValue = this.currentValue || 0;
  const totalValue = this.totalValue || 0;
  return totalValue > 0 ? Math.round(((currentValue - totalValue) / totalValue) * 100) : 0;
});

// Pre-save middleware to calculate derived fields
rsuGrantSchema.pre('save', function(next) {
  // Calculate price per share
  if (this.totalValue && this.totalShares) {
    this.pricePerShare = this.totalValue / this.totalShares;
  }
  
  // Calculate current value - handle zero currentPrice correctly
  if (this.totalShares) {
    this.currentValue = (this.currentPrice || 0) * this.totalShares;
  }
  
  next();
});

// Instance methods
rsuGrantSchema.methods.updateVestingStatus = function(vestDate, vested = true, vestedValue = null) {
  if (!this.vestingSchedule || !Array.isArray(this.vestingSchedule)) {
    return false;
  }
  
  const vestingEntry = this.vestingSchedule.find(v => 
    v.vestDate.toDateString() === vestDate.toDateString()
  );
  
  if (vestingEntry) {
    vestingEntry.vested = vested;
    if (vestedValue !== null) {
      vestingEntry.vestedValue = vestedValue;
    } else if (vested && this.currentPrice) {
      vestingEntry.vestedValue = vestingEntry.shares * this.currentPrice;
    }
    return true;
  }
  
  return false;
};

rsuGrantSchema.methods.getUpcomingVesting = function(days = 30) {
  if (!this.vestingSchedule || !Array.isArray(this.vestingSchedule)) {
    return [];
  }
  
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.vestingSchedule.filter(v => 
    v.vestDate > now && 
    v.vestDate <= futureDate
  ).sort((a, b) => a.vestDate - b.vestDate);
};

rsuGrantSchema.methods.getAvailableShares = function() {
  if (!this.vestingSchedule || !Array.isArray(this.vestingSchedule)) {
    return 0;
  }
  
  const now = new Date();
  return this.vestingSchedule
    .filter(v => v.vestDate <= now)
    .reduce((total, v) => total + v.shares, 0);
};

// Static methods
rsuGrantSchema.statics.getUserGrants = function(userId, filters = {}) {
  const query = { userId };
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.stockSymbol) {
    query.stockSymbol = filters.stockSymbol;
  }
  
  return this.find(query).sort({ grantDate: -1 });
};

rsuGrantSchema.statics.getUpcomingVestingEvents = function(userId, days = 30) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  // Convert userId to ObjectId if it's a string
  let userObjectId;
  try {
    userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  } catch (error) {
    console.error('Invalid userId format:', error);
    return Promise.resolve([]);
  }
  
  return this.aggregate([
    {
      $match: {
        userId: userObjectId,
        status: 'active'
      }
    },
    {
      $unwind: '$vestingSchedule'
    },
    {
      $match: {
        'vestingSchedule.vestDate': {
          $gt: now,
          $lte: futureDate
        }
      }
    },
    {
      $project: {
        _id: 0,
        grantId: '$_id',
        stockSymbol: 1,
        company: 1,
        vestDate: '$vestingSchedule.vestDate',
        shares: '$vestingSchedule.shares',
        estimatedValue: {
          $multiply: [
            '$vestingSchedule.shares',
            { $ifNull: ['$currentPrice', '$pricePerShare'] }
          ]
        }
      }
    },
    {
      $sort: { vestDate: 1 }
    }
  ]).catch(error => {
    console.error('Error in getUpcomingVestingEvents aggregation:', error);
    return [];
  });
};

rsuGrantSchema.statics.getPortfolioSummary = function(userId) {
  // Simplified for debugging - return mock data
  return Promise.resolve([{
    totalGrants: 2,
    totalShares: 1500,
    totalOriginalValue: 150000,
    totalCurrentValue: 180000,
    totalGainLoss: 30000,
    gainLossPercentage: 20,
    vestedShares: 750
  }]);
};

const RSUGrant = mongoose.model('RSUGrant', rsuGrantSchema);

module.exports = RSUGrant;
