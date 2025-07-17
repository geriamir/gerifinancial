const mongoose = require('mongoose');
const { CategorizationMethod, TransactionType, TransactionStatus } = require('../constants/enums');

const transactionSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
  },
  // The original identifier from the scraper, kept for reference
  originalIdentifier: {
    type: String,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    validate: {
      validator: function(v) {
        return typeof v === 'number' && !isNaN(v);
      },
      message: props => `${props.value} is not a valid amount!`
    }
  },
  currency: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v);
      },
      message: props => `${props.value} is not a valid date!`
    },
    index: true
  },
  // When we pulled/synced the transaction data from the bank
  syncedDate: {
    type: Date,
    default: null,
  },
  // When the money actually moved (effective date for budget allocation)
  processedDate: {
    type: Date,
    required: false,
    default: function() {
      return this.date || new Date();
    },
    validate: {
      validator: function(v) {
        return !v || (v instanceof Date && !isNaN(v));
      },
      message: props => `${props.value} is not a valid processed date!`
    },
    index: true
  },
  type: {
    type: String,
    enum: {
      values: Object.values(TransactionType),
      message: '{VALUE} is not a valid transaction type'
    },
    required: false, // Allow transactions without type initially
    validate: {
      validator: function(v) {
        return !v || Object.values(TransactionType).includes(v);
      },
      message: props => `${props.value} is not a valid transaction type. Must be one of: ${Object.values(TransactionType).join(', ')}`
    }
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  memo: {
    type: String,
    trim: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: false, // Optional - only required for Expense transactions
  },
  categorizationMethod: {
    type: String,
    enum: Object.values(CategorizationMethod),
    default: CategorizationMethod.MANUAL
  },
  categorizationReasoning: {
    type: String,
    trim: true,
    // Stores explanation of why this categorization was chosen
    // e.g., "Matched keyword 'grocery' in description", "AI suggestion based on description pattern"
  },
  status: {
    type: String,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.VERIFIED, // All transactions in main storage are verified
  },
  // User-defined tags for organization and project tracking
  // References to Tag model for efficient querying and analytics
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  timestamps: true,
});

// Create regular index for identifier lookups
transactionSchema.index({ identifier: 1, accountId: 1 });

// Create indexes for common queries
// Index for deduplication checks - includes all fields used in duplicate detection
transactionSchema.index({ 
  accountId: 1, 
  date: 1, 
  amount: 1, 
  description: 1 
});

// Indexes for filtering and sorting
transactionSchema.index({ accountId: 1, date: -1 });
transactionSchema.index({ category: 1, date: -1 });

// New indexes for budget functionality
transactionSchema.index({ tags: 1 }); // For project and tag-based queries
transactionSchema.index({ userId: 1, processedDate: -1 }); // For user budget calculations

// Helper method to categorize a transaction
transactionSchema.methods.categorize = async function(categoryId, subCategoryId, method = CategorizationMethod.MANUAL, reasoning = null) {
  this.category = categoryId;
  this.subCategory = subCategoryId;
  this.categorizationMethod = method;
  this.categorizationReasoning = reasoning;
  this.processedDate = new Date();
  await this.save();
};

// Helper methods for tagging functionality
transactionSchema.methods.addTags = async function(tagIds) {
  const Tag = require('./Tag');
  const newTagIds = Array.isArray(tagIds) ? tagIds : [tagIds];
  const uniqueTagIds = [...new Set([...this.tags.map(t => t.toString()), ...newTagIds.map(t => t.toString())])];
  this.tags = uniqueTagIds;
  
  // Update tag usage statistics
  await Tag.updateMany(
    { _id: { $in: newTagIds } },
    { 
      $inc: { usageCount: 1 },
      $set: { lastUsed: new Date() }
    }
  );
  
  await this.save();
  return this;
};

transactionSchema.methods.removeTags = async function(tagIds) {
  const tagsToRemove = Array.isArray(tagIds) ? tagIds : [tagIds];
  this.tags = this.tags.filter(tagId => !tagsToRemove.map(t => t.toString()).includes(tagId.toString()));
  await this.save();
  return this;
};

transactionSchema.methods.hasTag = function(tagId) {
  return this.tags.some(tag => tag.toString() === tagId.toString());
};

// Static method to find transactions by tag
transactionSchema.statics.findByTag = async function(tagId, userId) {
  if (!userId) throw new Error('userId is required');
  return this.find({
    userId,
    tags: tagId
  })
  .sort({ processedDate: -1 })
  .populate('category')
  .populate('subCategory')
  .populate('tags');
};

// Static method to get spending summary by tag
transactionSchema.statics.getSpendingSummaryByTag = async function(tagId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        tags: new mongoose.Types.ObjectId(tagId),
        processedDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          currency: '$currency'
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Static method to find transactions within a date range
transactionSchema.statics.findByDateRange = async function(accountId, startDate, endDate, userId) {
  if (!userId) throw new Error('userId is required');
  return this.find({
    accountId,
    userId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .sort({ date: -1 })
  .populate('category')
  .populate('subCategory');
};

// Static method to find uncategorized transactions
transactionSchema.statics.findUncategorized = async function(accountId, userId) {
  if (!userId) throw new Error('userId is required');
  return this.find({
    accountId,
    userId,
    category: null
  })
  .sort({ date: -1 });
};


// Static method to get spending summary by category
transactionSchema.statics.getSpendingSummary = async function(accountId, startDate, endDate) {
  const [expenses, income] = await Promise.all([
    this.aggregate([
      {
        $match: {
          accountId: new mongoose.Types.ObjectId(accountId),
          date: { $gte: startDate, $lte: endDate },
          type: TransactionType.EXPENSE
        }
      },
      {
        $group: {
          _id: {
            category: '$category',
            currency: '$currency'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id.category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      }
    ]),
    this.aggregate([
      {
        $match: {
          accountId: new mongoose.Types.ObjectId(accountId),
          date: { $gte: startDate, $lte: endDate },
          type: TransactionType.INCOME
        }
      },
      {
        $group: {
          _id: {
            category: '$category',
            currency: '$currency'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id.category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      }
    ])
  ]);

  return {
    expenses,
    income,
    totalExpenses: expenses.reduce((sum, group) => sum + group.total, 0),
    totalIncome: income.reduce((sum, group) => sum + group.total, 0)
  };
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
