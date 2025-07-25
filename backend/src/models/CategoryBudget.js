const mongoose = require('mongoose');

const categoryBudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // For income categories
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  
  // For expense subcategories (null for income categories)
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    default: null
  },
  
  // Budget type: 'fixed' or 'variable'
  budgetType: {
    type: String,
    enum: ['fixed', 'variable'],
    required: true,
    default: 'fixed'
  },
  
  // For fixed budgets - single amount that repeats every month
  fixedAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // For variable budgets - amounts per month (1-12, applies to all years)
  monthlyAmounts: [{
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Default currency
  currency: {
    type: String,
    default: 'ILS'
  },
  
  // Budget status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Notes for this budget
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Manual editing tracking
  isManuallyEdited: {
    type: Boolean,
    default: false
  },
  
  lastEditedAt: {
    type: Date,
    default: null
  },
  
  editHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    previousAmount: {
      type: Number,
      min: 0
    },
    newAmount: {
      type: Number,
      min: 0
    },
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: null // null for fixed budget edits
    },
    reason: {
      type: String,
      maxlength: 200
    },
    editType: {
      type: String,
      enum: ['manual', 'recalculation', 'bulk_edit'],
      default: 'manual'
    }
  }]
}, {
  timestamps: true
});

// Ensure unique budget per user, category, and subcategory
categoryBudgetSchema.index({ 
  userId: 1, 
  categoryId: 1, 
  subCategoryId: 1 
}, { unique: true });

// Index for efficient queries
categoryBudgetSchema.index({ userId: 1, isActive: 1 });

// Method to get budget amount for a specific month (any year)
categoryBudgetSchema.methods.getAmountForMonth = function(month) {
  if (this.budgetType === 'fixed') {
    return this.fixedAmount;
  }
  
  // For variable budgets, find the specific month
  const monthlyAmount = this.monthlyAmounts.find(
    ma => ma.month === month
  );
  
  return monthlyAmount ? monthlyAmount.amount : 0;
};

// Method to set amount for a specific month
categoryBudgetSchema.methods.setAmountForMonth = function(month, amount) {
  if (this.budgetType === 'fixed') {
    this.fixedAmount = amount;
  } else {
    // For variable budgets, find or create the monthly amount
    const existingIndex = this.monthlyAmounts.findIndex(
      ma => ma.month === month
    );
    
    if (existingIndex !== -1) {
      this.monthlyAmounts[existingIndex].amount = amount;
    } else {
      this.monthlyAmounts.push({ month, amount });
    }
    
    // Sort monthly amounts by month
    this.monthlyAmounts.sort((a, b) => a.month - b.month);
  }
  
  return this;
};

// Method to convert from fixed to variable budget
categoryBudgetSchema.methods.convertToVariable = function() {
  if (this.budgetType === 'fixed') {
    this.budgetType = 'variable';
    // Start with empty monthly amounts, user can set them individually
    this.monthlyAmounts = [];
  }
  return this;
};

// Method to convert from variable to fixed budget
categoryBudgetSchema.methods.convertToFixed = function(amount = null) {
  // Check if converting from variable to fixed
  if (this.budgetType === 'variable') {
    this.budgetType = 'fixed';
    
    // If amount not provided, use average of existing monthly amounts
    if (amount === null && this.monthlyAmounts.length > 0) {
      const total = this.monthlyAmounts.reduce((sum, ma) => sum + ma.amount, 0);
      this.fixedAmount = Math.round(total / this.monthlyAmounts.length);
    } else {
      this.fixedAmount = amount || 0;
    }
    
    this.monthlyAmounts = [];
  } else {
    // Already fixed budget - just update the amount if provided
    if (amount !== null) {
      this.fixedAmount = amount;
    }
  }
  return this;
};

// Method to populate all 12 months with the same amount (useful for converting from fixed)
categoryBudgetSchema.methods.populateAllMonths = function(amount) {
  if (this.budgetType === 'variable') {
    this.monthlyAmounts = [];
    for (let month = 1; month <= 12; month++) {
      this.monthlyAmounts.push({ month, amount });
    }
  }
  return this;
};

// Method to update budget with manual edit tracking
categoryBudgetSchema.methods.updateWithEditTracking = function(newAmount, month = null, reason = '') {
  const previousAmount = month ? this.getAmountForMonth(month) : 
    (this.budgetType === 'fixed' ? this.fixedAmount : 0);
  
  // Update the amount
  if (month) {
    this.setAmountForMonth(month, newAmount);
  } else {
    // Fixed budget update
    this.fixedAmount = newAmount;
  }
  
  // Mark as manually edited
  this.isManuallyEdited = true;
  this.lastEditedAt = new Date();
  
  // Add to edit history
  this.editHistory.push({
    date: new Date(),
    previousAmount,
    newAmount,
    month,
    reason,
    editType: 'manual'
  });
  
  return this;
};

