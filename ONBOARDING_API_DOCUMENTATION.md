# Onboarding API Documentation

## Overview

The new onboarding system provides a robust, event-driven flow for guiding users through connecting their financial accounts. The system tracks complete state to allow users to resume at any point.

## Architecture

### Key Components

1. **Enhanced User Model** - Complete onboarding state in `user.onboarding`
2. **Transaction Matching** - Transactions marked with their matched credit card
3. **Event-Driven Flow** - Automatic progression through steps
4. **Smart Handlers** - Only updates status for onboarding accounts

### Onboarding Steps

1. **checking-account** - Connect main checking account
2. **transaction-import** - Import and categorize transactions
3. **credit-card-detection** - Analyze for credit card usage
4. **credit-card-setup** - Connect credit card accounts (optional)
5. **credit-card-matching** - Match payments to credit cards
6. **complete** - Onboarding finished

---

## API Endpoints

### 1. Add Checking Account

Adds the main checking account during onboarding and marks it in the onboarding structure.

**Endpoint:** `POST /api/onboarding/checking-account`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "bankId": "hapoalim",
  "credentials": {
    "username": "user123",
    "password": "pass123"
  },
  "displayName": "My Main Account" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account": {
      "_id": "507f1f77bcf86cd799439011",
      "bankId": "hapoalim",
      "accountType": "checking",
      "displayName": "My Main Account",
      "isActive": true
    },
    "onboardingStep": "transaction-import"
  }
}
```

**Side Effects:**
- Creates BankAccount record
- Updates `onboarding.checkingAccount` with accountId, bankId, connectedAt
- Sets `onboarding.currentStep` to 'transaction-import'
- Adds 'checking-account' to completedSteps
- Triggers automatic transaction scraping
- Emits `checking-accounts:started` event

---

### 2. Add Credit Card Account

Adds a credit card account during onboarding and tracks it separately from regular account additions.

**Endpoint:** `POST /api/onboarding/credit-card-account`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "bankId": "isracard",
  "credentials": {
    "username": "user123",
    "password": "pass123"
  },
  "displayName": "Isracard Visa" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "account": {
      "_id": "507f1f77bcf86cd799439012",
      "bankId": "isracard",
      "accountType": "creditCard",
      "displayName": "Isracard Visa",
      "isActive": true
    },
    "onboardingStep": "credit-card-matching",
    "message": "Credit card account added. Transactions will be imported and matched automatically."
  }
}
```

**Side Effects:**
- Creates BankAccount record
- Adds account to `onboarding.creditCardSetup.creditCardAccounts` array
- Sets `onboarding.currentStep` to 'credit-card-matching'
- Triggers automatic credit card scraping
- When all credit cards complete: automatically runs payment matching
- Emits `credit-cards:completed` event after scraping

---

### 3. Skip Credit Cards

Skips credit card setup and completes onboarding without credit cards.

**Endpoint:** `POST /api/onboarding/skip-credit-cards`

