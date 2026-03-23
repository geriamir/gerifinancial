const mongoose = require('mongoose');
const Tag = require('../../banking/models/Tag');

const commitmentSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  paidDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
});

const rentalIncomeSchema = new mongoose.Schema({
  month: {
    type: Date,
    required: true
  },
  expectedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  actualAmount: {
    type: Number,
    default: null
  },
  received: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 200
  }
});

const realEstateInvestmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['flip', 'rental'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'sold', 'cancelled'],
    default: 'active'
  },

  // Property details
  address: {
    type: String,
    trim: true,
    maxlength: 300
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  // Financial
  totalInvestment: {
    type: Number,
    default: 0,
    min: 0
  },
  estimatedCurrentValue: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },

  // Funding sources (same pattern as Projects)
  fundingSources: [{
    type: {
      type: String,
      enum: ['loan', 'savings', 'partner', 'mortgage', 'other'],
      required: true
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    expectedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    availableAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  }],

  // Budget breakdown by category
  categoryBudgets: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubCategory'
    },
    budgetedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    allocatedTransactions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }],
    currency: {
      type: String,
      default: 'USD'
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200
    }
  }],

  // Commitments (future installments)
  commitments: [commitmentSchema],

  // Flip-specific fields
  salePrice: {
    type: Number,
    default: null,
    min: 0
  },
  saleDate: {
    type: Date,
    default: null
  },
  saleExpenses: {
    type: Number,
    default: 0,
    min: 0
  },

  // Rental-specific fields
  monthlyRent: {
    type: Number,
    default: null,
    min: 0
  },
  tenantName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  leaseStart: {
    type: Date,
    default: null
  },
  leaseEnd: {
    type: Date,
    default: null
  },
  rentalIncome: [rentalIncomeSchema],

  // Linked bank account (auto-tag its transactions)
  linkedBankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    default: null
  },

  // Auto-generated tag for transaction linking
  investmentTag: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
    default: null
  },

  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  }
}, {
  timestamps: true
});

// Indexes
realEstateInvestmentSchema.index({ userId: 1, name: 1 }, { unique: true });
realEstateInvestmentSchema.index({ userId: 1, status: 1 });
realEstateInvestmentSchema.index({ userId: 1, type: 1 });

// Virtuals
realEstateInvestmentSchema.virtual('totalCommitted').get(function() {
  return this.commitments
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);
});

realEstateInvestmentSchema.virtual('totalPaidCommitments').get(function() {
  return this.commitments
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0);
});

realEstateInvestmentSchema.virtual('flipGain').get(function() {
  if (this.type !== 'flip' || !this.salePrice) return null;
  return this.salePrice - this.saleExpenses - this.totalInvestment;
});

realEstateInvestmentSchema.virtual('totalRentalIncome').get(function() {
  return this.rentalIncome
    .filter(r => r.received)
    .reduce((sum, r) => sum + (r.actualAmount ?? r.expectedAmount), 0);
});

realEstateInvestmentSchema.set('toJSON', { virtuals: true });
realEstateInvestmentSchema.set('toObject', { virtuals: true });

// Static methods
realEstateInvestmentSchema.statics.findByUser = async function(userId, options = {}) {
  const query = { userId };
  if (options.type) query.type = options.type;
  if (options.status) query.status = options.status;

  return this.find(query)
    .populate('investmentTag', 'name')
    .populate('linkedBankAccountId', 'name bankId')
    .sort({ createdAt: -1 });
};

realEstateInvestmentSchema.statics.findActive = async function(userId) {
  return this.find({ userId, status: 'active' })
    .populate('investmentTag', 'name')
    .populate('linkedBankAccountId', 'name bankId')
    .sort({ createdAt: -1 });
};

// Create investment tag
realEstateInvestmentSchema.methods.createInvestmentTag = async function() {
  const tagName = `realestate:${this.name.toLowerCase().replace(/\s+/g, '-')}`;

  const tag = await Tag.findOrCreate({
    name: tagName,
    userId: this.userId,
    type: 'real-estate',
    projectMetadata: {
      description: this.address,
      status: this.status
    }
  });

  this.investmentTag = tag._id;
  await this.save();

  return tag;
};

// Mark as sold (flip)
realEstateInvestmentSchema.methods.markSold = async function(salePrice, saleDate, saleExpenses = 0) {
  this.salePrice = salePrice;
  this.saleDate = saleDate || new Date();
  this.saleExpenses = saleExpenses;
  this.status = 'sold';
  await this.save();

  if (this.investmentTag) {
    await Tag.updateOne(
      { _id: this.investmentTag },
      { 'projectMetadata.status': 'sold' }
    );
  }

  return this;
};

// Update overdue commitments
realEstateInvestmentSchema.methods.updateOverdueCommitments = function() {
  const now = new Date();
  let changed = false;
  for (const c of this.commitments) {
    if (c.status === 'pending' && c.dueDate < now) {
      c.status = 'overdue';
      changed = true;
    }
  }
  return changed;
};

const RealEstateInvestment = mongoose.model('RealEstateInvestment', realEstateInvestmentSchema);

module.exports = RealEstateInvestment;
