# Budget Feature Implementation Roadmap

## 🎯 **Project Overview**

**Objective**: Implement a comprehensive budget management system with monthly, yearly, and project budgets, including transaction tagging and smart allocation features.

**Status**: 📋 **Planning Phase** | **Started**: January 17, 2025

---

## 📊 **Feature Requirements Summary**

### **Budget Types**
1. **Monthly Budget** - Based on monthly income/expenses with recurring transaction patterns
2. **Yearly Budget** - Accumulation view with one-time events (renovations, bonuses)
3. **Project Budget** - Specific purpose with defined timeframe and multiple funding sources

### **Core Features**
1. **Sub-category Level Budgeting** - Monthly budgets at sub-category granularity for expenses
2. **Smart Transaction Association** - Auto-assign with flexible timing (10-15 day grace periods)
3. **Transaction Tagging System** - Multi-tag support for projects and custom organization
4. **Auto-calculated Budgets** - Generate monthly budgets from historical transaction averages
5. **Credit Card Management** - New entity for card-specific timing configurations
6. **Multiple Funding Sources** - Projects can have mixed funding (loans, bonuses, savings, ongoing funds)

---

## 🗓️ **Implementation Phases**

### **Phase 1: Foundation & Data Migration** ✅
**Timeline**: Week 1-2 | **Priority**: Critical | **Status**: COMPLETED

#### 1.1 Date Field Migration ✅
- **Completed**: Updated Transaction model with new date structure
- **syncedDate**: Renamed from current processedDate (when we pulled data)
- **processedDate**: New required field (when money actually moved)
- **Migration Script**: Created `migrateDateFields.js` with rollback support

#### 1.2 Credit Card Model ✅
- **Completed**: `backend/src/models/CreditCard.js`
- **Features**: Timing flexibility configuration, allocation month calculation
- **Integration**: Connected to BankAccount and User models
- **Methods**: findOrCreate, getUserActiveCards, updateTimingConfig

#### 1.3 Transaction Tagging System ✅
- **Completed**: Enhanced Transaction model with ObjectId-based tags
- **Tag Entity**: Created `backend/src/models/Tag.js` for efficient queries
- **Project Support**: Tags can have project metadata (timeline, status, description)
- **Helper Methods**: addTags, removeTags, hasTag, findByTag, getSpendingSummaryByTag
- **Test Coverage**: Comprehensive Tag model tests (13 test cases)

**Key Changes Made:**
- Transaction model: Added `tags: [ObjectId]`, `syncedDate`, updated `processedDate`
- Tag model: Full entity with project metadata and usage tracking
- CreditCard model: Timing configuration for flexible budget allocation
- Migration script: Safe data migration with progress tracking and rollback
- Updated model exports and comprehensive test coverage

---

### **Phase 2: Budget Core Models & Services**
**Timeline**: Week 3-4 | **Priority**: High

#### 2.1 Budget Models