**Authentication:** Required (Bearer token)

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "onboardingComplete": true,
    "creditCardsSkipped": true
  }
}
```

**Side Effects:**
- Sets `onboarding.creditCardSetup.skipped` to true
- Sets `onboarding.currentStep` to 'complete'
- Sets `onboarding.isComplete` to true
- Adds 'credit-card-setup' to completedSteps

---

### 4. Get Onboarding Status

Retrieves complete onboarding state for the user. Use this endpoint to determine current step and what to display.

**Endpoint:** `GET /api/onboarding/status`

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "data": {
    "isComplete": false,
    "currentStep": "credit-card-setup",
    "startedAt": "2025-10-03T20:00:00.000Z",
    "completedAt": null,
    
    "checkingAccount": {
      "connected": true,
      "accountId": {
        "_id": "507f1f77bcf86cd799439011",
        "bankId": "hapoalim",
        "displayName": "My Main Account"
      },
      "connectedAt": "2025-10-03T20:00:00.000Z",
      "bankId": "hapoalim"
    },
    
    "transactionImport": {
      "completed": true,
      "transactionsImported": 150,
      "completedAt": "2025-10-03T20:05:00.000Z",
      "scrapingStatus": {
        "isActive": false,
        "status": "complete",
        "progress": 100,
        "message": "Import complete! 150 transactions imported."
      }
    },
    
    "creditCardDetection": {
      "analyzed": true,
      "analyzedAt": "2025-10-03T20:05:30.000Z",
      "transactionCount": 12,
      "recommendation": "connect",
      "sampleTransactions": [
        {
          "date": "2025-09-15T00:00:00.000Z",
          "description": "Credit Card Payment",
          "amount": 2500
        }
      ]
    },
    
    "creditCardSetup": {
      "skipped": false,
      "skippedAt": null,
      "creditCardAccounts": []
    },
    
    "creditCardMatching": {
      "completed": false,
      "completedAt": null,
      "matchedPayments": 0,
      "unmatchedPayments": 0,
      "coveragePercentage": 0,
      "matchedTransactions": []
    },
    
    "completedSteps": [
      "checking-account",
      "transaction-import",
      "credit-card-detection"
    ]
  }
}
```

---

## Event Flow

### Complete Onboarding Flow with Events

```
1. POST /api/onboarding/checking-account
   ↓
   - Saves accountId in onboarding.checkingAccount
   - Triggers scraping
   ↓
   
2. Event: checking-accounts:started
   ↓
   - Checks if accountId matches onboarding.checkingAccount.accountId
   - Updates transactionImport.scrapingStatus
   ↓
   
3. Scraping happens automatically...
   ↓
   
4. Event: checking-accounts:completed
   ↓
   - Updates transactionImport with results
   - AUTOMATICALLY runs credit card detection
   - Analyzes last 2 months for credit card transactions
   - Updates creditCardDetection with analysis
   - Sets currentStep based on recommendation
   - Emits credit-card-detection:completed event
   ↓
   
5. GET /api/onboarding/status
   ↓
   - Frontend sees currentStep: 'credit-card-setup'
   - Shows credit card detection results to user
   - User decides: connect cards or skip
   ↓
   
6a. POST /api/onboarding/credit-card-account (if connecting)
    ↓
    - Saves accountId in onboarding.creditCardSetup.creditCardAccounts
    - Triggers credit card scraping
    ↓
    
7. Event: credit-cards:completed
   ↓
   - Checks if accountId is in onboarding.creditCardSetup.creditCardAccounts
   - Waits for ALL onboarding credit cards to complete
   - AUTOMATICALLY runs payment matching
   - Marks transactions with matchedCreditCard field
   - Updates creditCardMatching with results
   - Sets currentStep to 'complete'
   - Emits credit-card-matching:completed event
   ↓
   
8. Onboarding Complete! 🎉

OR

6b. POST /api/onboarding/skip-credit-cards (if skipping)
    ↓
    - Sets creditCardSetup.skipped = true
    - Sets currentStep to 'complete'
    - Onboarding Complete! 🎉
```

---

## Data Models

### User.onboarding Structure

```javascript
{
  // Overall status
  isComplete: Boolean,
  currentStep: String, // 'checking-account' | 'transaction-import' | etc.
  startedAt: Date,
  completedAt: Date,
  
  // Step 1: Main Checking Account
  checkingAccount: {
    connected: Boolean,
    accountId: ObjectId, // Reference to BankAccount
    connectedAt: Date,
    bankId: String
  },
  
  // Step 2: Transaction Import
  transactionImport: {
    completed: Boolean,
    transactionsImported: Number,
    completedAt: Date,
    scrapingStatus: {
      isActive: Boolean,
      status: String,
      progress: Number,
      message: String,
      error: String
    }
  },
  
  // Step 3: Credit Card Detection
  creditCardDetection: {
    analyzed: Boolean,
    analyzedAt: Date,
    transactionCount: Number,
    recommendation: String, // 'connect' | 'optional' | 'skip'
    sampleTransactions: [{
      date: Date,
      description: String,
      amount: Number
    }]
  },
  
  // Step 4: Credit Card Setup
  creditCardSetup: {
    skipped: Boolean,
    skippedAt: Date,
    creditCardAccounts: [{
      accountId: ObjectId, // Reference to BankAccount
      connectedAt: Date,
      bankId: String,
      displayName: String
    }]
  },
  
  // Step 5: Credit Card Matching
  creditCardMatching: {
    completed: Boolean,
    completedAt: Date,
    matchedPayments: Number,
    unmatchedPayments: Number,
    coveragePercentage: Number,
    matchedTransactions: [{
      transactionId: ObjectId,
      creditCardId: ObjectId,
      matchedAt: Date
    }]
  },
  
  // Progress tracking
  completedSteps: [String]
}
```