// Method to update multiple months at once (for variable budgets)
categoryBudgetSchema.methods.updateMultipleMonths = function(monthlyUpdates, reason = '') {
  if (this.budgetType !== 'variable') {
    throw new Error('Cannot update multiple months on fixed budget');
  }
  
  const editEntries = [];
  
  monthlyUpdates.forEach(({ month, amount }) => {
    const previousAmount = this.getAmountForMonth(month);
    this.setAmountForMonth(month, amount);
    
    editEntries.push({
      date: new Date(),
      previousAmount,
      newAmount: amount,
      month,
      reason,
      editType: 'manual'
    });
  });
  
  // Mark as manually edited
  this.isManuallyEdited = true;
  this.lastEditedAt = new Date();
  
  // Add all edits to history
  this.editHistory.push(...editEntries);
  
  return this;
};

// Method to check if budget amounts are the same across all months (for smart UI detection)
categoryBudgetSchema.methods.isUniformAcrossMonths = function() {
  if (this.budgetType === 'fixed') {
    return true;
  }
  
  if (this.monthlyAmounts.length === 0) {
    return true;
  }
  
  // Check if all 12 months are defined and have the same amount
  if (this.monthlyAmounts.length !== 12) {
    return false;
  }
  
  const firstAmount = this.monthlyAmounts[0].amount;
  return this.monthlyAmounts.every(ma => ma.amount === firstAmount);
};

// Method to get all 12 months with amounts (useful for variable budget editing)
categoryBudgetSchema.methods.getAllMonthsData = function() {
  const monthsData = [];
  
  for (let month = 1; month <= 12; month++) {
    monthsData.push({
      month,
      amount: this.getAmountForMonth(month)
    });
  }
  
  return monthsData;
};

// Static method to find or create category budget
categoryBudgetSchema.statics.findOrCreate = async function(userId, categoryId, subCategoryId = null) {
  let budget = await this.findOne({ 
    userId, 
    categoryId, 
    subCategoryId: subCategoryId || null 
  });
  
  if (!budget) {
    budget = new this({
      userId,
      categoryId,
      subCategoryId: subCategoryId || null,
      budgetType: 'fixed',
      fixedAmount: 0
    });
    await budget.save();
  }
  
  return budget;
};

// Static method to get all budgets for a user
categoryBudgetSchema.statics.getUserBudgets = async function(userId, filters = {}) {
  const query = { userId, isActive: true, ...filters };
  
  return this.find(query)
    .populate('categoryId', 'name type')
    .populate('subCategoryId', 'name')
    .sort({ 'categoryId.type': 1, 'categoryId.name': 1, 'subCategoryId.name': 1 });
};

// Static method to get budgets for a specific month
categoryBudgetSchema.statics.getBudgetsForMonth = async function(userId, month) {
  const budgets = await this.getUserBudgets(userId);
  
  return budgets.map(budget => ({
    ...budget.toObject(),
    amountForMonth: budget.getAmountForMonth(month)
  }));
};

// Static method to get income budgets
categoryBudgetSchema.statics.getIncomeBudgets = async function(userId, month = null) {
  const budgets = await this.find({ 
    userId, 
    isActive: true,
    subCategoryId: null // Income categories don't have subcategories
  })
  .populate('categoryId', 'name type')
  .populate('subCategoryId', 'name');
  
  // Filter for income categories
  const incomeBudgets = budgets.filter(budget => 
    budget.categoryId && budget.categoryId.type === 'Income'
  );
  
  if (month) {
    return incomeBudgets.map(budget => ({
      ...budget.toObject(),
      amountForMonth: budget.getAmountForMonth(month)
    }));
  }
  
  return incomeBudgets;
};

// Static method to get expense budgets (subcategory level)
categoryBudgetSchema.statics.getExpenseBudgets = async function(userId, month = null) {
  const budgets = await this.find({ 
    userId, 
    isActive: true,
    subCategoryId: { $ne: null } // Expense budgets have subcategories
  })
  .populate('categoryId', 'name type')
  .populate('subCategoryId', 'name');
  
  // Filter for expense categories
  const expenseBudgets = budgets.filter(budget => 
    budget.categoryId && budget.categoryId.type === 'Expense'
  );
  
  if (month) {
    return expenseBudgets.map(budget => ({
      ...budget.toObject(),
      amountForMonth: budget.getAmountForMonth(month)
    }));
  }
  
  return expenseBudgets;
};

// Virtual to check if this is an income or expense budget
categoryBudgetSchema.virtual('budgetCategory').get(function() {
  if (this.subCategoryId) {
    return 'expense';
  }
  return 'income';
});

// Ensure virtuals are included in JSON output
categoryBudgetSchema.set('toJSON', { virtuals: true });
categoryBudgetSchema.set('toObject', { virtuals: true });

const CategoryBudget = mongoose.model('CategoryBudget', categoryBudgetSchema);

module.exports = CategoryBudget;
