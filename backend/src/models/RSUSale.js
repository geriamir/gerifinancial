const mongoose = require('mongoose');

const taxBasisSchema = new mongoose.Schema({
  grantValue: {
    type: Number,
    required: true,
    min: 0
  },
  saleValue: {
    type: Number,
    required: true,
    min: 0
  },
  profitAmount: {
    type: Number,
    required: true
  },
  taxRateApplied: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  }
}, { _id: false });

const taxCalculationSchema = new mongoose.Schema({
  originalValue: {
    type: Number,
    required: true,
    min: 0
  },
  profit: {
    type: Number,
    required: true
  },
  isLongTerm: {
    type: Boolean,
    required: true
  },
  wageIncomeTax: {
    type: Number,
    required: true,
    min: 0
  },
  capitalGainsTax: {
    type: Number,
    required: true,
    min: 0
  },
  totalTax: {
    type: Number,
    required: true,
    min: 0
  },
  netValue: {
    type: Number,
    required: true,
    min: 0
  },
  taxBasis: {
    type: taxBasisSchema,
    required: true
  }
}, { _id: false });

const rsuSaleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  grantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RSUGrant',
    required: true,
    index: true
  },
  saleDate: {
    type: Date,
    required: true
  },
  sharesAmount: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Shares amount must be a whole number'
    }
  },
  pricePerShare: {
    type: Number,
    required: true,
    min: 0
  },
  totalSaleValue: {
    type: Number,
    required: true,
    min: 0
  },
  taxCalculation: {
    type: taxCalculationSchema,
    required: true
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
rsuSaleSchema.index({ userId: 1, saleDate: -1 });
rsuSaleSchema.index({ grantId: 1, saleDate: -1 });
rsuSaleSchema.index({ userId: 1, grantId: 1 });

// Virtual fields
rsuSaleSchema.virtual('effectiveTaxRate').get(function() {
  return this.totalSaleValue > 0 ? (this.taxCalculation.totalTax / this.totalSaleValue) * 100 : 0;
});

rsuSaleSchema.virtual('profitMargin').get(function() {
  return this.totalSaleValue > 0 ? (this.taxCalculation.profit / this.totalSaleValue) * 100 : 0;
});

// Pre-save middleware to calculate derived fields
rsuSaleSchema.pre('save', function(next) {
  // Calculate total sale value
  if (this.sharesAmount && this.pricePerShare) {
    this.totalSaleValue = this.sharesAmount * this.pricePerShare;
  }
  
  next();
});

// Instance methods
rsuSaleSchema.methods.recalculateTaxes = function(grant, taxRates = { wageIncome: 0.65, capitalGainsLongTerm: 0.25, capitalGainsShortTerm: 0.65 }) {
  const grantValuePerShare = grant.totalValue / grant.totalShares;
  const originalValue = this.sharesAmount * grantValuePerShare;
  const profit = this.totalSaleValue - originalValue;
  
  // Determine if long-term holding (> 2 years)
  const holdingPeriodMs = this.saleDate - grant.grantDate;
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  const isLongTerm = holdingPeriodMs >= twoYearsMs;
  
  // Calculate taxes
  const wageIncomeTax = originalValue * taxRates.wageIncome;
  const capitalGainsTaxRate = isLongTerm ? taxRates.capitalGainsLongTerm : taxRates.capitalGainsShortTerm;
  const capitalGainsTax = Math.max(0, profit) * capitalGainsTaxRate; // Only positive profits are taxed
  const totalTax = wageIncomeTax + capitalGainsTax;
  const netValue = this.totalSaleValue - totalTax;
  
  this.taxCalculation = {
    originalValue,
    profit,
    isLongTerm,
    wageIncomeTax,
    capitalGainsTax,
    totalTax,
    netValue,
    taxBasis: {
      grantValue: originalValue,
      saleValue: this.totalSaleValue,
      profitAmount: profit,
      taxRateApplied: totalTax / this.totalSaleValue
    }
  };
  
  return this.taxCalculation;
};

// Static methods
rsuSaleSchema.statics.getUserSales = function(userId, filters = {}) {
  const query = { userId };
  
  if (filters.grantId) {
    query.grantId = filters.grantId;
  }
  
  if (filters.startDate && filters.endDate) {
    query.saleDate = {
      $gte: filters.startDate,
      $lte: filters.endDate
    };
  }
  
  return this.find(query)
    .populate('grantId', 'stockSymbol company grantDate totalValue totalShares')
    .sort({ saleDate: -1 });
};

rsuSaleSchema.statics.getSalesByGrant = function(grantId) {
  return this.find({ grantId })
    .sort({ saleDate: -1 });
};

rsuSaleSchema.statics.getAnnualTaxSummary = function(userId, year) {
  const startDate = new Date(year, 0, 1); // January 1st
  const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31st
  
  return this.aggregate([
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(userId),
        saleDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'rsugrants',
        localField: 'grantId',
        foreignField: '_id',
        as: 'grant'
      }
    },
    { $unwind: '$grant' },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalSharesSold: { $sum: '$sharesAmount' },
        totalSaleValue: { $sum: '$totalSaleValue' },
        totalOriginalValue: { $sum: '$taxCalculation.originalValue' },
        totalProfit: { $sum: '$taxCalculation.profit' },
        totalWageIncomeTax: { $sum: '$taxCalculation.wageIncomeTax' },
        totalCapitalGainsTax: { $sum: '$taxCalculation.capitalGainsTax' },
        totalTax: { $sum: '$taxCalculation.totalTax' },
        totalNetValue: { $sum: '$taxCalculation.netValue' },
        longTermSales: {
          $sum: {
            $cond: ['$taxCalculation.isLongTerm', 1, 0]
          }
        },
        shortTermSales: {
          $sum: {
            $cond: ['$taxCalculation.isLongTerm', 0, 1]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        year: { $literal: year },
        totalSales: 1,
        totalSharesSold: 1,
        totalSaleValue: 1,
        totalOriginalValue: 1,
        totalProfit: 1,
        totalWageIncomeTax: 1,
        totalCapitalGainsTax: 1,
        totalTax: 1,
        totalNetValue: 1,
        longTermSales: 1,
        shortTermSales: 1,
        effectiveTaxRate: {
          $cond: {
            if: { $gt: ['$totalSaleValue', 0] },
            then: { $multiply: [{ $divide: ['$totalTax', '$totalSaleValue'] }, 100] },
            else: 0
          }
        },
        profitMargin: {
          $cond: {
            if: { $gt: ['$totalSaleValue', 0] },
            then: { $multiply: [{ $divide: ['$totalProfit', '$totalSaleValue'] }, 100] },
            else: 0
          }
        }
      }
    }
  ]);
};

