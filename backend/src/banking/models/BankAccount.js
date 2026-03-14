const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../../shared/utils/encryption');
const logger = require('../../shared/utils/logger');

const bankAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bankId: {
    type: String,
    required: true,
    enum: ['hapoalim', 'leumi', 'discount', 'otsarHahayal', 'visaCal', 'max', 'isracard', 'mercury'] // Supported banks
  },
  defaultCurrency: {
    type: String,
    required: true,
    default: 'ILS'
  },
  name: {
    type: String,
    required: true
  },
  credentials: {
    username: {
      type: String,
      required: function() { return this.bankId !== 'mercury' && this.bankId !== 'ibkr'; }
    },
    password: {
      type: String,
      required: function() { return this.bankId !== 'mercury' && this.bankId !== 'ibkr'; }
    },
    apiToken: {
      type: String,
      required: function() { return this.bankId === 'mercury'; }
    },
    flexToken: {
      type: String,
      required: function() { return this.bankId === 'ibkr'; }
    },
    queryId: {
      type: String,
      required: function() { return this.bankId === 'ibkr'; }
    }
  },
  // Per-strategy sync tracking
  strategySync: {
    'checking-accounts': {
      lastScraped: { type: Date, default: null },
      lastAttempted: { type: Date, default: null },
      status: { type: String, enum: ['success', 'failed', 'never'], default: 'never' }
    },
    'investment-portfolios': {
      lastScraped: { type: Date, default: null },
      lastAttempted: { type: Date, default: null },
      status: { type: String, enum: ['success', 'failed', 'never'], default: 'never' }
    },
    'foreign-currency': {
      lastScraped: { type: Date, default: null },
      lastAttempted: { type: Date, default: null },
      status: { type: String, enum: ['success', 'failed', 'never'], default: 'never' }
    },
    'mercury-checking': {
      lastScraped: { type: Date, default: null },
      lastAttempted: { type: Date, default: null },
      status: { type: String, enum: ['success', 'failed', 'never'], default: 'never' }
    },
    'ibkr-flex': {
      lastScraped: { type: Date, default: null },
      lastAttempted: { type: Date, default: null },
      status: { type: String, enum: ['success', 'failed', 'never'], default: 'never' }
    }
  },
  // Global last scraped for backward compatibility and general status
  lastScraped: {
    type: Date,
    default: null
  },
  // Current balance (updated on each sync for quick access)
  currentBalance: {
    type: Number,
    default: null
  },
  lastBalanceUpdate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'error', 'pending', 'disabled'],
    default: 'pending'
  },
  lastError: {
    message: String,
    date: Date
  },
  // Real-time scraping status tracking
  scrapingStatus: {
    isActive: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['connecting', 'scraping', 'categorizing', 'complete', 'error', 'idle'],
      default: 'idle'
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    message: {
      type: String,
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    lastUpdatedAt: {
      type: Date,
      default: null
    },
    transactionsImported: {
      type: Number,
      default: 0
    },
    transactionsCategorized: {
      type: Number,
      default: 0
    }
  },
  scrapingConfig: {
    schedule: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        default: 'daily'
      },
      // For weekly: 0 = Sunday, 6 = Saturday
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
        default: 0
      },
      // For monthly
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
        default: 1
      },
      // Time of day to run scraping (24h format)
      timeOfDay: {
        type: String,
        match: /^([01]\d|2[0-3]):([0-5]\d)$/,
        default: '00:00'
      }
    },
    options: {
      startDate: {
        type: Date,
        default: () => {
          const date = new Date();
          date.setMonth(date.getMonth() - 6); // Default to 6 months ago for first scraping
          return date;
        }
      },
      // Number of months of transactions to fetch
      monthsBack: {
        type: Number,
        min: 1,
        max: 12,
        default: 6
      }
    }
  }
}, {
  timestamps: true
});

// Remove sensitive information when converting to JSON
bankAccountSchema.set('toJSON', {
  transform: function(doc, ret, options) {
    if (ret.credentials) {
      ret.credentials = {
        username: ret.credentials.username
        // password and apiToken are intentionally omitted
      };
    }
    return ret;
  }
});

// Index for efficient queries
bankAccountSchema.index({ userId: 1, bankId: 1 });

// Check if a value looks like it was encrypted by our encrypt() function.
// Encrypted format is: 32-hex-char IV + ':' + hex-encoded ciphertext
function isEncrypted(text) {
  if (!text || !text.includes(':')) return false;
  const ivPart = text.split(':')[0];
  return /^[0-9a-f]{32}$/i.test(ivPart);
}

