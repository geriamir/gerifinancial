const mongoose = require('mongoose');
const { ALL_PATTERN_TYPES } = require('../../shared/constants/patternTypes');
const { ALL_APPROVAL_STATUSES, APPROVAL_STATUS } = require('../../shared/constants/statusTypes');

const transactionPatternSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Pattern identification
  patternId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Transaction identification criteria
  transactionIdentifier: {
    description: {
      type: String,
      required: true,
      trim: true
    },
    amountRange: {
      min: {
        type: Number,
        required: true
      },
      max: {
        type: Number,
        required: true
      }
    },
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: false,
        default: null
      },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubCategory',
      default: null
    }
  },
  
  // Pattern details
  recurrencePattern: {
    type: String,
    enum: ALL_PATTERN_TYPES,
    required: true
  },
  
  // Which months this pattern occurs (1-12)
  scheduledMonths: [{
    type: Number,
    min: 1,
    max: 12,
    required: true
  }],
  
  // Average amount for this pattern
  averageAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Pattern detection metadata
  detectionData: {
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    lastDetected: {
      type: Date,
      required: true,
      default: Date.now
    },
    analysisMonths: {
      type: Number,
      required: true,
      min: 6
    },
    sampleTransactions: [{
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
      },
      description: String,
      amount: Number,
      date: Date
    }]
  },
  
  // User approval status
  approvalStatus: {
    type: String,
    enum: ALL_APPROVAL_STATUSES,
    default: APPROVAL_STATUS.PENDING
  },
  
  // When user made approval decision
  approvedAt: {
    type: Date,
    default: null
  },
  
  // Whether this pattern is currently active for budget calculations
  isActive: {
    type: Boolean,
    default: false
  },
  
  // Notes from user
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
transactionPatternSchema.index({ userId: 1, approvalStatus: 1 });
transactionPatternSchema.index({ userId: 1, isActive: 1 });
transactionPatternSchema.index({ userId: 1, recurrencePattern: 1 });

// Method to check if pattern is active for a specific month
transactionPatternSchema.methods.isActiveForMonth = function(month) {
  if (!this.isActive || this.approvalStatus !== APPROVAL_STATUS.APPROVED) {
    return false;
  }
  
  return this.scheduledMonths.includes(month);
};

// Method to get amount for a specific month
transactionPatternSchema.methods.getAmountForMonth = function(month) {
  return this.isActiveForMonth(month) ? this.averageAmount : 0;
};

// Method to approve pattern
transactionPatternSchema.methods.approve = function() {
  this.approvalStatus = APPROVAL_STATUS.APPROVED;
  this.isActive = true;
  this.approvedAt = new Date();
  return this;
};

// Method to reject pattern
transactionPatternSchema.methods.reject = function() {
  this.approvalStatus = APPROVAL_STATUS.REJECTED;
  this.isActive = false;
  this.approvedAt = new Date();
  return this;
};

// Method to check if transaction matches this pattern
transactionPatternSchema.methods.matchesTransaction = function(transaction) {
  // Check amount range
  const amount = Math.abs(transaction.amount);
  if (amount < this.transactionIdentifier.amountRange.min || 
      amount > this.transactionIdentifier.amountRange.max) {
    return false;
  }
  
  // Check category/subcategory
  if (transaction.category?.toString() !== this.transactionIdentifier.categoryId.toString()) {
    return false;
  }
  
  if (this.transactionIdentifier.subCategoryId && 
      transaction.subCategory?.toString() !== this.transactionIdentifier.subCategoryId.toString()) {
    return false;
  }
  
  // Check description similarity (basic contains check for now)
  const normalizedDesc = transaction.description?.toLowerCase().trim() || '';
  const patternDesc = this.transactionIdentifier.description.toLowerCase().trim();
  
  return normalizedDesc.includes(patternDesc) || patternDesc.includes(normalizedDesc);
};

// Static method to find patterns for user
transactionPatternSchema.statics.getUserPatterns = async function(userId, filters = {}) {
  const query = { userId, ...filters };
  
  return this.find(query)
    .populate('transactionIdentifier.categoryId', 'name type')
    .populate('transactionIdentifier.subCategoryId', 'name')
    .sort({ createdAt: -1 });
};

// Static method to get active patterns for user
transactionPatternSchema.statics.getActivePatterns = async function(userId) {
  return this.getUserPatterns(userId, { 
    isActive: true, 
    approvalStatus: APPROVAL_STATUS.APPROVED 
  });
};

// Static method to get pending patterns for user
transactionPatternSchema.statics.getPendingPatterns = async function(userId) {
  return this.getUserPatterns(userId, { 
    approvalStatus: APPROVAL_STATUS.PENDING 
  });
};

// Static method to get patterns affecting a specific month
transactionPatternSchema.statics.getPatternsForMonth = async function(userId, month) {
  const activePatterns = await this.getActivePatterns(userId);
  
  return activePatterns.filter(pattern => 
    pattern.scheduledMonths.includes(month)
  );
};

// Virtual to get pattern display name
transactionPatternSchema.virtual('displayName').get(function() {
  const categoryName = this.transactionIdentifier.categoryId?.name || 'Unknown';
  const subcategoryName = this.transactionIdentifier.subCategoryId?.name || '';
  const description = this.transactionIdentifier.description;
  
  return `${description} (${categoryName}${subcategoryName ? ` → ${subcategoryName}` : ''})`;
});

// Virtual to get next scheduled month
transactionPatternSchema.virtual('nextScheduledMonth').get(function() {
  const currentMonth = new Date().getMonth() + 1;
  
  // Find next month in schedule
  const nextMonth = this.scheduledMonths.find(month => month > currentMonth);
  
  // If no month found after current, return first month of next cycle
  return nextMonth || this.scheduledMonths[0];
});

// Ensure virtuals are included in JSON output
transactionPatternSchema.set('toJSON', { virtuals: true });
transactionPatternSchema.set('toObject', { virtuals: true });

const TransactionPattern = mongoose.model('TransactionPattern', transactionPatternSchema);

module.exports = TransactionPattern;
