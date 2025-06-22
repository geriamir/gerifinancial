const mongoose = require('mongoose');

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
  accountNumber: {
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
  }
}, {
  timestamps: true
});

// Index for efficient queries
bankAccountSchema.index({ userId: 1, bankId: 1 });

// Method to get scraper options
bankAccountSchema.methods.getScraperOptions = function() {
  return {
    companyId: this.bankId,
    credentials: {
      username: this.credentials.username,
      password: this.credentials.password
    }
  };
};

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

module.exports = BankAccount;