##### Monthly Budget Model
```javascript
// New Model: backend/src/models/MonthlyBudget.js
{
  userId: ObjectId,
  year: Number,
  month: Number, // 1-12
  currency: String,
  
  // Income budgets
  salaryBudget: Number,
  otherIncomeBudgets: [{
    categoryId: ObjectId,
    amount: Number
  }],
  
  // Expense budgets (sub-category level)
  expenseBudgets: [{
    categoryId: ObjectId,
    subCategoryId: ObjectId,
    budgetedAmount: Number,
    actualAmount: Number, // Calculated from transactions
  }],
  
  // Metadata
  isAutoCalculated: Boolean,
  lastCalculated: Date,
  notes: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

##### Yearly Budget Model
```javascript
// New Model: backend/src/models/YearlyBudget.js
{
  userId: ObjectId,
  year: Number,
  currency: String,
  
  // Derived from monthly budgets + one-time items
  totalIncome: Number,
  totalExpenses: Number,
  
  // One-time items
  oneTimeIncome: [{
    description: String,
    amount: Number,
    expectedDate: Date,
    actualDate: Date,
    categoryId: ObjectId
  }],
  
  oneTimeExpenses: [{
    description: String,
    amount: Number,
    expectedDate: Date,
    actualDate: Date,
    categoryId: ObjectId,
    subCategoryId: ObjectId
  }],
  
  // Project references
  projectBudgets: [ObjectId], // References to project budgets
  
  createdAt: Date,
  updatedAt: Date
}
```

##### Project Budget Model
```javascript
// New Model: backend/src/models/ProjectBudget.js
{
  userId: ObjectId,
  name: String,
  description: String,
  
  // Timeline
  startDate: Date,
  endDate: Date,
  status: String, // 'planning', 'active', 'completed', 'cancelled'
  
  // Funding sources
  fundingSources: [{
    type: String, // 'ongoing_funds', 'loan', 'bonus', 'savings', 'other'
    description: String,
    expectedAmount: Number,
    availableAmount: Number, // Current available
    limit: Number, // Optional spending limit for this source
  }],
  
  // Budget breakdown
  categoryBudgets: [{
    categoryId: ObjectId,
    subCategoryId: ObjectId,
    budgetedAmount: Number,
    actualAmount: Number, // Calculated from tagged transactions
  }],
  
  // Totals
  totalBudget: Number,
  totalSpent: Number, // Calculated from tagged transactions
  
  // Settings
  impactsOtherBudgets: Boolean, // If funded by ongoing_funds
  autoTag: String, // Auto-generated tag for this project
  
  createdAt: Date,
  updatedAt: Date
}
```

#### 2.2 Budget Services

##### Budget Service
```javascript
// New Service: backend/src/services/budgetService.js
class BudgetService {
  // Monthly Budget Operations
  async createMonthlyBudget(userId, year, month, budgetData)
  async getMonthlyBudget(userId, year, month)
  async updateMonthlyBudget(budgetId, updates)
  async calculateMonthlyBudgetFromHistory(userId, year, month, monthsToAnalyze = 6)
  
  // Yearly Budget Operations
  async createYearlyBudget(userId, year, budgetData)
  async getYearlyBudget(userId, year)
  async updateYearlyBudget(budgetId, updates)
  
  // Project Budget Operations
  async createProjectBudget(userId, projectData)
  async getProjectBudget(projectId)
  async updateProjectBudget(projectId, updates)
  async deleteProjectBudget(projectId)
  
  // Budget Analysis
  async getBudgetVsActual(userId, type, period)
  async getBudgetSummary(userId, year, month)
  async getProjectProgress(projectId)
}
```

---

### **Phase 3: API Endpoints & Integration**
**Timeline**: Week 5-6 | **Priority**: High

#### 3.1 Budget API Routes

##### Monthly Budget Endpoints
```javascript
// backend/src/routes/budgets.js
GET    /api/budgets/monthly/:year/:month     // Get monthly budget
POST   /api/budgets/monthly                  // Create monthly budget
PUT    /api/budgets/monthly/:id              // Update monthly budget
POST   /api/budgets/monthly/calculate        // Auto-calculate from history
GET    /api/budgets/monthly/:year/:month/actual // Get actual vs budget
```

##### Yearly Budget Endpoints
```javascript
GET    /api/budgets/yearly/:year             // Get yearly budget
POST   /api/budgets/yearly                   // Create yearly budget
PUT    /api/budgets/yearly/:id               // Update yearly budget
```

##### Project Budget Endpoints
```javascript
GET    /api/budgets/projects                 // List user's project budgets
POST   /api/budgets/projects                 // Create project budget
GET    /api/budgets/projects/:id             // Get project budget details
PUT    /api/budgets/projects/:id             // Update project budget
DELETE /api/budgets/projects/:id             // Delete project budget
GET    /api/budgets/projects/:id/progress    // Get project progress
```

#### 3.2 Transaction Integration Updates

##### Updated Transaction Service
```javascript
// Update: backend/src/services/transactionService.js
class TransactionService {
  // ... existing methods
  
  // New tagging methods
  async addTagsToTransaction(transactionId, tags, userId)
  async removeTagsFromTransaction(transactionId, tags, userId)
  async getTransactionsByTag(tag, userId)
  async getTransactionsByProject(projectId, userId)
  
