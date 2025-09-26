const mongoose = require('mongoose');
const logger = require('../../shared/utils/logger');

const foreignCurrencyAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true
  },
  // Account number for this foreign currency account
  accountNumber: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    match: /^[A-Z]{3}$/
  },
  accountType: {
    type: String,
    enum: ['checking', 'savings', 'credit', 'investment'],
    default: 'checking'
  },
  // Current balance in the foreign currency
  balance: {
    type: Number,
    default: 0
  },
  // Balance in ILS (for display purposes)
  balanceILS: {
    type: Number,
    default: 0
  },
  // Last exchange rate used for conversion
  lastExchangeRate: {
    type: Number,
    default: null
  },
  lastExchangeRateDate: {
    type: Date,
    default: null
  },
  // Account status
  status: {
    type: String,
    enum: ['active', 'inactive', 'closed'],
    default: 'active'
  },
  // Statistics
  transactionCount: {
    type: Number,
    default: 0
  },
  lastTransactionDate: {
    type: Date,
    default: null
  },
  // Metadata from scraping
  scrapingMetadata: {
    lastScraped: {
      type: Date,
      default: null
    },
    source: {
      type: String,
      default: 'israeli-bank-scrapers'
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed
    }
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
foreignCurrencyAccountSchema.index({ 
  userId: 1, 
  bankAccountId: 1, 
  currency: 1 
}, { unique: true });

foreignCurrencyAccountSchema.index({ 
  userId: 1, 
  accountNumber: 1,
  currency: 1 
});

foreignCurrencyAccountSchema.index({ 
  bankAccountId: 1, 
  status: 1 
});


// Virtual for display name
foreignCurrencyAccountSchema.virtual('displayName').get(function() {
  return `${this.currency} Account (${this.accountNumber})`;
});

// Method to update balance and exchange rate
foreignCurrencyAccountSchema.methods.updateBalance = async function(balance, exchangeRate = null) {
  this.balance = balance;
  this.lastExchangeRateDate = new Date();
  
  if (exchangeRate) {
    this.lastExchangeRate = exchangeRate;
    this.balanceILS = balance * exchangeRate;
  } else {
    // Try to get current exchange rate
    const { CurrencyExchange } = require('../models');
    try {
      const rate = await CurrencyExchange.getRate(this.currency, 'ILS');
      if (rate) {
        this.lastExchangeRate = rate;
        this.balanceILS = balance * rate;
      }
    } catch (error) {
      logger.warn(`Failed to get exchange rate for ${this.currency} to ILS:`, error.message);
    }
  }
  
  await this.save();
  return this;
};

// Method to update transaction statistics
foreignCurrencyAccountSchema.methods.updateTransactionStats = async function(transactionCount, lastTransactionDate) {
  this.transactionCount = transactionCount;
  if (lastTransactionDate) {
    this.lastTransactionDate = new Date(lastTransactionDate);
  }
  await this.save();
  return this;
};

// Static method to find or create foreign currency account
foreignCurrencyAccountSchema.statics.findOrCreate = async function(userId, bankAccountId, accountNumber, currency, accountData = {}) {
  // Search only by the compound unique key (userId, bankAccountId, currency)
  let account = await this.findOne({
    userId,
    bankAccountId,
    currency: currency.toUpperCase()
  });

  if (!account) {
    account = new this({
      userId,
      bankAccountId,
      accountNumber,
      currency: currency.toUpperCase(),
      accountType: accountData.accountType || 'checking',
      balance: accountData.balance || 0,
      transactionCount: accountData.transactionCount || 0,
      lastTransactionDate: accountData.lastTransactionDate || null,
      scrapingMetadata: {
        lastScraped: new Date(),
        source: 'israeli-bank-scrapers',
        rawData: accountData.rawAccountData || {}
      }
    });

    await account.save();
    logger.info(`Created foreign currency account: ${account.displayName} for user ${userId}`);
  } else {
    // Update existing account with new data
    account.balance = accountData.balance || account.balance;
    account.transactionCount = accountData.transactionCount || account.transactionCount;
    account.lastTransactionDate = accountData.lastTransactionDate || account.lastTransactionDate;
    account.scrapingMetadata.lastScraped = new Date();
    account.scrapingMetadata.rawData = accountData.rawAccountData || account.scrapingMetadata.rawData;
    
    // Update account number if it's different (keep the most recent one)
    if (accountNumber && accountNumber !== account.accountNumber) {
      logger.debug(`Updating account number from ${account.accountNumber} to ${accountNumber} for ${account.displayName}`);
      account.accountNumber = accountNumber;
    }
    
    await account.save();
    logger.debug(`Updated foreign currency account: ${account.displayName}`);
  }

  return account;
};

// Static method to get all foreign currency accounts for a user
foreignCurrencyAccountSchema.statics.getUserAccounts = async function(userId, options = {}) {
  const query = { userId, status: { $ne: 'closed' } };
  
  if (options.currency) {
    query.currency = options.currency.toUpperCase();
  }
  
  if (options.bankAccountId) {
    query.bankAccountId = options.bankAccountId;
  }

  return this.find(query)
    .populate('bankAccountId', 'name bankId')
    .sort({ currency: 1, createdAt: -1 });
};

// Static method to get currency summary for a user
foreignCurrencyAccountSchema.statics.getCurrencySummary = async function(userId) {
  return this.aggregate([
    {
      $match: { 
        userId: new mongoose.Types.ObjectId(userId),
        status: { $ne: 'closed' }
      }
    },
    {
      $group: {
        _id: '$currency',
        totalBalance: { $sum: '$balance' },
        totalBalanceILS: { $sum: '$balanceILS' },
        accountCount: { $sum: 1 },
        totalTransactions: { $sum: '$transactionCount' },
        lastTransactionDate: { $max: '$lastTransactionDate' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

// Method to convert balance to ILS
foreignCurrencyAccountSchema.methods.getBalanceInILS = async function(date = new Date()) {
  if (this.currency === 'ILS') {
    return this.balance;
  }

  // Use cached rate if recent (within 1 day)
  if (this.lastExchangeRate && this.lastExchangeRateDate && 
      (date - this.lastExchangeRateDate) < 24 * 60 * 60 * 1000) {
    return this.balance * this.lastExchangeRate;
  }

  // Get fresh exchange rate
  const { CurrencyExchange } = require('../models');
  try {
    const rate = await CurrencyExchange.getRate(this.currency, 'ILS', date);
    if (rate) {
      return this.balance * rate;
    }
  } catch (error) {
    logger.warn(`Failed to convert ${this.currency} balance to ILS:`, error.message);
  }

  // Fallback to cached rate or null
  return this.lastExchangeRate ? this.balance * this.lastExchangeRate : null;
};

// Method to get account summary
foreignCurrencyAccountSchema.methods.getSummary = function() {
  return {
    accountNumber: this.accountNumber,
    displayName: this.displayName,
    currency: this.currency,
    balance: this.balance,
    balanceILS: this.balanceILS,
    transactionCount: this.transactionCount,
    lastTransactionDate: this.lastTransactionDate,
    status: this.status,
    lastExchangeRate: this.lastExchangeRate,
    lastExchangeRateDate: this.lastExchangeRateDate
  };
};

module.exports = mongoose.model('ForeignCurrencyAccount', foreignCurrencyAccountSchema);
