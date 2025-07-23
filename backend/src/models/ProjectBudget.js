const mongoose = require('mongoose');

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
  description: {
    type: String,
    trim: true,
    maxlength: 500
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
    actualAmount: {
      type: Number,
      default: 0
    }
  }],
  
  // Totals (computed from categoryBudgets and transactions)
  totalBudget: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  
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

// Virtual for total funding available
projectBudgetSchema.virtual('totalFunding').get(function() {
  return this.fundingSources.reduce((sum, source) => sum + source.expectedAmount, 0);
});

// Virtual for total funding currently available
projectBudgetSchema.virtual('totalAvailableFunding').get(function() {
  return this.fundingSources.reduce((sum, source) => sum + source.availableAmount, 0);
});

// Virtual for project progress percentage
projectBudgetSchema.virtual('progressPercentage').get(function() {
  if (this.totalBudget === 0) return 0;
  return Math.min((this.totalSpent / this.totalBudget) * 100, 100);
});

// Virtual for remaining budget
projectBudgetSchema.virtual('remainingBudget').get(function() {
  return Math.max(this.totalBudget - this.totalSpent, 0);
});

// Virtual for budget variance
projectBudgetSchema.virtual('budgetVariance').get(function() {
  return this.totalSpent - this.totalBudget;
});

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

// Pre-save middleware to update totals
projectBudgetSchema.pre('save', function(next) {
  // Calculate total budget from category budgets
  this.totalBudget = this.categoryBudgets.reduce((sum, budget) => sum + budget.budgetedAmount, 0);
  
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
  const { Tag } = require('./');
  
  const tagName = `project:${this.name.toLowerCase().replace(/\s+/g, '-')}`;
  
  const tag = await Tag.findOrCreate({
    name: tagName,
    userId: this.userId,
    type: 'project',
    projectMetadata: {
      description: this.description,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status
    }
  });
  
  this.projectTag = tag._id;
  await this.save();
  
  return tag;
};

// Method to update actual amounts from tagged transactions
projectBudgetSchema.methods.updateActualAmounts = async function() {
  if (!this.projectTag) return this;
  
  const { Transaction } = require('./');
  
  // Reset actual amounts
  this.categoryBudgets.forEach(budget => {
    budget.actualAmount = 0;
  });
  
  // Get all transactions tagged with this project
  const transactions = await Transaction.find({
    userId: this.userId,
    tags: this.projectTag,
    processedDate: { $gte: this.startDate, $lte: this.endDate }
  });
  
  // Calculate actual amounts by category/subcategory
  for (const transaction of transactions) {
    const budget = this.categoryBudgets.find(b => 
      b.categoryId.toString() === transaction.category.toString() &&
      b.subCategoryId.toString() === transaction.subCategory.toString()
    );
    
    if (budget) {
      budget.actualAmount += Math.abs(transaction.amount);
    }
  }
  
  // Update total spent
  this.totalSpent = this.categoryBudgets.reduce((sum, budget) => sum + budget.actualAmount, 0);
  
  await this.save();
  return this;
};

// Method to add funding source
projectBudgetSchema.methods.addFundingSource = function(sourceData) {
  this.fundingSources.push({
    type: sourceData.type,
    description: sourceData.description,
    expectedAmount: sourceData.expectedAmount,
    availableAmount: sourceData.availableAmount || 0,
    limit: sourceData.limit || null
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
      actualAmount: 0
    });
  }
  
  return this;
};

// Method to get project overview
projectBudgetSchema.methods.getProjectOverview = function() {
  const categoryBreakdown = this.categoryBudgets.map(budget => {
    const variance = budget.actualAmount - budget.budgetedAmount;
    const variancePercentage = budget.budgetedAmount > 0 
      ? (variance / budget.budgetedAmount) * 100 
      : 0;
    
    return {
      categoryId: budget.categoryId,
      subCategoryId: budget.subCategoryId,
      budgeted: budget.budgetedAmount,
      actual: budget.actualAmount,
      variance,
      variancePercentage,
      status: variance > 0 ? 'over' : variance < 0 ? 'under' : 'exact'
    };
  });
  
  return {
    name: this.name,
    status: this.status,
    progress: this.progressPercentage,
    totalBudget: this.totalBudget,
    totalSpent: this.totalSpent,
    remainingBudget: this.remainingBudget,
    totalFunding: this.totalFunding,
    daysRemaining: this.daysRemaining,
    categoryBreakdown,
    fundingSources: this.fundingSources
  };
};

// Method to mark project as completed
projectBudgetSchema.methods.markCompleted = async function() {
  this.status = 'completed';
  await this.updateActualAmounts(); // Final update
  await this.save();
  
  // Update project tag metadata
  if (this.projectTag) {
    const { Tag } = require('./');
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
