# Transaction Productization Roadmap

## Requirements Overview

### Phase 1: Smart Scraping Management
1. **✅ First scraping for new account should be 6 months back** (already implemented)
2. **🔧 Track last successful scraping** - Once passed 1 successful scraping, track the last successful scraping for each account and have the following scraping start date from the latest successful one

### Phase 2: Dashboard Enhancement
3. **📊 Uncategorized transactions visualization** - Add a visualization of the number of uncategorized transactions the user has in their dashboard, with a link to the list of uncategorized transactions

### Phase 3: Transaction Detail View
4. **🎯 Transaction detail view** - Create a new transaction view - when clicking a transaction, display a view that contains the fields of the transaction, with an option to change the category by clicking the category field

## Current State Analysis

### ✅ Already Implemented
- **6 months back scraping**: `BankAccount.scrapingConfig.options.startDate` defaults to 6 months ago
- **Basic transaction management**: Simplified workflow without PendingTransaction complexity
- **Transaction categorization**: AI suggestions + manual categorization
- **Transaction filtering and display**: Complete with date grouping and search
- **Bank account tracking**: `lastScraped` field exists in BankAccount model

### 🔧 Needs Implementation
- **Smart scraping date management**: Use last successful scrape date for subsequent scrapes
- **Dashboard uncategorized widget**: Visual representation and navigation
- **Transaction detail dialog**: Detailed view with inline editing
- **Enhanced user experience**: Better navigation and interaction patterns

## Detailed Implementation Plan

### Phase 1: Smart Scraping Date Management

#### Backend Changes

##### 1.1 Update BankAccount Model
```javascript
// Add to backend/src/models/BankAccount.js
lastSuccessfulScrape: {
  type: Date,
  default: null
},
scrapingStats: {
  totalScrapes: { type: Number, default: 0 },
  successfulScrapes: { type: Number, default: 0 },
  lastSuccessDate: { type: Date, default: null },
  lastFailureDate: { type: Date, default: null }
}
```

##### 1.2 Update BankScraperService
```javascript
// Modify backend/src/services/bankScraperService.js
// Update createScraper method to use smart start date:
// - If lastSuccessfulScrape exists, use it
// - Otherwise, use 6 months back (current default)
```

##### 1.3 Update TransactionService
```javascript
// Modify backend/src/services/transactionService.js
// Update processScrapedTransactions to:
// - Update lastSuccessfulScrape on successful scraping
// - Update scrapingStats
// - Handle error tracking
```

#### Frontend Changes
- Update scraping status display to show last successful scrape date
- Add scraping statistics to bank account details

### Phase 2: Dashboard Enhancement

#### Backend Changes

##### 2.1 New API Endpoint
```javascript
// Add to backend/src/routes/transactions.js
GET /api/transactions/uncategorized-stats
// Returns: { total, byAccount: [{ accountId, name, count }] }
```

##### 2.2 Update TransactionService
```javascript
// Add method: getUncategorizedStats(userId)
// Returns aggregated uncategorized transaction counts
```

#### Frontend Changes

##### 2.1 Dashboard Components
```typescript
// Create components:
// - UncategorizedTransactionsWidget.tsx
// - TransactionStatsCard.tsx
// - QuickActionsPanel.tsx
```

##### 2.2 Dashboard API Integration
```typescript
// Update frontend/src/services/api/transactions.ts
// Add: getUncategorizedStats(): Promise<UncategorizedStats>
```

##### 2.3 Enhanced Dashboard Layout
```typescript
// Update frontend/src/pages/Dashboard.tsx
// Add:
// - Uncategorized transactions widget
// - Quick navigation to filtered transactions
// - Visual indicators (charts/progress bars)
```

### Phase 3: Transaction Detail View

#### Backend Changes
- No new endpoints needed (existing transaction and categorization APIs sufficient)

#### Frontend Changes

##### 3.1 Transaction Detail Components
```typescript
// Create new components:
// - TransactionDetailDialog.tsx
// - CategoryEditField.tsx  
// - TransactionFieldDisplay.tsx
```

##### 3.2 Update Transaction List
```typescript
// Modify components:
// - TransactionRow.tsx (add click handler)
// - TransactionsList.tsx (integrate dialog)
```

##### 3.3 Transaction Detail Features
- **Full transaction data display**: All fields in organized layout
- **Inline category editing**: Dropdown with search, AI suggestions
- **Save/Cancel functionality**: Optimistic updates with rollback
- **Keyboard navigation**: Tab through fields, ESC to close
- **Mobile responsive**: Touch-friendly design

