# GeriFinancial Onboarding System - Technical Architecture

## Overview
This document provides a comprehensive technical overview of the onboarding system implementation, detailing the flow through pages, components, routes, backend services, and data layer.

## System Architecture Diagram
```
Frontend                     Backend                    Database
--------                     -------                    --------
Pages                        Routes                     Models
├─ Onboarding.tsx           ├─ /users                  ├─ User
Components                  ├─ /onboarding             ├─ BankAccount
├─ OnboardingGuard          Services                   ├─ CreditCard
├─ OnboardingChat           ├─ BankClassification      ├─ Transaction
│  ├─ script.ts             ├─ CreditCardDetection     ├─ Category
│  ├─ MessageBubble         ├─ CreditCardOnboarding    └─ ...
│  └─ cards/                └─ ...
│     ├─ CheckingAccountCard
│     ├─ ImportProgressCard
│     ├─ CreditCardChoiceCard
│     ├─ CreditCardFormCard
│     ├─ MatchingReviewCard
│     └─ CompleteCard
```

---

## 1. Frontend Layer

### 1.1 Pages

#### `frontend/src/pages/Onboarding.tsx`
**Purpose**: Main onboarding page container
**Responsibilities**:
- Renders the OnboardingChat component
- Provides page-level layout and styling
- Handles page title and meta information

**Technical Details**:
```typescript
const OnboardingPage: React.FC = () => {
  return (
    <Container maxWidth="sm">
      <OnboardingChat />
    </Container>
  );
};
```

### 1.2 Components

#### `frontend/src/components/auth/OnboardingGuard.tsx`
**Purpose**: Route protection and redirection logic
**Responsibilities**:
- Check user's onboarding status via API
- Redirect users to/from onboarding based on completion status
- Show loading states during status checks
- Handle routing edge cases

**Key Functions**:
- `checkOnboardingStatus()` - Calls `/users/onboarding-status`
- Redirects completed users away from /onboarding
- Redirects incomplete users to /onboarding

**Data Flow**:
```
OnboardingGuard → onboardingApi.getStatus() → Backend /users/onboarding-status
```

#### `frontend/src/components/onboarding/chat/OnboardingChat.tsx`
**Purpose**: Main orchestrator component for the onboarding flow
**Responsibilities**:
- Renders the conversation and the card currently being asked for
- Manages overall onboarding state via the useOnboarding hook
- Displays the progress indicator and the typing indicator
- Handles error states and loading states

**Presentation**: the flow is a **scripted conversation, not a generated one**.
No language model is involved at any point. The chat is a deterministic state
machine rendered as dialogue, which is what allows it to handle bank
credentials: nothing the user types is ever sent anywhere except the existing
onboarding endpoints.

**Input is structured only** - there is no free-text box. Every answer comes
from a field card or a quick-reply button, so the flow cannot receive input it
has no way to interpret.

**Step Flow** (unchanged - the server still owns it):
```
checking-account → transaction-import → credit-card-detection → credit-card-setup → complete
```

#### `frontend/src/components/onboarding/chat/script.ts`
**Purpose**: Turns the server's onboarding state into a transcript
**Responsibilities**:
- `buildScript(status)` is a pure function of `OnboardingStatus`
- Emits assistant lines, echoes of the user's answers, and card requests
- Reports whether the next move belongs to the server (`waiting`)

**The transcript is derived, never stored.** Two properties follow, and both
are the reason it is built this way:
- Reloading mid-setup rebuilds the same conversation, because the state it is
  drawn from is the same state that decides what happens next. A stored
  transcript could disagree with actual progress; a derived one cannot.
- Its only raw material is `/onboarding/status`, which carries no credentials.
  The bubble echoing the user's answer *physically cannot* show a password,
  rather than relying on remembering to mask one.

Message ids are stable and semantic (`greet`, `answer-checking`,
`card:checking-account`) rather than positional, so a message keeps its
identity as the conversation grows.

Every section of the status document is read defensively - a partial payload
must not take down the first page a new user sees.

#### `frontend/src/components/onboarding/chat/cards/CheckingAccountCard.tsx`
**Purpose**: Step 1 - Primary bank account connection
**Responsibilities**:
- Display only checking banks (filtered by BankClassificationService)
- Handle bank selection and account setup
- Validate account connectivity

