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
        // Amount can be negative for expenses, positive for income/transfers
        return typeof v === 'number' && !isNaN(v) &&
               ((this.type === TransactionType.EXPENSE && v < 0) || 
                ([TransactionType.INCOME, TransactionType.TRANSFER].includes(this.type) && v > 0));
      },
      message: props => {
        const sign = props.value < 0 ? 'negative' : 'positive';
        return `Amount must be ${props.value < 0 ? 'negative for expenses' : 'positive for income/transfers'} (got ${sign} value for type ${props.type})`;
      }
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
  processedDate: {
    type: Date,
    default: null,
  },
  type: {
    type: String,
    enum: {
      values: Object.values(TransactionType),
      message: '{VALUE} is not a valid transaction type'
    },
    required: [true, 'Transaction type is required'],
    validate: {
      validator: function(v) {
        return Object.values(TransactionType).includes(v);
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
  },
  categorizationMethod: {
    type: String,
    enum: Object.values(CategorizationMethod),
    default: CategorizationMethod.MANUAL
  },
  status: {
    type: String,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.VERIFIED, // All transactions in main storage are verified
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
transactionSchema.methods.categorize = async function(categoryId, subCategoryId, method = CategorizationMethod.MANUAL) {
  this.category = categoryId;
  this.subCategory = subCategoryId;
  this.categorizationMethod = method;
  this.processedDate = new Date();
  await this.save();
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

// Static method to find transactions needing verification
transactionSchema.statics.findNeedingVerification = async function(userId, options = {}) {
  if (!userId) throw new Error('userId is required');
  
  const query = {
    userId,
    status: TransactionStatus.NEEDS_VERIFICATION
  };

  if (options.accountId) {
    query.accountId = options.accountId;
  }

  const baseQuery = this.find(query)
    .sort({ date: -1 })
    .populate('category')
    .populate('subCategory');

  if (options.limit) {
    baseQuery.limit(options.limit);
  }

  if (options.skip) {
    baseQuery.skip(options.skip);
  }

  return baseQuery;
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

// Method to create transaction from scraper data (now only used for migrating from pending)
transactionSchema.statics.createFromScraperData = async function(scraperTransaction, accountId, defaultCurrency, userId) {
  if (!userId) {
    throw new Error('userId is required when creating a transaction');
  }

  const type = determineTransactionType(scraperTransaction);
  
  // Use provided identifier or generate a unique one
  const identifier = scraperTransaction.identifier || [
    accountId,
    scraperTransaction.date,
    scraperTransaction.chargedAmount,
    scraperTransaction.description,
    Date.now(),
    Math.random().toString(36).slice(2, 8)
  ].join('_');
  
  return await this.create({
    identifier,
    originalIdentifier: scraperTransaction.originalIdentifier || scraperTransaction.identifier || null,
    accountId,
    userId,
    amount: scraperTransaction.chargedAmount,
    currency: scraperTransaction.currency || defaultCurrency,
    date: new Date(scraperTransaction.date),
    type,
    description: scraperTransaction.description,
    memo: scraperTransaction.memo || '',
    rawData: scraperTransaction,
    status: TransactionStatus.VERIFIED // All transactions in main storage are verified
  });
};

// Helper function to determine transaction type
function determineTransactionType(scraperTransaction) {
  const amount = scraperTransaction.chargedAmount;
  
  if (scraperTransaction.type === 'CREDIT_CARD_PAYMENT') {
    return TransactionType.TRANSFER;
  }
  
  return amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
}

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
