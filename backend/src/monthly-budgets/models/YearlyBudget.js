const mongoose = require('mongoose');

const yearlyBudgetSchema = new mongoose.Schema({
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
  currency: {
    type: String,
    required: true,
    default: 'ILS'
  },
  
  // Derived from monthly budgets + one-time items
  totalIncome: {
    type: Number,
    default: 0
  },
  totalExpenses: {
    type: Number,
    default: 0
  },
  
  // One-time income items
  oneTimeIncome: [{
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
    expectedDate: {
      type: Date,
      required: true
    },
    actualDate: {
      type: Date,
      default: null
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    status: {
      type: String,
      enum: ['planned', 'received', 'cancelled'],
      default: 'planned'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300
    }
  }],
  
  // One-time expense items
  oneTimeExpenses: [{
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
    expectedDate: {
      type: Date,
      required: true
    },
    actualDate: {
      type: Date,
      default: null
    },
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
    status: {
      type: String,
      enum: ['planned', 'spent', 'cancelled'],
      default: 'planned'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300
    }
  }],
  
  // Project budget references
  projectBudgets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectBudget'
  }],
  
  // Metadata
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
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

// Ensure unique budget per user and year
yearlyBudgetSchema.index({ userId: 1, year: 1 }, { unique: true });

// Virtual for total one-time income
yearlyBudgetSchema.virtual('totalOneTimeIncome').get(function() {
  return this.oneTimeIncome.reduce((sum, item) => {
    return item.status === 'received' ? sum + item.amount : sum;
  }, 0);
});

// Virtual for total planned one-time income
yearlyBudgetSchema.virtual('totalPlannedOneTimeIncome').get(function() {
  return this.oneTimeIncome.reduce((sum, item) => {
    return item.status === 'planned' ? sum + item.amount : sum;
  }, 0);
});

// Virtual for total one-time expenses
yearlyBudgetSchema.virtual('totalOneTimeExpenses').get(function() {
  return this.oneTimeExpenses.reduce((sum, item) => {
    return item.status === 'spent' ? sum + item.amount : sum;
  }, 0);
});

// Virtual for total planned one-time expenses
yearlyBudgetSchema.virtual('totalPlannedOneTimeExpenses').get(function() {
  return this.oneTimeExpenses.reduce((sum, item) => {
    return item.status === 'planned' ? sum + item.amount : sum;
  }, 0);
});

// Virtual for total budget (including one-time items)
yearlyBudgetSchema.virtual('totalBudgetedIncome').get(function() {
  return this.totalIncome + this.totalPlannedOneTimeIncome;
});

// Virtual for total budgeted expenses (including one-time items)
yearlyBudgetSchema.virtual('totalBudgetedExpenses').get(function() {
  return this.totalExpenses + this.totalPlannedOneTimeExpenses;
});

// Virtual for actual total income (including received one-time items)
yearlyBudgetSchema.virtual('totalActualIncome').get(function() {
  return this.totalIncome + this.totalOneTimeIncome;
});

// Virtual for actual total expenses (including spent one-time items)
yearlyBudgetSchema.virtual('totalActualExpenses').get(function() {
  return this.totalExpenses + this.totalOneTimeExpenses;
});

// Virtual for budget balance
yearlyBudgetSchema.virtual('budgetBalance').get(function() {
  return this.totalBudgetedIncome - this.totalBudgetedExpenses;
});

// Virtual for actual balance
yearlyBudgetSchema.virtual('actualBalance').get(function() {
  return this.totalActualIncome - this.totalActualExpenses;
});

// Ensure virtuals are included in JSON output
yearlyBudgetSchema.set('toJSON', { virtuals: true });
yearlyBudgetSchema.set('toObject', { virtuals: true });

// Static method to find or create yearly budget
yearlyBudgetSchema.statics.findOrCreate = async function(userId, year) {
  let budget = await this.findOne({ userId, year });
  
  if (!budget) {
    budget = new this({
      userId,
      year,
      oneTimeIncome: [],
      oneTimeExpenses: [],
      projectBudgets: []
    });
    await budget.save();
  }
  
  return budget;
};

// Static method to calculate totals from monthly budgets
yearlyBudgetSchema.statics.calculateFromMonthlyBudgets = async function(userId, year) {
  const { MonthlyBudget } = require('./');
  
  const monthlyBudgets = await MonthlyBudget.find({ userId, year });
  
  let totalIncome = 0;
  let totalExpenses = 0;
  
  for (const monthlyBudget of monthlyBudgets) {
    totalIncome += monthlyBudget.totalBudgetedIncome;
    totalExpenses += monthlyBudget.totalBudgetedExpenses;
  }
  
  return { totalIncome, totalExpenses };
};

// Method to update totals from monthly budgets
yearlyBudgetSchema.methods.updateFromMonthlyBudgets = async function() {
  const totals = await this.constructor.calculateFromMonthlyBudgets(this.userId, this.year);
  
  this.totalIncome = totals.totalIncome;
  this.totalExpenses = totals.totalExpenses;
  
  await this.save();
  return this;
};

// Method to add one-time income
yearlyBudgetSchema.methods.addOneTimeIncome = function(incomeData) {
  this.oneTimeIncome.push({
    description: incomeData.description,
    amount: incomeData.amount,
    expectedDate: incomeData.expectedDate,
    categoryId: incomeData.categoryId,
    notes: incomeData.notes || '',
    status: 'planned'
  });
  
  return this;
};

// Method to add one-time expense
yearlyBudgetSchema.methods.addOneTimeExpense = function(expenseData) {
  this.oneTimeExpenses.push({
    description: expenseData.description,
    amount: expenseData.amount,
    expectedDate: expenseData.expectedDate,
    categoryId: expenseData.categoryId,
    subCategoryId: expenseData.subCategoryId,
    notes: expenseData.notes || '',
    status: 'planned'
  });
  
  return this;
};

// Method to mark one-time income as received
yearlyBudgetSchema.methods.markIncomeReceived = function(incomeId, actualDate = new Date()) {
  const income = this.oneTimeIncome.id(incomeId);
  if (income) {
    income.status = 'received';
    income.actualDate = actualDate;
  }
  return this;
};

// Method to mark one-time expense as spent
yearlyBudgetSchema.methods.markExpenseSpent = function(expenseId, actualDate = new Date()) {
  const expense = this.oneTimeExpenses.id(expenseId);
  if (expense) {
    expense.status = 'spent';
    expense.actualDate = actualDate;
  }
  return this;
};

// Method to get upcoming one-time items
yearlyBudgetSchema.methods.getUpcomingItems = function(daysAhead = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
  
  const upcomingIncome = this.oneTimeIncome.filter(item => 
    item.status === 'planned' && 
    item.expectedDate <= cutoffDate &&
    item.expectedDate >= new Date()
  );
  
  const upcomingExpenses = this.oneTimeExpenses.filter(item => 
    item.status === 'planned' && 
    item.expectedDate <= cutoffDate &&
    item.expectedDate >= new Date()
  );
  
  return {
    income: upcomingIncome.sort((a, b) => a.expectedDate - b.expectedDate),
    expenses: upcomingExpenses.sort((a, b) => a.expectedDate - b.expectedDate)
  };
};

// Method to get yearly overview
yearlyBudgetSchema.methods.getYearlyOverview = function() {
  const quarters = {
    Q1: { months: [1, 2, 3], income: 0, expenses: 0 },
    Q2: { months: [4, 5, 6], income: 0, expenses: 0 },
    Q3: { months: [7, 8, 9], income: 0, expenses: 0 },
    Q4: { months: [10, 11, 12], income: 0, expenses: 0 }
  };
  
  // Distribute one-time items to quarters
  this.oneTimeIncome.forEach(item => {
    if (item.status !== 'cancelled') {
      const quarter = Math.ceil(item.expectedDate.getMonth() + 1 / 3);
      const quarterKey = `Q${quarter}`;
      if (quarters[quarterKey]) {
        quarters[quarterKey].income += item.amount;
      }
    }
  });
  
  this.oneTimeExpenses.forEach(item => {
    if (item.status !== 'cancelled') {
      const quarter = Math.ceil((item.expectedDate.getMonth() + 1) / 3);
      const quarterKey = `Q${quarter}`;
      if (quarters[quarterKey]) {
        quarters[quarterKey].expenses += item.amount;
      }
    }
  });
  
  return {
    totalBudgetedIncome: this.totalBudgetedIncome,
    totalBudgetedExpenses: this.totalBudgetedExpenses,
    budgetBalance: this.budgetBalance,
    totalActualIncome: this.totalActualIncome,
    totalActualExpenses: this.totalActualExpenses,
    actualBalance: this.actualBalance,
    quarters
  };
};

const YearlyBudget = mongoose.model('YearlyBudget', yearlyBudgetSchema);

module.exports = YearlyBudget;