**Bank Selection Logic**:
- Shows only: Hapoalim, Leumi, Discount, Otsar HaHayal
- Filters out credit card providers

#### `frontend/src/components/onboarding/chat/cards/ImportProgressCard.tsx`
**Purpose**: Step 2 - Transaction import with real-time progress
**Responsibilities**:
- Report on the scrape already in flight (it starts when the account is
  saved, not when this card appears)
- Display real-time import progress (connecting → scraping → categorizing)
- Surface scrape failures

**Progress**: driven by `transactionImport.scrapingStatus`, refreshed over SSE.

#### `frontend/src/components/onboarding/chat/cards/CreditCardChoiceCard.tsx`
**Purpose**: Step 3 - Acting on the credit card usage analysis
**Responsibilities**:
- Show sample transactions behind the recommendation
- Offer "connect" or "skip" as quick replies

**Decision Logic**:
- If ANY unmatched credit card transactions found → Recommend "Connect"
- If no credit card transactions found → Recommend "Skip"

#### `frontend/src/components/onboarding/chat/cards/CreditCardFormCard.tsx`
**Purpose**: Step 4 - Credit card provider connection
**Responsibilities**:
- Show only credit card providers (Visa Cal, Max, Isracard)
- Handle credit card account setup
- Optional step (can be skipped)

#### `frontend/src/components/onboarding/chat/cards/MatchingReviewCard.tsx`
**Purpose**: Step 5 - Reviewing card-to-payment coverage
**Responsibilities**:
- Report how many credit card payments were matched to a connected card
- Offer adding another card, or finishing anyway (partial coverage is normal)

#### `frontend/src/components/onboarding/chat/cards/CompleteCard.tsx`
**Purpose**: Step 6 - Completion summary and next steps
**Responsibilities**:
- Display success message and summary
- Show onboarding statistics
- Send the user on to the dashboard

### 1.3 Hooks

#### `frontend/src/hooks/useOnboarding.ts`
**Purpose**: Custom hook for onboarding state management
**Responsibilities**:
- Encapsulate onboarding state logic
- Provide clean API for components
- Handle backend synchronization
- Manage loading and error states

**Key Functions**:
```typescript
const {
  completedSteps,      // Set<string> of completed step IDs
  onboardingData,      // Object with step data
  loading,             // Boolean loading state
  error,               // String error message
  updateOnboardingStatus,  // Function to update backend
  loadOnboardingStatus,    // Function to load from backend
  clearError              // Function to clear errors
} = useOnboarding();
```

**State Management**:
- Manages `completedSteps` as Set for efficient lookups
- Stores step data in `onboardingData` object
- Synchronizes with backend via API calls

### 1.4 API Services

#### `frontend/src/services/api/onboarding.ts`
**Purpose**: API service layer for onboarding operations
**Responsibilities**:
- Abstract API calls from components
- Provide typed interfaces for all onboarding operations
- Handle request/response transformations
- Centralize error handling

**API Methods**:
```typescript
onboardingApi = {
  getStatus(): Promise<OnboardingStatus>
  updateStatus(data: UpdateOnboardingStatusDto): Promise<OnboardingStatus>
  analyzeCreditCards(monthsBack: number): Promise<CreditCardAnalysis>
  createCreditCards(bankAccountId: string, accounts: any[]): Promise<CreditCardCreationResult>
}
```

### 1.5 Routing Integration

#### `frontend/src/App.tsx`
**Routing Structure**:
```typescript
<Router>
  <OnboardingGuard>
    <Routes>
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute>...</ProtectedRoute>} />
    </Routes>
  </OnboardingGuard>
</Router>
```

**Key Points**:
- OnboardingGuard is inside Router to access useLocation()
- /onboarding route is protected with ProtectedRoute
- All other routes are also protected

---

## 2. Backend Layer

### 2.1 Routes

#### `backend/src/routes/users.js`
**Endpoints**:
- `GET /api/users/onboarding-status` - Get user's onboarding status
- `POST /api/users/onboarding-status` - Update user's onboarding status