// Pre-save middleware to encrypt credentials
bankAccountSchema.pre('save', function(next) {
  try {
    if (this.isModified('credentials.password') && this.credentials.password) {
      if (!isEncrypted(this.credentials.password)) {
        this.credentials.password = encrypt(this.credentials.password);
      }
    }
    if (this.isModified('credentials.apiToken') && this.credentials.apiToken) {
      if (!isEncrypted(this.credentials.apiToken)) {
        this.credentials.apiToken = encrypt(this.credentials.apiToken);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Method to get scraper options for a specific strategy
bankAccountSchema.methods.getScraperOptionsForStrategy = function(strategyName) {
  // Strategy-specific start date logic
  let startDate;
  const strategyData = this.strategySync?.[strategyName];
  
  if (strategyData?.lastScraped) {
    // Use strategy-specific last scraped date for incremental scraping
    startDate = strategyData.lastScraped;
  } else {
    // First scrape for this strategy: go back 6 months
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
  }

  const options = {
    companyId: this.bankId,
    credentials: {
      username: this.credentials.username,
      password: decrypt(this.credentials.password)
    },
    startDate: startDate,
    showBrowser: false,
    verbose: false
  };

  return options;
};

// Legacy method for backward compatibility
bankAccountSchema.methods.getScraperOptions = function() {
  // Use the most recent strategy sync date or fallback to 6 months
  let startDate;
  if (this.lastScraped) {
    startDate = this.lastScraped;
  } else {
    startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
  }

  const options = {
    companyId: this.bankId,
    credentials: {
      username: this.credentials.username,
      password: decrypt(this.credentials.password)
    },
    startDate: startDate,
    showBrowser: false,
    verbose: false
  };

  return options;
};

// Update strategy sync status
bankAccountSchema.methods.updateStrategySync = function(strategyName, success, error = null, lastTransactionDate = null) {
  if (!this.strategySync) {
    this.strategySync = {};
  }
  
  if (!this.strategySync[strategyName]) {
    this.strategySync[strategyName] = {
      lastScraped: null,
      lastAttempted: null,
      status: 'never'
    };
  }

  const now = new Date();
  this.strategySync[strategyName].lastAttempted = now;
  
  if (success) {
    // Use the latest transaction date when available, otherwise fall back to now
    this.strategySync[strategyName].lastScraped = lastTransactionDate || now;
    this.strategySync[strategyName].status = 'success';
    
    // Update global lastScraped to most recent successful strategy sync
    this.lastScraped = lastTransactionDate || now;

    // Clear lastError if no strategies are still in failed state
    const hasFailedStrategy = Object.values(this.strategySync.toObject ? this.strategySync.toObject() : this.strategySync)
      .some(s => s && s.status === 'failed');
    if (!hasFailedStrategy) {
      this.lastError = null;
    }
  } else {
    this.strategySync[strategyName].status = 'failed';
    if (error) {
      this.lastError = {
        message: `${strategyName}: ${error}`,
        date: now
      };
    }
  }
};

// Check if strategy needs sync based on schedule
bankAccountSchema.methods.strategyNeedsSync = function(strategyName, hoursThreshold = 24) {
  const strategyData = this.strategySync?.[strategyName];
  
  if (!strategyData || !strategyData.lastScraped) {
    return true; // Never synced
  }
  
  const hoursSinceLastSync = (Date.now() - strategyData.lastScraped.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastSync >= hoursThreshold;
};

// Get next scraping time based on schedule
bankAccountSchema.methods.getNextScrapingTime = function() {
  const now = new Date();
  const schedule = this.scrapingConfig.schedule;
  const time = schedule.timeOfDay.split(':');
  const nextRun = new Date();
  
  nextRun.setHours(parseInt(time[0], 10));
  nextRun.setMinutes(parseInt(time[1], 10));
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);

  switch (schedule.frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
      
    case 'weekly':
      const currentDay = nextRun.getDay();
      const daysUntilTarget = (schedule.dayOfWeek - currentDay + 7) % 7;
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      if (daysUntilTarget === 0 && nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 7);
      }
      break;
      
    case 'monthly':
      nextRun.setDate(schedule.dayOfMonth);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }
  
  return nextRun;
};


module.exports = mongoose.model('BankAccount', bankAccountSchema);
