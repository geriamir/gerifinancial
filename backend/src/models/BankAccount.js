const mongoose = require('mongoose');
const scrapingSchedulerService = require('../services/scrapingSchedulerService');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

const bankAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bankId: {
    type: String,
    required: true,
    enum: ['hapoalim', 'leumi', 'discount', 'otsarHahayal', 'visaCal', 'max', 'isracard'] // Supported banks
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
      required: true
    },
    password: {
      type: String,
      required: true
    }
  },
  lastScraped: {
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
          date.setMonth(date.getMonth() - 3); // Default to 3 months ago
          return date;
        }
      },
      // Number of months of transactions to fetch
      monthsBack: {
        type: Number,
        min: 1,
        max: 12,
        default: 3
      }
    }
  }
}, {
  timestamps: true
});

// Remove sensitive information when converting to JSON
bankAccountSchema.set('toJSON', {
  transform: function(doc, ret, options) {
    delete ret.credentials;
    return ret;
  }
});

// Index for efficient queries
bankAccountSchema.index({ userId: 1, bankId: 1 });

// Method to get scraper options
bankAccountSchema.methods.getScraperOptions = function() {
  const options = {
    companyId: this.bankId,
    credentials: {
      username: this.credentials.username,
      password: decrypt(this.credentials.password)
    },
    startDate: this.scrapingConfig.options.startDate,
    showBrowser: true,
    verbose: true
  };

  return options;
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

// Schedule scraping when account becomes active
bankAccountSchema.post('save', async function(doc) {
  if (doc.status === 'active' && process.env.NODE_ENV !== 'test') {
    try {
      await scrapingSchedulerService.scheduleAccount(doc);
      logger.info(`Scheduled scraping for bank account: ${doc._id}`);
    } catch (error) {
      logger.error(`Failed to schedule scraping for bank account ${doc._id}:`, error);
    }
  }
});

// Handle status changes
bankAccountSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update.$set && update.$set.status === 'disabled') {
    const doc = await this.model.findOne(this.getQuery());
    if (doc && doc.status === 'active') {
      await scrapingSchedulerService.stopAccount(doc._id);
      logger.info(`Stopped scraping for bank account: ${doc._id}`);
    }
  }
  next();
});

// Clean up scheduler when account is deleted
bankAccountSchema.pre('remove', async function(next) {
  if (this.status === 'active') {
    await scrapingSchedulerService.stopAccount(this._id);
    logger.info(`Stopped scraping for deleted bank account: ${this._id}`);
  }
  next();
});

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

module.exports = BankAccount;