rsuSaleSchema.statics.getTaxProjections = function(userId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        saleDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $month: '$saleDate' },
        monthlyTax: { $sum: '$taxCalculation.totalTax' },
        monthlyProfit: { $sum: '$taxCalculation.profit' },
        monthlySales: { $sum: '$totalSaleValue' }
      }
    },
    {
      $project: {
        _id: 0,
        month: '$_id',
        monthlyTax: 1,
        monthlyProfit: 1,
        monthlySales: 1
      }
    },
    { $sort: { month: 1 } }
  ]);
};

rsuSaleSchema.statics.validateSaleAgainstGrant = async function(grantId, sharesAmount, saleDate) {
  const RSUGrant = mongoose.model('RSUGrant');
  const grant = await RSUGrant.findById(grantId);
  
  if (!grant) {
    throw new Error('Grant not found');
  }
  
  // Check if grant date is before sale date
  if (grant.grantDate > saleDate) {
    throw new Error('Sale date cannot be before grant date');
  }
  
  // Calculate available shares at sale date
  const availableShares = grant.vestingSchedule
    .filter(v => v.vested || v.vestDate <= saleDate)
    .reduce((total, v) => total + v.shares, 0);
  
  // Check existing sales
  const existingSales = await this.find({ grantId });
  const soldShares = existingSales.reduce((total, sale) => total + sale.sharesAmount, 0);
  
  const remainingShares = availableShares - soldShares;
  
  if (sharesAmount > remainingShares) {
    throw new Error(`Insufficient shares available. Available: ${remainingShares}, Requested: ${sharesAmount}`);
  }
  
  return {
    availableShares,
    soldShares,
    remainingShares,
    grant
  };
};

const RSUSale = mongoose.model('RSUSale', rsuSaleSchema);

module.exports = RSUSale;