  // Budget allocation methods
  async allocateTransactionToBudget(transactionId, budgetType, budgetId)
  async getMonthlyBudgetActuals(userId, year, month)
  async getProjectBudgetActuals(projectId)
}
```

---

### **Phase 4: Frontend Components & UI**
**Timeline**: Week 7-9 | **Priority**: High

#### 4.1 Budget Management Components

##### Budget Dashboard
```typescript
// frontend/src/components/budget/BudgetDashboard.tsx
interface BudgetDashboardProps {
  userId: string;
}

// Features:
// - Monthly budget overview with progress bars
// - Yearly budget summary
// - Active projects status
// - Quick actions (create budget, new project)
```

##### Monthly Budget Manager
```typescript
// frontend/src/components/budget/MonthlyBudgetManager.tsx
interface MonthlyBudgetManagerProps {
  year: number;
  month: number;
  onBudgetUpdate: (budget: MonthlyBudget) => void;
}

// Features:
// - Sub-category budget allocation
// - Auto-calculate from history
// - Budget vs actual comparison
// - Flexible timing configuration
```

##### Project Budget Manager
```typescript
// frontend/src/components/budget/ProjectBudgetManager.tsx
interface ProjectBudgetManagerProps {
  project?: ProjectBudget;
  isEditing?: boolean;
  onSave: (project: ProjectBudget) => void;
}

// Features:
// - Multiple funding sources setup
// - Category budget allocation
// - Timeline management
// - Progress tracking
```

#### 4.2 Transaction Tagging Integration

##### Enhanced Transaction Detail Dialog
```typescript
// Update: frontend/src/components/transactions/TransactionDetailDialog.tsx
// Add tagging section:
// - Display current tags
// - Inline tag creation
// - Project association
// - Quick tag suggestions
```

##### Tag Management Component
```typescript
// frontend/src/components/budget/TagManager.tsx
// Features:
// - View all user tags
// - Bulk tag operations
// - Tag usage analytics
// - Tag merging/renaming
```

---

### **Phase 5: Smart Allocation & Advanced Features**
**Timeline**: Week 10-12 | **Priority**: Medium

#### 5.1 Smart Monthly Allocation

##### Flexible Timing Service
```javascript
// New Service: backend/src/services/timingAllocationService.js
class TimingAllocationService {
  async allocateTransactionToMonth(transaction, creditCardConfig, incomeConfig)
  async configureCreditCardTiming(cardId, gracePeriodDays, cutoffDay)
  async configureIncomeTiming(categoryId, gracePeriodDays)
  async getMonthlyAllocationSuggestions(userId, year, month)
}
```

#### 5.2 Budget Analytics

##### Analytics Service
```javascript
// New Service: backend/src/services/budgetAnalyticsService.js
class BudgetAnalyticsService {
  async getBudgetTrends(userId, timeframe)
  async getSpendingPatterns(userId, categoryId, timeframe)
  async getBudgetVarianceAnalysis(userId, year, month)
  async getProjectROI(projectId)
  async getBudgetRecommendations(userId)
}
```

---

## 🗄️ **Database Schema Changes**

### **New Collections**
1. **credit_cards** - Credit card entities with timing configuration
2. **monthly_budgets** - Monthly budget allocations at sub-category level
3. **yearly_budgets** - Yearly budget with one-time items
4. **project_budgets** - Project budgets with multiple funding sources

### **Updated Collections**

#### Transactions Collection
```javascript
// Add new fields to existing transaction schema
{
  // ... existing fields
  syncedDate: Date, // Renamed from processedDate
  processedDate: Date, // When money actually moved (from rawData)
  tags: [String], // User-defined tags
  projectId: ObjectId, // Optional project reference
}
```

#### BankAccounts Collection
```javascript
// Add credit card references
{
  // ... existing fields
  creditCards: [ObjectId], // References to associated credit cards
}
```

### **Indexes**
```javascript
// Monthly Budgets
db.monthly_budgets.createIndex({ "userId": 1, "year": 1, "month": 1 }, { unique: true })

