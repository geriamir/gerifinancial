const mongoose = require('mongoose');
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
  // What the project is, in the user's own words - the sentence they typed to
  // draft it. Kept because it is the only thing that separates two projects
  // sharing a category: "renovating the kitchen" and "redoing the bathroom"
  // both spend from Household > Maintenance and Repairs, and the description is
  // what lets the matcher tell their transactions apart.
  //
  // createProjectBudget and the update whitelist have always passed this field;
  // without it declared here mongoose dropped it in silence, so every
  // description written since the project feature shipped was discarded.
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
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
  },

  // Transactions the matcher has offered for this project, and what became of
  // each one.
  //
  // Recorded rather than recomputed on every visit for two reasons. A rejection
  // has to stick: a transaction the user has already said does not belong here
  // must not be offered again on the next scrape, or the list becomes noise
  // they learn to ignore. And the model is asked about a transaction once -
  // whatever it answered is kept, so opening the project a second time costs
  // nothing.
  transactionSuggestions: [{
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    // How sure the model was that this belongs to the project, 0-1. Absent when
    // the shortlist was built without the model.
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    // The model's one-line justification, shown to the user so they can judge
    // the suggestion instead of taking it on trust.
    reason: {
      type: String,
      trim: true,
      maxlength: 300
    },
    suggestedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Ensure unique project names per user
projectBudgetSchema.index({ userId: 1, name: 1 }, { unique: true });

// Index for status-based queries
projectBudgetSchema.index({ userId: 1, status: 1 });

// Index for date-based queries
projectBudgetSchema.index({ startDate: 1, endDate: 1 });

// The matcher asks "has this transaction already been offered here?" once per
// candidate, so the lookup has to be cheap.
projectBudgetSchema.index({ 'transactionSuggestions.transaction': 1 });



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

// Pre-validate middleware — runs before schema validation so defaults are set in time
projectBudgetSchema.pre('validate', function(next) {
  // Default funding source description to type label if not provided
  const FUNDING_TYPE_LABELS = {
    ongoing_funds: 'Ongoing Funds',
    loan: 'Loan',
    bonus: 'Bonus',
    savings: 'Savings',
    other: 'Other'
  };
  this.fundingSources.forEach(source => {
    if (!source.description) {
      source.description = FUNDING_TYPE_LABELS[source.type] || source.type;
    }
  });

  next();
});

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
    description: sourceData.description || '',
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
