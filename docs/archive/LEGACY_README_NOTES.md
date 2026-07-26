# Legacy README Notes (2025)

> **Archived July 2026.** These sections were removed from the root `README.md`
> during the documentation refresh. They describe the project as it stood in
> 2025 and contain **outdated file paths** (e.g. `backend/src/models/...`,
> which no longer exists after the move to domain modules) and outdated
> endpoint counts. Kept for historical context only.
>
> For current information see [`../ARCHITECTURE.md`](../ARCHITECTURE.md),
> [`../../README.md`](../../README.md) and
> [`../../PROJECT_STATUS_OVERVIEW.md`](../../PROJECT_STATUS_OVERVIEW.md).

---

## Legacy Documentation

The sections below contain historical implementation details and are maintained for reference:

### Phase 2: Bank Integration (Completed)

#### Bank Account Management
1. Implemented bank account connection UI:
   - Add bank accounts with custom names
   - View and manage connected accounts
   - Test bank connections
   - Delete accounts
   - Clean form state management

2. Security Enhancements:
   - Secure credential handling
   - No sensitive data in responses
   - Automatic credential stripping
   - Form data clearing on close
   - Protected routes and API endpoints

3. User Interface Improvements:
   - Intuitive bank account form
   - Clear status indicators
   - Error handling and display
   - Responsive design
   - User-friendly account names

4. Analytics Integration:
   - Comprehensive event tracking
   - User action monitoring
   - Error tracking
   - Success metrics
   - Development mode logging

5. Code Organization:
   - Centralized constants
   - Shared type definitions
   - Clean component structure
   - Reusable utilities
   - Analytics abstraction

#### Transaction Scraping
1. Unified Bank Account Management:
   - Centralized scraping in bank accounts context
   - Individual account scraping controls
   - Batch scraping for all accounts
   - Last scrape status tracking
   - Improved error handling and feedback

2. API Improvements:
   - Moved scraping endpoints to bank accounts router
   - Added batch scraping endpoint
   - Consistent response formats
   - Better error reporting
   - Real-time progress tracking

3. Frontend Architecture:
   - Moved bank components to core structure
   - Added comprehensive TypeScript types
   - Enhanced loading states
   - Clear error messaging
   - Analytics event tracking
   - Reorganized services directory:
     * Centralized API services under api/
     * Moved shared types to api/types/
     * Added clean interface exports
     * Improved code maintainability
   - Transaction System Improvements:
     * Flexible transaction querying
     * Optional account filtering
     * Infinite scroll pagination
     * Comprehensive filtering capabilities
   - Date Picker Integration:
     * Integrated MUI Date Pickers
     * Added Hebrew locale support
     * Configured ESM/CJS compatibility
     * Optimized webpack configuration


---

### Historical Implementation Details

#### Phase 3: Transaction Productization ✅ (Completed)
*Comprehensive transaction management system with AI categorization and mobile-first UX*

#### Phase 4: Budget Management System ✅ (Completed)

#### CategoryBudget Foundation System
The budget system is built on a sophisticated **CategoryBudget** foundation that provides flexible, template-based budget management across years:

1. **Core Budget Types**:
   - **Fixed Budgets**: Single amount that repeats every month (e.g., rent, salary)
   - **Variable Budgets**: Different amounts per month (e.g., utilities, seasonal expenses)
   - **Income Budgets**: Category-level budgets for income sources
   - **Expense Budgets**: Subcategory-level budgets for precise expense tracking

2. **Budget Architecture**:
   - **CategoryBudget Model**: Core budget storage with `backend/src/models/CategoryBudget.js`
   - **MonthlyBudget Compatibility**: Legacy compatibility layer for existing frontend
   - **Service Integration**: Primary budget system used by `budgetService.js`
   - **Database Efficiency**: Unique constraints and optimized indexes for performance

