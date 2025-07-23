const mongoose = require('mongoose');

const creditCardSchema = new mongoose.Schema({
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
  // Display name from accountNumber field in israeli-bank-scrapers
  cardNumber: {
    type: String,
    required: true,
    trim: true
  },
  // User-friendly display name
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  // Timing configuration for budget allocation
  timingFlexibility: {
    // Number of grace period days after month end (0-15)
    gracePeriodDays: {
      type: Number,
      default: 15,
      min: 0,
      max: 15
    },
    // Day of month for billing cycle cutoff (1-31)
    cutoffDay: {
      type: Number,
      default: 1,
      min: 1,
      max: 31
    }
  },
  // Card status
  isActive: {
    type: Boolean,
    default: true
  },
  // Card brand/type (Visa, MasterCard, etc.)
  cardType: {
    type: String,
    trim: true
  },
  // Last 4 digits for identification (if available)
  lastFourDigits: {
    type: String,
    maxlength: 4
  }
}, {
  timestamps: true
});

// Ensure unique card per bank account
creditCardSchema.index({ bankAccountId: 1, cardNumber: 1 }, { unique: true });

// Index for user queries
creditCardSchema.index({ userId: 1, isActive: 1 });

// Static method to find or create a credit card
creditCardSchema.statics.findOrCreate = async function(cardData) {
  let creditCard = await this.findOne({
    bankAccountId: cardData.bankAccountId,
    cardNumber: cardData.cardNumber
  });

  if (!creditCard) {
    creditCard = new this(cardData);
    await creditCard.save();
  }

  return creditCard;
};

// Static method to get user's active credit cards
creditCardSchema.statics.getUserActiveCards = async function(userId) {
  return this.find({
    userId,
    isActive: true
  })
  .populate('bankAccountId', 'name bankId')
  .sort({ displayName: 1 });
};

// Method to update timing configuration
creditCardSchema.methods.updateTimingConfig = async function(gracePeriodDays, cutoffDay) {
  this.timingFlexibility.gracePeriodDays = gracePeriodDays;
  this.timingFlexibility.cutoffDay = cutoffDay;
  await this.save();
  return this;
};

// Method to determine which month a transaction should be allocated to
creditCardSchema.methods.getAllocationMonth = function(transactionDate) {
  const cutoffDay = this.timingFlexibility.cutoffDay;
  const gracePeriodDays = this.timingFlexibility.gracePeriodDays;
  
  // Create date object for the transaction
  const txDate = new Date(transactionDate);
  
  // If transaction is before cutoff day, it belongs to current month
  if (txDate.getDate() < cutoffDay) {
    return {
      year: txDate.getFullYear(),
      month: txDate.getMonth() + 1 // MongoDB months are 1-12
    };
  }
  
  // If transaction is after cutoff day, it belongs to next month
  // But we need to account for grace period
  const nextMonth = new Date(txDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  // Check if we're still within grace period of next month
  const nextMonthStart = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
  const graceEndDate = new Date(nextMonthStart);
  graceEndDate.setDate(graceEndDate.getDate() + gracePeriodDays);
  
  const now = new Date();
  if (now <= graceEndDate) {
    return {
      year: nextMonth.getFullYear(),
      month: nextMonth.getMonth() + 1
    };
  }
  
  // Default to transaction month if outside grace period
  return {
    year: txDate.getFullYear(),
    month: txDate.getMonth() + 1
  };
};

const CreditCard = mongoose.model('CreditCard', creditCardSchema);

module.exports = CreditCard;