**Request/Response**:
```javascript
// GET Response
{
  isComplete: boolean,
  hasCheckingAccount: boolean,
  completedSteps: string[],
  hasCreditCards?: boolean,
  creditCardAnalysisResults?: {
    transactionCount: number,
    recommendation: string,
    analyzedAt: string
  }
}

// POST Request Body
{
  isComplete: boolean,
  completedSteps: string[],
  hasCheckingAccount: boolean,
  hasCreditCards?: boolean,
  creditCardAnalysisResults?: {
    transactionCount: number,
    recommendation: string,
    analyzedAt: Date
  }
}
```

#### `backend/src/routes/onboarding.js`
**Endpoints**:
- `POST /api/onboarding/analyze-credit-cards` - Analyze credit card usage
- `POST /api/onboarding/create-credit-cards` - Create credit cards from scraped accounts

**Request/Response Examples**:
```javascript
// POST /analyze-credit-cards
Request: { monthsBack: 6 }
Response: {
  success: boolean,
  data: {
    hasCreditCardActivity: boolean,
    transactionCount: number,
    recommendation: 'connect' | 'skip',
    monthlyBreakdown: [...],
    sampleTransactions: [...],
    analyzedAt: string
  }
}

// POST /create-credit-cards
Request: {
  bankAccountId: string,
  scrapedAccounts: [...]
}
Response: {
  success: boolean,
  data: {
    creditCards: [...],
    matchingResults: {
      totalCreditCards: number,
      matchedCards: number,
      matchingAccuracy: number
    }
  }
}
```

### 2.2 Services

#### `backend/src/services/bankClassificationService.js`
**Purpose**: Classify banks into checking accounts vs credit card providers
**Key Methods**:
```javascript
getCheckingBanks()           // Returns ['hapoalim', 'leumi', 'discount', 'otsarHahayal']
getCreditCardProviders()     // Returns ['visaCal', 'max', 'isracard']
isCheckingBank(bankId)       // Boolean check
isCreditCardProvider(bankId) // Boolean check
getBankType(bankId)          // Returns 'checking' | 'credit' | null
```

**Business Logic**:
- Separates checking banks from credit card providers
- Provides utility methods for bank type identification
- Used by frontend to filter bank/provider lists

#### `backend/src/services/creditCardDetectionService.js`
**Purpose**: AI-powered credit card transaction analysis
**Key Methods**:
```javascript
analyzeCreditCardUsage(userId, monthsBack = 6)  // Main analysis method
generateRecommendation(transactionData)        // Simplified recommendation logic
hasCreditCardTransactions(userId)              // Quick boolean check
getCreditCardStats(userId)                     // Dashboard stats
```

**Analysis Process**:
1. Query transactions for user in date range
2. Use MongoDB aggregation pipeline to find credit card transactions
3. Leverage existing AI categorization (Category: "Credit Card", Type: "Transfer")
4. Generate monthly breakdown and statistics
5. Apply simplified recommendation logic

**Recommendation Logic** (Simplified):
```javascript
generateRecommendation(transactionData) {
  // If we found even 1 credit card transaction that we couldn't match, recommend connecting
  if (transactionData && transactionData.count > 0) {
    return 'connect';
  }
  return 'skip';
}
```

#### `backend/src/services/creditCardOnboardingService.js`
**Purpose**: Auto-create credit card accounts from scraped data
**Key Methods**:
```javascript
createCreditCardsFromScrapedAccounts(userId, bankAccountId, scrapedAccounts)
matchScrapedAccountToCreditCard(scrapedAccount)
generateCreditCardDisplayName(scrapedAccount)
```

**Process Flow**:
1. Receive scraped account data from bank
2. Filter for credit card accounts
3. Match to existing credit card providers
4. Create CreditCard model instances
5. Return creation results with matching statistics

### 2.3 Data Models

#### `backend/src/models/User.js`
**Onboarding Fields Added**:
```javascript
{
  // ... existing user fields
  onboardingStatus: {
    isComplete: { type: Boolean, default: false },
    hasCheckingAccount: { type: Boolean, default: false },
    completedSteps: [{ type: String }],
    hasCreditCards: { type: Boolean, default: false },
    creditCardAnalysisResults: {
      transactionCount: Number,
      recommendation: String,
      analyzedAt: Date
    }
  }
}
```

#### Associated Models:
- **BankAccount**: Stores checking account information
- **CreditCard**: Stores credit card account information  
- **Transaction**: Contains transaction data with AI categorization
- **Category**: Contains categorization data (used for credit card detection)