#### Comprehensive Budget Management System
1. **Monthly Budget Management**:
   - Auto-calculation from 1-24 months of historical transaction data
   - Sub-category level expense budgeting with real-time actual tracking
   - Salary and income budget management with flexible configuration
   - Budget vs actual variance analysis with color-coded progress indicators
   - Month-by-month navigation with period-based filtering

2. **Project Budget System**:
   - Multi-source funding support (salary, bonus, loan, savings, other)
   - Automatic project tag creation and transaction association
   - Timeline tracking with days remaining calculation
   - Progress percentage based on actual spending vs budget
   - Category-based budget allocation with detailed breakdowns

3. **Transaction Tagging System**:
   - Multi-tag support for flexible transaction organization
   - Project-based tag creation with automatic management
   - Tag usage analytics and insights for spending patterns
   - Bulk tagging operations for efficient transaction management
   - Advanced filtering by tags with real-time search

4. **Smart Budget Features**:
   - Historical transaction analysis for intelligent budget suggestions
   - Budget variance analysis with over/under spending indicators
   - Project timeline management with completion status tracking
   - Budget status management (draft/active/completed)
   - Multi-currency support with flexible configuration

#### Technical Implementation
1. **Backend Architecture**:
   - **15 REST API Endpoints**: Complete CRUD operations for all budget types
   - **6 Database Models**: CategoryBudget, MonthlyBudget, ProjectBudget, Tag, and more
   - **Budget Service Layer**: Comprehensive business logic with analytics
   - **Advanced Indexes**: Optimized database queries for performance

2. **Frontend Architecture**:
   - **React-based Dashboard**: Responsive UI with Material-UI components
   - **BudgetContext**: Centralized state management with optimistic updates
   - **Two-column Layout**: Separate income and expense visualization
   - **Progress Tracking**: Real-time budget vs actual with linear progress bars
   - **Mobile-responsive**: Touch-friendly interface for all screen sizes

3. **Key Components**:
   - **Budget Dashboard** (`/budgets`): Main budget overview with month navigation
   - **Monthly Budget Editor**: Sub-category budget allocation interface
   - **Project Budget Manager**: Multi-source funding and timeline management
   - **Transaction Tagging**: Enhanced transaction detail with tag management

#### Budget System Features
1. **Monthly Budgets**:
   - CategoryBudget-based flexible budget allocation
   - Real-time actual amount calculation from transactions
   - Budget vs actual progress monitoring with color indicators
   - Auto-calculation from historical transaction patterns
   - Income and expense budget separation with visual distinction

2. **Project Budgets**:
   - Multi-source funding with detailed funding source tracking
   - Automatic project tag creation for transaction association
   - Timeline tracking with start/end dates and days remaining
   - Progress percentage calculation based on actual spending
   - Category-based budget allocation with subcategory precision

3. **Budget Dashboard**:
   - Month-by-month navigation with previous/next controls
   - Real-time budget vs actual visualization with progress bars
   - Quick action buttons for budget creation and auto-calculation
   - Project overview cards with status indicators and progress
   - Budget balance summary with surplus/deficit tracking

4. **Enhanced Transaction Integration**:
   - Tag-based transaction organization with ObjectId references
   - Project allocation through transaction tagging system
   - Automatic budget allocation tracking with real-time updates
   - Enhanced transaction service with budget integration methods

See `BUDGET_FEATURE_ROADMAP.md` for complete implementation details and technical specifications.

#### Phase 5: Pattern Detection System ✅ (Completed)
*95%+ accuracy pattern recognition for recurring expenses with budget integration*

#### Phase 6: Enhanced Keyword Matching ✅ (Completed) 
*80% reduction in false positives with word boundary detection and stemming support*

#### Phase 7: RSU Management System ✅ (Production Ready)
*Complete portfolio management with Israeli tax compliance and event-driven timeline*

#### Phase 8: Navigation Modernization 🚧 (Phase 1 Complete)
*4-item structure with enhanced Overview page and mobile optimization*