## Technical Implementation Details

### Database Schema Updates

#### BankAccount Model Enhancement
```javascript
// Additional fields needed:
{
  lastSuccessfulScrape: Date,
  scrapingStats: {
    totalScrapes: Number,
    successfulScrapes: Number,
    lastSuccessDate: Date,
    lastFailureDate: Date,
    averageTransactionsPerScrape: Number
  }
}
```

### API Endpoints

#### New Endpoints
```javascript
// GET /api/transactions/uncategorized-stats
// Response: { total: number, byAccount: Array<{accountId, name, count}> }

// GET /api/transactions/stats  
// Response: { categorized: number, uncategorized: number, total: number }
```

### Frontend Components Architecture

#### Dashboard Enhancement
```
Dashboard/
├── UncategorizedTransactionsWidget/
│   ├── TransactionStatsCard.tsx
│   ├── AccountBreakdown.tsx
│   └── QuickActions.tsx
├── OverviewCards/
└── RecentActivity/
```

#### Transaction Detail View
```
TransactionDetail/
├── TransactionDetailDialog.tsx
├── TransactionHeader.tsx
├── TransactionFields/
│   ├── CategoryEditField.tsx
│   ├── AmountDisplay.tsx
│   ├── DateDisplay.tsx
│   └── RawDataAccordion.tsx
└── ActionButtons.tsx
```

## Testing Strategy

### Backend Testing
- **Unit tests**: Smart scraping date logic
- **Integration tests**: Scraping workflow with date tracking
- **API tests**: New uncategorized stats endpoint
- **Service tests**: Updated transaction processing

### Frontend Testing
- **Component tests**: New dashboard widgets and transaction detail dialog
- **Integration tests**: Complete user workflows
- **E2E tests**: Dashboard → uncategorized → transaction detail → categorization
- **Responsive tests**: Mobile and desktop layouts

### User Acceptance Testing
- **Scenario 1**: New user onboarding → first scrape → 6 months data
- **Scenario 2**: Existing user → subsequent scrape → incremental data
- **Scenario 3**: Dashboard usage → uncategorized widget → quick navigation
- **Scenario 4**: Transaction detail → category editing → save changes

## Implementation Timeline

### Phase 1: Smart Scraping (Week 1)
- Day 1-2: Backend model and service updates
- Day 3-4: Testing and validation
- Day 5: Frontend integration and UI updates

### Phase 2: Dashboard Enhancement (Week 2) 
- Day 1-2: Backend API development
- Day 3-4: Frontend dashboard components
- Day 5: Integration and testing

### Phase 3: Transaction Detail View (Week 2-3)
- Day 1-3: Transaction detail dialog development
- Day 4-5: Category editing functionality
- Day 6-7: Testing and polish

## Dependencies & Prerequisites

### Technical Dependencies
- ✅ Simplified transaction workflow (completed)
- ✅ AI categorization system (existing)
- ✅ Transaction filtering (existing)
- ✅ Category management (existing)

### Feature Dependencies
1. **Smart scraping** → Enables accurate dashboard stats
2. **Dashboard enhancement** → Provides navigation to transaction details
3. **Transaction detail view** → Completes the user workflow

## Success Metrics

### Technical Metrics
- **Scraping efficiency**: Reduced data transfer by using incremental dates
- **User engagement**: Increased dashboard usage and transaction categorization
- **System performance**: Faster transaction processing and display

### User Experience Metrics
- **Time to categorize**: Reduced through improved workflow
- **User satisfaction**: Better transaction management experience
- **Feature adoption**: Usage of new dashboard widgets and detail views

## Risk Mitigation

### Technical Risks
- **Data consistency**: Ensure scraping date tracking is bulletproof
- **Performance**: Dashboard widgets must load quickly
- **Mobile compatibility**: Transaction detail view must work on all devices

### User Experience Risks
- **Complexity**: Keep new features intuitive and discoverable
- **Regression**: Ensure existing functionality isn't broken
- **Accessibility**: Maintain keyboard navigation and screen reader support

## Future Enhancements

### Potential Phase 4 Features
- **Bulk categorization**: Select multiple transactions for batch operations
- **Category rules**: Automatic categorization based on user-defined rules
- **Spending insights**: Advanced analytics and budgeting features
- **Export functionality**: CSV/PDF export of transaction data
- **Transaction splitting**: Split single transactions into multiple categories

---

*Last Updated: January 12, 2025*
*Status: Planning Phase - Ready for Implementation*