---

## 3. Data Flow

### 3.1 Complete Onboarding Flow

```
1. User Authentication
   ├─ User logs in
   ├─ OnboardingGuard checks status
   └─ Redirects to /onboarding if incomplete

2. Step 1: Checking Account Setup
   ├─ CheckingAccountCard renders checking banks only
   ├─ User selects bank and connects account
   ├─ Creates BankAccount model
   └─ Updates User.onboardingStatus.completedSteps

3. Step 2: Transaction Import
   ├─ ImportProgressCard reports on the scrape already in flight
   ├─ Shows real-time progress updates over SSE
   ├─ Imports transactions and runs AI categorization
   └─ Creates Transaction models with Category links

4. Step 3: Credit Card Detection
   ├─ CreditCardChoiceCard presents the analyze-credit-cards result
   ├─ Backend queries Transaction + Category models
   ├─ Finds unmatched credit card transactions
   ├─ Applies simplified recommendation logic
   └─ Returns recommendation to frontend

5. Step 4: Credit Card Setup (Optional)
   ├─ If recommended, CreditCardFormCard shows credit card providers
   ├─ User connects credit card accounts
   ├─ Backend creates CreditCard models
   └─ Updates User.onboardingStatus.hasCreditCards

6. Step 5: Completion
   ├─ CompleteCard shows success message
   ├─ Updates User.onboardingStatus.isComplete = true
   ├─ OnboardingGuard redirects to main app
   └─ User can access full application
```

### 3.2 API Call Chain

```
Frontend Component → Custom Hook → API Service → Backend Route → Backend Service → Database Model

Example: Credit Card Analysis
CreditCardChoiceCard → useOnboarding → onboardingApi → /analyze-credit-cards → creditCardDetectionService → Transaction + Category models
```

### 3.3 State Management Flow

```
1. Local Component State (useState)
   ├─ UI-specific state (loading, form data, etc.)
   
2. Custom Hook State (useOnboarding)
   ├─ Onboarding-specific state
   ├─ Synchronizes with backend
   
3. Backend State (Database)
   ├─ Persistent onboarding status
   ├─ User progress tracking
   
4. State Synchronization
   ├─ Hook updates backend on step completion
   ├─ Backend returns updated state
   ├─ Hook updates local state
   └─ Components re-render with new state
```

---

## 4. Technical Highlights

### 4.1 Code Quality Achievements
- **Zero ESLint warnings** across entire codebase
- **Perfect React Hook dependencies** with useCallback and functional state updates
- **Comprehensive TypeScript coverage** with strict type checking
- **Clean architecture** with proper separation of concerns

### 4.2 Performance Optimizations
- **Memoized callbacks** to prevent unnecessary re-renders
- **Functional state updates** to avoid stale closures
- **Efficient database queries** using MongoDB aggregation pipelines
- **Strategic API caching** for onboarding status checks

### 4.3 Error Handling
- **Comprehensive error boundaries** in frontend components
- **Graceful API failure handling** with user-friendly messages
- **Fallback states** for all loading and error conditions
- **Backend error logging** with detailed error context

### 4.4 Testing Strategy
- **Unit tests** for all backend services
- **Component testing structure** for frontend components
- **API endpoint testing** for all routes
- **Integration test scenarios** for complete flows

---

## 5. Business Logic Summary

### 5.1 Simplified Credit Card Logic
**Problem**: Previous logic was too complex with multiple thresholds
**Solution**: Simple binary decision
- Found ANY unmatched credit card transactions? → Recommend connecting
- Found no credit card transactions? → Skip credit card setup

### 5.2 User Experience Flow
1. **Quick Bank Connection** (4 banks only)
2. **Automated Import** with real-time progress
3. **Smart Recommendation** based on actual transaction data
4. **Optional Credit Card Setup** (3 providers only)
5. **Celebration & Guidance** for next steps

### 5.3 Technical Excellence
- **Production-ready code** with zero technical debt
- **Maintainable architecture** following React/Node.js best practices
- **Scalable design** that supports future enhancements
- **Developer-friendly** with clear separation of concerns

---

This technical architecture provides a comprehensive understanding of the onboarding system implementation, from frontend components through backend services to database models, ensuring clarity on how all pieces work together to create a seamless user experience.
