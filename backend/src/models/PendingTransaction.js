const mongoose = require('mongoose');
const { CategorizationMethod, TransactionType, TransactionStatus } = require('../constants/enums');
const Transaction = require('./Transaction');

const pendingTransactionSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
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
    required: [true, 'Transaction type is required']
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
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  timestamps: true,
});

// Ensure pending transactions are unique per account
pendingTransactionSchema.index({ identifier: 1, accountId: 1 }, { unique: true });

// Create indexes for common queries
pendingTransactionSchema.index({ accountId: 1, date: -1 });
pendingTransactionSchema.index({ category: 1, date: -1 });

// Helper method to categorize a transaction
pendingTransactionSchema.methods.categorize = async function(categoryId, subCategoryId, method = CategorizationMethod.MANUAL) {
  this.category = categoryId;
  this.subCategory = subCategoryId;
  this.categorizationMethod = method;
  this.processedDate = new Date();
  await this.save();
};

// Method to verify and move to permanent storage
pendingTransactionSchema.methods.verify = async function() {
  // First populate category and subCategory to ensure we have the full objects
  await this.populate(['category', 'subCategory']);
  
  if (!this.category || !this.subCategory) {
    throw new Error('Transaction must be categorized before verification');
  }

  // Get the ID values, handling both populated and unpopulated cases
  const categoryId = this.category._id || this.category;
  const subCategoryId = this.subCategory._id || this.subCategory;

  // Create permanent transaction
  const permanentTransaction = await Transaction.create({
    identifier: this.identifier,
    userId: this.userId,
    accountId: this.accountId,
    amount: this.amount,
    currency: this.currency,
    date: this.date,
    type: this.type,
    description: this.description,
    memo: this.memo,
    category: categoryId,
    subCategory: subCategoryId,
    categorizationMethod: this.categorizationMethod,
    status: TransactionStatus.VERIFIED,
    rawData: this.rawData,
    processedDate: new Date()
  });

  // Only delete pending transaction if permanent was created successfully
  if (permanentTransaction) {
    await this.deleteOne();
  }

  return permanentTransaction;
};

// Static method to create from scraper data
pendingTransactionSchema.statics.createFromScraperData = async function(scraperTransaction, accountId, defaultCurrency, userId) {
  if (!userId) {
    throw new Error('userId is required when creating a transaction');
  }

  const type = determineTransactionType(scraperTransaction);
  
  let identifier;
  // Use the original identifier if provided
  if (scraperTransaction.identifier) {
    identifier = scraperTransaction.identifier;
  } else {
    // Generate a unique identifier
    identifier = [
      accountId,
      scraperTransaction.date,
      scraperTransaction.chargedAmount,
      scraperTransaction.description,
      Date.now(),
      Math.random().toString(36).slice(2, 8)
    ].join('_');
  }
  
  const transaction = await this.create({
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
    rawData: scraperTransaction
  });

  return transaction;
};

// Helper function to determine transaction type
function determineTransactionType(scraperTransaction) {
  const amount = scraperTransaction.chargedAmount;
  
  if (scraperTransaction.type === 'CREDIT_CARD_PAYMENT') {
    return TransactionType.TRANSFER;
  }
  
  return amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
}

const PendingTransaction = mongoose.model('PendingTransaction', pendingTransactionSchema);

module.exports = PendingTransaction;
