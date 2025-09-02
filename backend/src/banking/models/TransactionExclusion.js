const mongoose = require('mongoose');

const transactionExclusionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true,
    index: true
  },
  
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: false // null for income categories
  },
  
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  excludedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // For audit trail - when exclusion was removed
  removedAt: {
    type: Date,
    default: null
  },
  
  // Original transaction data for reference
  transactionAmount: {
    type: Number,
    required: true
  },
  
  transactionDate: {
    type: Date,
    required: true
  },
  
  transactionDescription: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Ensure unique exclusion per transaction
transactionExclusionSchema.index({ 
  transactionId: 1 
}, { unique: true });

// Index for efficient queries
transactionExclusionSchema.index({ userId: 1, isActive: 1 });
transactionExclusionSchema.index({ categoryId: 1, subCategoryId: 1, isActive: 1 });
transactionExclusionSchema.index({ excludedAt: -1 });

// Method to deactivate exclusion (soft delete)
transactionExclusionSchema.methods.remove = async function() {
  this.isActive = false;
  this.removedAt = new Date();
  await this.save();
  return this;
};

// Static method to create exclusion record
transactionExclusionSchema.statics.createExclusion = async function(transaction, reason, userId) {
  const exclusion = new this({
    userId,
    transactionId: transaction._id,
    categoryId: transaction.category,
    subCategoryId: transaction.subCategory,
    reason,
    transactionAmount: transaction.amount,
    transactionDate: transaction.processedDate || transaction.date,
    transactionDescription: transaction.description
  });
  
  await exclusion.save();
  return exclusion;
};

// Static method to get exclusions for a category/subcategory
transactionExclusionSchema.statics.getExclusionsForCategory = async function(userId, categoryId, subCategoryId = null, startDate = null, endDate = null) {
  const query = {
    userId,
    categoryId,
    subCategoryId: subCategoryId || null,
    isActive: true
  };
  
  if (startDate && endDate) {
    query.transactionDate = { $gte: startDate, $lte: endDate };
  }
  
  return this.find(query)
    .populate('transactionId')
    .sort({ excludedAt: -1 });
};

// Static method to get user's exclusion summary
transactionExclusionSchema.statics.getUserExclusionSummary = async function(userId, startDate = null, endDate = null) {
  const matchQuery = {
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true
  };
  
  if (startDate && endDate) {
    matchQuery.transactionDate = { $gte: startDate, $lte: endDate };
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          categoryId: '$categoryId',
          subCategoryId: '$subCategoryId'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$transactionAmount' },
        latestExclusion: { $max: '$excludedAt' }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id.categoryId',
        foreignField: '_id',
        as: 'category'
      }
    },
    {
      $lookup: {
        from: 'subcategories',
        localField: '_id.subCategoryId',
        foreignField: '_id',
        as: 'subCategory'
      }
    },
    {
      $sort: { latestExclusion: -1 }
    }
  ]);
};

const TransactionExclusion = mongoose.model('TransactionExclusion', transactionExclusionSchema);

module.exports = TransactionExclusion;