// Yearly Budgets
db.yearly_budgets.createIndex({ "userId": 1, "year": 1 }, { unique: true })

// Project Budgets
db.project_budgets.createIndex({ "userId": 1, "status": 1 })
db.project_budgets.createIndex({ "autoTag": 1 })

// Transactions (updated)
db.transactions.createIndex({ "tags": 1 })
db.transactions.createIndex({ "projectId": 1 })
db.transactions.createIndex({ "processedDate": 1 })
```

---

## 🔧 **Migration Strategy**

### **Data Migration Scripts**

#### 1. processedDate Migration
```javascript
// backend/src/scripts/migrateDateFields.js
async function migrateDateFields() {
  const transactions = await Transaction.find({});
  
  for (const transaction of transactions) {
    const updates = {};
    
    // Rename processedDate to syncedDate
    if (transaction.processedDate) {
      updates.syncedDate = transaction.processedDate;
    }
    
    // Extract processedDate from rawData
    if (transaction.rawData && transaction.rawData.processedDate) {
      updates.processedDate = new Date(transaction.rawData.processedDate);
    } else {
      // Fallback to transaction date if not available
      updates.processedDate = transaction.date;
    }
    
    // Initialize empty tags array
    updates.tags = [];
    
    await Transaction.updateOne({ _id: transaction._id }, { $set: updates });
  }
}
```

#### 2. Credit Card Extraction
```javascript
// backend/src/scripts/extractCreditCards.js
async function extractCreditCards() {
  const bankAccounts = await BankAccount.find({});
  
  for (const account of bankAccounts) {
    // Check if this is a credit card account (from israeli-bank-scrapers)
    if (isCreditCardAccount(account)) {
      const creditCard = new CreditCard({
        userId: account.userId,
        bankAccountId: account._id,
        cardNumber: account.accountNumber, // Display name from scraper
        displayName: account.name || account.accountNumber,
        timingFlexibility: {
          gracePeriodDays: 15, // Default for credit cards
          cutoffDay: 1 // Default
        },
        isActive: true
      });
      
      await creditCard.save();
      
      // Update bank account reference
      await BankAccount.updateOne(
        { _id: account._id },
        { $push: { creditCards: creditCard._id } }
      );
    }
  }
}
```

---

## 🎨 **Frontend Architecture**

### **New Pages**
1. **Budget Dashboard** (`/budgets`) - Main budget overview
2. **Monthly Budget** (`/budgets/monthly/:year/:month`) - Monthly budget management
3. **Project Budgets** (`/budgets/projects`) - Project budget list and management
4. **Budget Analytics** (`/budgets/analytics`) - Budget insights and reports

### **Updated Components**
1. **TransactionDetailDialog** - Add tagging interface
2. **Dashboard** - Add budget summary widgets
3. **Navigation** - Add budget menu items

### **New Contexts**
```typescript
// frontend/src/contexts/BudgetContext.tsx
interface BudgetContextType {
  currentMonthlyBudget: MonthlyBudget | null;
  projectBudgets: ProjectBudget[];
  budgetSummary: BudgetSummary | null;
  refreshBudgets: () => Promise<void>;
  createMonthlyBudget: (data: CreateMonthlyBudgetData) => Promise<MonthlyBudget>;
  createProjectBudget: (data: CreateProjectBudgetData) => Promise<ProjectBudget>;
}
```

---

## 🧪 **Testing Strategy**

### **Backend Testing**

#### Unit Tests
- **Budget Service Tests** - All CRUD operations and calculations
- **Migration Script Tests** - Data integrity verification
- **Timing Allocation Tests** - Smart allocation logic
- **Model Validation Tests** - Schema validation and constraints

#### Integration Tests
- **Budget API Tests** - Complete API workflow testing
- **Transaction Integration Tests** - Tagging and allocation flows
- **Cross-Budget Impact Tests** - Project budget effects on monthly/yearly

### **Frontend Testing**

#### Component Tests
- **Budget Component Tests** - All budget management components
- **Tagging Interface Tests** - Transaction tagging functionality
- **Budget Dashboard Tests** - Data visualization and interactions

#### E2E Tests
- **Budget Creation Flow** - Complete budget setup process
- **Transaction Tagging Flow** - Tag assignment and project allocation
- **Budget vs Actual Flow** - Progress tracking and analysis

### **Data Migration Testing**
- **Pre-migration Backup** - Full database backup before migration
- **Migration Validation** - Verify data integrity post-migration
- **Rollback Testing** - Ensure rollback capabilities

---

## 📅 **Implementation Timeline**

### **Sprint 1: Foundation (Weeks 1-2)**
- Data migration scripts (processedDate, syncedDate)
- Credit Card model and extraction
- Transaction tagging system
- Basic tagging UI in transaction detail dialog

### **Sprint 2: Core Models (Weeks 3-4)**
- Monthly Budget model and service
- Yearly Budget model and service
- Project Budget model and service
- Basic API endpoints

### **Sprint 3: API Integration (Weeks 5-6)**
- Complete API implementation
- Transaction integration updates
- Budget calculation services
- API testing

### **Sprint 4: Frontend Core (Weeks 7-8)**
- Budget Dashboard page
- Monthly Budget Manager component
- Project Budget Manager component
- Budget navigation and routing

### **Sprint 5: Frontend Polish (Week 9)**
- Enhanced tagging interface
- Budget visualization components
- Progress tracking displays
- Mobile responsiveness

### **Sprint 6: Smart Features (Weeks 10-11)**
- Flexible timing allocation
- Auto-calculation from history
- Budget analytics service
- Smart suggestions

### **Sprint 7: Testing & Polish (Week 12)**
- Comprehensive testing
- Performance optimization
- Documentation updates
- Bug fixes and refinements

---

## 🎯 **Success Metrics**

### **Technical Metrics**
- **Data Migration**: 100% successful migration with no data loss
- **Performance**: Budget calculations complete within 2 seconds
- **Test Coverage**: 90%+ coverage for new budget functionality
- **API Response**: All budget endpoints respond within 500ms

### **User Experience Metrics**
- **Budget Creation**: Complete monthly budget setup in under 5 minutes
- **Transaction Tagging**: Tag assignment in under 10 seconds
- **Budget Tracking**: Real-time budget vs actual updates
- **Mobile Usability**: Full feature parity on mobile devices

### **Business Metrics**
- **User Adoption**: 70%+ of active users create at least one budget
- **Feature Usage**: 50%+ of users use transaction tagging
- **Budget Accuracy**: Auto-calculated budgets within 15% of actual spending
- **User Retention**: Improved retention with budget features

---

## 🚀 **Future Enhancements**

### **Phase 6: Advanced Analytics (Future)**
- **Predictive Budgeting** - ML-based budget predictions
- **Smart Notifications** - Proactive budget alerts and recommendations
- **Goal Setting** - Financial goal tracking integrated with budgets
- **Reporting Suite** - Advanced budget reports and exports

### **Phase 7: Collaboration (Future)**
- **Shared Budgets** - Family/household budget sharing
- **Budget Templates** - Community-shared budget templates
- **Financial Advisor Integration** - Professional budget review features

---

## 📝 **Notes & Considerations**

### **Key Design Decisions**
- **Sub-category Granularity**: Enables precise expense tracking
- **Flexible Timing**: Accommodates real-world payment cycles
- **Multi-source Projects**: Supports complex project funding
- **Tagging System**: Extensible beyond budgets for user organization

### **Technical Considerations**
- **Data Consistency**: Ensure budget totals always match transaction sums
- **Performance**: Large transaction sets require efficient aggregation
- **Flexibility**: Configuration options for various user preferences
- **Extensibility**: Design allows for future budget types and features

### **Risk Mitigation**
- **Migration Safety**: Comprehensive backup and rollback procedures
- **Data Validation**: Multiple validation layers for budget integrity
- **User Education**: Clear documentation and onboarding flows
- **Gradual Rollout**: Feature flags for controlled deployment

---

*Last Updated: January 17, 2025*
*Status: 📋 Ready for Implementation*
