const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Identity is owned by GitHub; this app stores no password of its own.
  githubId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  githubLogin: {
    type: String,
    required: true,
    trim: true
  },
  avatarUrl: {
    type: String,
    default: null
  },
  // Optional because GitHub withholds the address for accounts that keep it
  // private, and sparse so those accounts do not all collide on null.
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    default: null
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
  // Envelope encryption material for this user's bank credentials. Holds only
  // the wrapped form of the data encryption key; the key that unwraps it lives
  // in Azure Key Vault. Never selected by default so it cannot leak through a
  // query that forgets to exclude it.
  credentialKey: {
    type: {
      wrappedDek: { type: String, required: true },
      // Fully versioned key identifier, so DEKs stay unwrappable after the
      // key encryption key is rotated.
      kekId: { type: String, required: true },
      wrappedAt: { type: Date, default: Date.now }
    },
    select: false,
    default: undefined,
    _id: false
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
      countVerifiedAt: {
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
      }],
      suggestedProviders: [{
        _id: false,
        bankId: {
          type: String,
          enum: ['visaCal', 'max', 'isracard', 'amex']
        },
        paymentCount: {
          type: Number,
          min: 1
        }
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
      error: {
        type: String,
        default: null
      },
      processingAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankAccount',
        default: null
      },
      failedAccount: {
        type: {
          accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BankAccount'
          },
          bankId: String,
          displayName: String,
          error: String
        },
        default: null,
        _id: false
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
  timestamps: true,
  toJSON: {
    // Belt and braces alongside select:false, so key material can never reach
    // a response even if a query explicitly selects it.
    transform: (doc, ret) => {
      delete ret.credentialKey;
      return ret;
    }
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
