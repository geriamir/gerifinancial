const mongoose = require('mongoose');
const currencyExchangeService = require('../../foreign-currency/services/currencyExchangeService');
const { TransactionType } = require('../../banking/constants/enums');
const Tag = require('../../banking/models/Tag');
const Transaction = require('../../banking/models/Transaction');

const projectBudgetSchema = new mongoose.Schema({
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
    enum: ['vacation', 'home_renovation', 'investment'],
    required: true
  },
  
  // Timeline
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  status: {
    type: String,
    enum: ['planning', 'active', 'completed', 'cancelled'],
    default: 'planning'
  },
  
  // Funding sources
  fundingSources: [{
    type: {
      type: String,
      enum: ['ongoing_funds', 'loan', 'bonus', 'savings', 'other'],
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
    limit: {
      type: Number,
      default: null,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: 'ILS'
    }
  }],
  
  // Budget breakdown by category/subcategory
  categoryBudgets: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    subCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubCategory',
      required: true
    },
    budgetedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Track transactions explicitly allocated to this planned budget item
    allocatedTransactions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }],
    currency: {
      type: String,
      required: true,
      default: 'ILS'
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200
    }
  }],
  
  
  // Settings
  impactsOtherBudgets: {
    type: Boolean,
    default: false // True if funded by ongoing_funds
  },
  
  // Auto-generated tag for this project (used to tag transactions)
  projectTag: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
    default: null
  },
  
  // Currency
  currency: {
    type: String,
    required: true,
    default: 'ILS'
  },
  
  // Additional metadata
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Ensure unique project names per user
projectBudgetSchema.index({ userId: 1, name: 1 }, { unique: true });

// Index for status-based queries
projectBudgetSchema.index({ userId: 1, status: 1 });

// Index for date-based queries
projectBudgetSchema.index({ startDate: 1, endDate: 1 });



// Virtual for days remaining
projectBudgetSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const timeDiff = this.endDate.getTime() - now.getTime();
  return Math.max(Math.ceil(timeDiff / (1000 * 3600 * 24)), 0);
});

// Virtual for project duration in days
projectBudgetSchema.virtual('durationDays').get(function() {
  const timeDiff = this.endDate.getTime() - this.startDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
});

// Ensure virtuals are included in JSON output
projectBudgetSchema.set('toJSON', { virtuals: true });
projectBudgetSchema.set('toObject', { virtuals: true });

// Pre-save middleware
projectBudgetSchema.pre('save', function(next) {
  // Update impactsOtherBudgets based on funding sources
  this.impactsOtherBudgets = this.fundingSources.some(source => source.type === 'ongoing_funds');
  
  next();
});

// Static method to find projects by status
projectBudgetSchema.statics.findByStatus = async function(userId, status) {
  return this.find({ userId, status })
    .populate('projectTag', 'name')
    .populate('categoryBudgets.categoryId', 'name')
    .populate('categoryBudgets.subCategoryId', 'name')
    .sort({ startDate: -1 });
};

// Static method to find active projects
projectBudgetSchema.statics.findActive = async function(userId) {
  const now = new Date();
  return this.find({
    userId,
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  })
  .populate('projectTag', 'name')
  .sort({ endDate: 1 });
};

// Static method to find upcoming projects
projectBudgetSchema.statics.findUpcoming = async function(userId, daysAhead = 30) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
  
  return this.find({
    userId,
    status: { $in: ['planning', 'active'] },
    startDate: { $gte: now, $lte: futureDate }
  })
  .populate('projectTag', 'name')
  .sort({ startDate: 1 });
};

// Method to create project tag
projectBudgetSchema.methods.createProjectTag = async function() {
  const tagName = `project:${this.name.toLowerCase().replace(/\s+/g, '-')}`;
  
  const tag = await Tag.findOrCreate({
    name: tagName,
    userId: this.userId,
    type: 'project',
    projectMetadata: {
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status
    }
  });
  
  this.projectTag = tag._id;
  await this.save();
  
  return tag;
};

// DEPRECATED: Actual amounts are now calculated dynamically from allocatedTransactions
// This method is kept for backward compatibility but no longer updates stored amounts
projectBudgetSchema.methods.updateActualAmounts = async function() {
  console.warn('updateActualAmounts is deprecated. Actual amounts are now calculated dynamically from allocatedTransactions.');
  return this;
};

// Method to add funding source
projectBudgetSchema.methods.addFundingSource = function(sourceData) {
  this.fundingSources.push({
    type: sourceData.type,
    description: sourceData.description,
    expectedAmount: sourceData.expectedAmount,
    availableAmount: sourceData.availableAmount || 0,
    limit: sourceData.limit || null,
    currency: sourceData.currency || this.currency || 'ILS'
  });
  
  return this;
};

// Method to add category budget
projectBudgetSchema.methods.addCategoryBudget = function(categoryId, subCategoryId, amount) {
  // Check if budget already exists for this category/subcategory
  const existingIndex = this.categoryBudgets.findIndex(
    budget => budget.categoryId.toString() === categoryId.toString() && 
              budget.subCategoryId.toString() === subCategoryId.toString()
  );
  
  if (existingIndex !== -1) {
    // Update existing budget
    this.categoryBudgets[existingIndex].budgetedAmount = amount;
  } else {
    // Add new budget
    this.categoryBudgets.push({
      categoryId,
      subCategoryId,
      budgetedAmount: amount,
      allocatedTransactions: []
    });
  }
  
  return this;
};





// Method to remove transaction from project (untag)
projectBudgetSchema.methods.removeUnplannedExpense = async function(transactionId) {
  const transaction = await Transaction.findOne({
    _id: transactionId,
    userId: this.userId,
    tags: this.projectTag
  });
  
  if (!transaction) {
    throw new Error('Transaction not found or not associated with this project');
  }
  
  // Remove project tag from transaction
  await transaction.removeTags([this.projectTag]);
  
  // If transaction was allocated to a planned category, remove it from allocatedTransactions
  const plannedBudget = this.categoryBudgets.find(budget =>
    budget.categoryId.toString() === transaction.category.toString() &&
    budget.subCategoryId.toString() === transaction.subCategory.toString()
  );
  
  if (plannedBudget && plannedBudget.allocatedTransactions.includes(transactionId)) {
    plannedBudget.allocatedTransactions = plannedBudget.allocatedTransactions.filter(
      id => id.toString() !== transactionId.toString()
    );
    await this.save();
  }
  
  return transaction;
};

// Method to mark project as completed
projectBudgetSchema.methods.markCompleted = async function() {
  this.status = 'completed';
  await this.save();
  
  // Update project tag metadata
  if (this.projectTag) {
    await Tag.updateOne(
      { _id: this.projectTag },
      { 
        'projectMetadata.status': 'completed',
        'projectMetadata.endDate': new Date()
      }
    );
  }
  
  return this;
};

const ProjectBudget = mongoose.model('ProjectBudget', projectBudgetSchema);

module.exports = ProjectBudget;
