const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Onboarding progress tracking
  onboardingStatus: {
    isComplete: {
      type: Boolean,
      default: false
    },
    completedSteps: [{
      type: String,
      enum: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup', 'credit-card-verification', 'complete']
    }],
    hasCheckingAccount: {
      type: Boolean,
      default: false
    },
    hasCreditCards: {
      type: Boolean,
      default: false
    },
    creditCardAnalysisResults: {
      transactionCount: {
        type: Number,
        default: 0
      },
      recommendation: {
        type: String,
        enum: ['connect', 'optional', 'skip'],
        default: 'skip'
      },
      analyzedAt: {
        type: Date,
        default: null
      }
    },
    completedAt: {
      type: Date,
      default: null
    },
    // Real-time transaction scraping status
    scrapingStatus: {
      isActive: {
        type: Boolean,
        default: false
      },
      status: {
        type: String,
        enum: ['connecting', 'scraping', 'categorizing', 'complete', 'error'],
        default: null
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
      sessionId: {
        type: String,
        default: null
      },
      error: {
        type: String,
        default: null
      }
    },
    // Transaction import results
    hasImportedTransactions: {
      type: Boolean,
      default: false
    },
    transactionsImported: {
      type: Number,
      default: 0
    },
    importCompletedAt: {
      type: Date,
      default: null
    }
  },
  
  // Task system for overview page
  tasks: [{
    type: {
      type: String,
      enum: ['credit_card_connection', 'budget_setup', 'categorization_review'],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to validate password
userSchema.methods.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
