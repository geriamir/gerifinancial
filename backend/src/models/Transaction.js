const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  processedDate: {
    type: Date,
    default: null,
  },
  type: {
    type: String,
    enum: ['Expense', 'Income', 'Transfer'],
    required: true,
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
  },
  isAutoCategorized: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'error'],
    default: 'pending',
  },
  transferDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  timestamps: true,
});

// Ensure transactions are unique per account
transactionSchema.index({ identifier: 1, accountId: 1 }, { unique: true });

// Create indexes for common queries
transactionSchema.index({ accountId: 1, date: -1 });
transactionSchema.index({ category: 1, date: -1 });
transactionSchema.index({ status: 1 });

// Helper method to categorize a transaction
transactionSchema.methods.categorize = async function(categoryId, subCategoryId, isAuto = false) {
  this.category = categoryId;
  this.subCategory = subCategoryId;
  this.isAutoCategorized = isAuto;
  this.processedDate = new Date();
  this.status = 'processed';
  await this.save();
};

// Static method to find transactions within a date range
transactionSchema.statics.findByDateRange = async function(accountId, startDate, endDate) {
  return this.find({
    accountId,
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
transactionSchema.statics.findUncategorized = async function(accountId) {
  return this.find({
    accountId,
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
          type: 'Expense'
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
          type: 'Income'
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

// Method to create transaction from scraper data
transactionSchema.statics.createFromScraperData = async function(scraperTransaction, accountId, defaultCurrency) {
  const type = determineTransactionType(scraperTransaction);
  
  return this.create({
    identifier: scraperTransaction.identifier,
    accountId,
    amount: Math.abs(scraperTransaction.chargedAmount),
    currency: scraperTransaction.currency || defaultCurrency,
    date: new Date(scraperTransaction.date),
    type,
    description: scraperTransaction.description,
    memo: scraperTransaction.memo || '',
    rawData: scraperTransaction,
    status: 'pending'
  });
};

// Helper function to determine transaction type
function determineTransactionType(scraperTransaction) {
  const amount = scraperTransaction.chargedAmount;
  
  if (scraperTransaction.type === 'CREDIT_CARD_PAYMENT') {
    return 'Transfer';
  }
  
  return amount < 0 ? 'Expense' : 'Income';
}

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