### Transaction.matchedCreditCard Structure

```javascript
{
  creditCardId: ObjectId, // Reference to CreditCard
  displayName: String,
  matchConfidence: Number, // 0-100
  matchedAt: Date
}
```

---

## Events Emitted

### 1. credit-card-detection:completed

Emitted after credit card detection analysis completes.

**Data:**
```javascript
{
  userId: ObjectId,
  analysis: {
    transactionCount: Number,
    recommendation: String,
    sampleTransactions: Array,
    // ... other analysis data
  }
}
```

### 2. credit-card-matching:completed

Emitted after payment matching completes.

**Data:**
```javascript
{
  userId: ObjectId,
  matchingResults: {
    coveredCount: Number,
    uncoveredCount: Number,
    coveragePercentage: Number,
    matchedPayments: Array
  }
}
```

---

## Frontend Integration

### Determining Current UI State

```javascript
async function getOnboardingState() {
  const response = await fetch('/api/onboarding/status', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data } = await response.json();
  
  switch(data.currentStep) {
    case 'checking-account':
      return 'SHOW_CONNECT_CHECKING_ACCOUNT';
      
    case 'transaction-import':
      // Check if still importing
      if (data.transactionImport.scrapingStatus.isActive) {
        return 'SHOW_IMPORT_PROGRESS';
      }
      return 'WAIT_FOR_COMPLETION';
      
    case 'credit-card-detection':
      return 'ANALYZING_TRANSACTIONS';
      
    case 'credit-card-setup':
      // Show detection results
      if (data.creditCardDetection.recommendation === 'connect') {
        return 'SHOW_CREDIT_CARD_RECOMMENDATION';
      }
      return 'SHOW_SKIP_OPTION';
      
    case 'credit-card-matching':
      // Check if still matching
      if (!data.creditCardMatching.completed) {
        return 'SHOW_MATCHING_PROGRESS';
      }
      return 'SHOW_MATCHING_RESULTS';
      
    case 'complete':
      return 'SHOW_COMPLETION';
  }
}
```

### Polling for Status Updates

```javascript
// Poll every 2 seconds while scraping/matching is active
function pollOnboardingStatus() {
  const interval = setInterval(async () => {
    const response = await fetch('/api/onboarding/status');
    const { data } = await response.json();
    
    // Update UI with latest status
    updateUI(data);
    
    // Stop polling when complete
    if (data.isComplete) {
      clearInterval(interval);
    }
  }, 2000);
}
```

---

## Migration

To migrate existing users from the old `onboardingStatus` to the new `onboarding` structure:

```bash
node backend/src/scripts/migrateOnboardingStructure.js
```

This script:
- Maps old fields to new structure
- Finds checking/credit card accounts from database
- Sets appropriate `currentStep` based on completion
- Preserves all historical data

---

## Benefits

✅ **Resume Capability** - Complete state allows resuming at any point  
✅ **Account Tracking** - Knows which specific accounts were added  
✅ **Automatic Progression** - Detection and matching happen automatically  
✅ **Transaction Marking** - Payments marked with their credit card  
✅ **Event-Driven** - Decoupled, reactive architecture  
✅ **Backward Compatible** - Legacy onboardingStatus still updated  
✅ **UI-Friendly** - Single endpoint provides complete state
