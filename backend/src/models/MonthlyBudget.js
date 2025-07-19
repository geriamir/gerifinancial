const mongoose = require('mongoose');

const monthlyBudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  year: {
    type: Number,
    required: true,
    min: 2020,
    max: 2050
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  currency: {
    type: String,
    required: true,
    default: 'ILS'
  },
  
  // Income budgets
  salaryBudget: {
    type: Number,
    default: 0,
    min: 0
  },
  otherIncomeBudgets: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Expense budgets at sub-category level
  expenseBudgets: [{
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
  
  // Metadata
  isAutoCalculated: {
    type: Boolean,
    default: false
  },
  lastCalculated: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Budget status
  status: {
    type: String,
    enum: ['draft', 'active', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Ensure unique budget per user, year, and month
monthlyBudgetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

// Index for date-based queries
monthlyBudgetSchema.index({ year: 1, month: 1 });

// Virtual for total budgeted income
monthlyBudgetSchema.virtual('totalBudgetedIncome').get(function() {
  const otherIncomeTotal = this.otherIncomeBudgets.reduce((sum, budget) => sum + budget.amount, 0);
  return this.salaryBudget + otherIncomeTotal;
});

// Virtual for total budgeted expenses
monthlyBudgetSchema.virtual('totalBudgetedExpenses').get(function() {
  return this.expenseBudgets.reduce((sum, budget) => sum + budget.budgetedAmount, 0);
});

// Virtual for total actual expenses
monthlyBudgetSchema.virtual('totalActualExpenses').get(function() {
  return this.expenseBudgets.reduce((sum, budget) => sum + budget.actualAmount, 0);
});

// Virtual for budget surplus/deficit
monthlyBudgetSchema.virtual('budgetBalance').get(function() {
  return this.totalBudgetedIncome - this.totalBudgetedExpenses;
});

// Virtual for actual surplus/deficit
monthlyBudgetSchema.virtual('actualBalance').get(function() {
  return this.totalBudgetedIncome - this.totalActualExpenses;
});

// Ensure virtuals are included in JSON output
monthlyBudgetSchema.set('toJSON', { virtuals: true });
monthlyBudgetSchema.set('toObject', { virtuals: true });

// Static method to find or create monthly budget
monthlyBudgetSchema.statics.findOrCreate = async function(userId, year, month) {
  let budget = await this.findOne({ userId, year, month });
  
  if (!budget) {
    budget = new this({
      userId,
      year,
      month,
      expenseBudgets: [],
      otherIncomeBudgets: []
    });
    await budget.save();
  }
  
  return budget;
};

// Static method to get user's budgets for a year
monthlyBudgetSchema.statics.getUserYearBudgets = async function(userId, year) {
  return this.find({ userId, year })
    .populate('expenseBudgets.categoryId', 'name')
    .populate('expenseBudgets.subCategoryId', 'name')
    .populate('otherIncomeBudgets.categoryId', 'name')
    .sort({ month: 1 });
};

// Method to update actual amounts from transactions
monthlyBudgetSchema.methods.updateActualAmounts = async function() {
  const { Transaction } = require('./');
  
  // Calculate start and end dates for the month
  const startDate = new Date(this.year, this.month - 1, 1);
  const endDate = new Date(this.year, this.month, 0, 23, 59, 59);
  
  // Update actual amounts for each expense budget
  for (const expenseBudget of this.expenseBudgets) {
    const actualAmount = await Transaction.aggregate([
      {
        $match: {
          userId: this.userId,
          processedDate: { $gte: startDate, $lte: endDate },
          category: expenseBudget.categoryId,
          subCategory: expenseBudget.subCategoryId
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $abs: '$amount' } } // Use absolute value for expenses
        }
      }
    ]);
    
    expenseBudget.actualAmount = actualAmount.length > 0 ? actualAmount[0].total : 0;
  }
  
  await this.save();
  return this;
};

// Method to add expense budget
monthlyBudgetSchema.methods.addExpenseBudget = function(categoryId, subCategoryId, amount) {
  // Check if budget already exists for this category/subcategory
  const existingIndex = this.expenseBudgets.findIndex(
    budget => budget.categoryId.toString() === categoryId.toString() && 
              budget.subCategoryId.toString() === subCategoryId.toString()
  );
  
  if (existingIndex !== -1) {
    // Update existing budget
    this.expenseBudgets[existingIndex].budgetedAmount = amount;
  } else {
    // Add new budget
    this.expenseBudgets.push({
      categoryId,
      subCategoryId,
      budgetedAmount: amount,
      actualAmount: 0
    });
  }
  
  return this;
};

// Method to add income budget
monthlyBudgetSchema.methods.addIncomeBudget = function(categoryId, amount) {
  // Check if budget already exists for this category
  const existingIndex = this.otherIncomeBudgets.findIndex(
    budget => budget.categoryId.toString() === categoryId.toString()
  );
  
  if (existingIndex !== -1) {
    // Update existing budget
    this.otherIncomeBudgets[existingIndex].amount = amount;
  } else {
    // Add new budget
    this.otherIncomeBudgets.push({
      categoryId,
      amount
    });
  }
  
  return this;
};

// Method to get budget variance analysis
monthlyBudgetSchema.methods.getVarianceAnalysis = function() {
  const expenseVariances = this.expenseBudgets.map(budget => {
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
    totalBudgeted: this.totalBudgetedExpenses,
    totalActual: this.totalActualExpenses,
    totalVariance: this.totalActualExpenses - this.totalBudgetedExpenses,
    expenseVariances
  };
};

const MonthlyBudget = mongoose.model('MonthlyBudget', monthlyBudgetSchema);

module.exports = MonthlyBudget;
