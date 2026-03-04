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
  displayCurrency: {
    type: String,
    default: 'ILS',
    trim: true
  },
  // Enhanced onboarding tracking with complete state persistence
  onboarding: {
    // Overall status
    isComplete: {
      type: Boolean,
      default: false
    },
    currentStep: {
      type: String,
      enum: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup', 'credit-card-matching', 'complete'],
      default: 'checking-account'
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    
    // Step 1: Main Checking Account
    checkingAccount: {
      connected: {
        type: Boolean,
        default: false
      },
      accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankAccount',
        default: null
      },
      connectedAt: {
        type: Date,
        default: null
      },
      bankId: {
        type: String,
        default: null
      }
    },
    
    // Step 2: Transaction Import
    transactionImport: {
      completed: {
        type: Boolean,
        default: false
      },
      transactionsImported: {
        type: Number,
        default: 0
      },
      completedAt: {
        type: Date,
        default: null
      },
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
        error: {
          type: String,
          default: null
        }
      }
    },
    
    // Step 3: Credit Card Detection
    creditCardDetection: {
      analyzed: {
        type: Boolean,
        default: false
      },
      analyzedAt: {
        type: Date,
        default: null
      },
      transactionCount: {
        type: Number,
        default: 0
      },
      recommendation: {
        type: String,
        enum: ['connect', 'optional', 'skip'],
        default: null
      },
      sampleTransactions: [{
        date: Date,
        description: String,
        amount: Number
      }]
    },
    
    // Step 4: Credit Card Setup
    creditCardSetup: {
      skipped: {
        type: Boolean,
        default: false
      },
      skippedAt: {
        type: Date,
        default: null
      },
      creditCardAccounts: [{
        accountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'BankAccount'
        },
        connectedAt: Date,
        bankId: String,
        displayName: String
      }]
    },
    
    // Step 5: Credit Card Matching
    creditCardMatching: {
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: {
        type: Date,
        default: null
      },
      totalCreditCardPayments: {
        type: Number,
        default: 0
      },
      coveredPayments: {
        type: Number,
        default: 0
      },
      uncoveredPayments: {
        type: Number,
        default: 0
      },
      coveragePercentage: {
        type: Number,
        default: 0
      },
      matchedPayments: [{
        payment: {
          id: String,
          date: Date,
          description: String,
          amount: Number
        },
        matchedCreditCard: {
          id: String,
          displayName: String,
          cardNumber: String,
          lastFourDigits: String,
          provider: String
        },
        matchedMonth: String,
        matchConfidence: Number
      }],
      uncoveredSampleTransactions: [{
        date: Date,
        description: String,
        amount: Number
      }],
      connectedCreditCards: [{
        id: String,
        displayName: String,
        provider: String
      }],
      // Legacy field for backward compatibility
      matchedTransactions: [{
        transactionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Transaction'
        },
        creditCardId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'CreditCard'
        },
        matchedAt: Date,
        matchConfidence: Number,
        matchedMonth: String
      }]
    },
    
    // Completed steps array for tracking
    completedSteps: [{
      type: String,
      enum: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup', 'credit-card-matching', 'complete']
    }]
  },
  
  // Legacy onboarding status (kept for backward compatibility during migration)
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
