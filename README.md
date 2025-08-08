# GeriFinancial

**Production-Ready Financial Management Platform** with Israeli bank integration, sophisticated RSU portfolio management, advanced budgeting, and intelligent transaction processing.

🎯 **Current Status**: Advanced Production Features (~85% Core Features Complete)  
📊 **See**: [PROJECT_STATUS_OVERVIEW.md](PROJECT_STATUS_OVERVIEW.md) for comprehensive progress details  
👤 **User Guide**: [CURRENT_CAPABILITIES.md](CURRENT_CAPABILITIES.md) for what you can do today

## Project Structure

```
gerifinancial/
├── backend/               # Node.js backend
│   ├── src/
│   │   ├── config/       # Configuration setup
│   │   ├── middleware/   # Express middleware
│   │   ├── models/       # MongoDB models
│   │   │   └── __tests__/  # Model tests
│   │   ├── routes/       # API routes
│   │   │   └── __tests__/  # Route tests
│   │   ├── services/     # Business logic services
│   │   │   └── __tests__/  # Service tests
│   │   ├── test/         # Test utilities and setup
│   │   │   ├── mocks/      # Test mocks
│   │   │   └── setup.js    # Test configuration
│   │   └── utils/        # Utility functions
│   ├── .env             # Local environment variables (git-ignored)
│   └── .env.example     # Environment template
├── frontend/            # React frontend
│   ├── cypress/         # E2E test suite
│   │   ├── e2e/          # E2E test files
│   │   └── support/      # Test helpers and commands
│   └── src/
│       ├── components/  # React components
│       │   ├── auth/      # Authentication components
│       │   ├── bank/      # Bank management & scraping components
│       │   └── layout/    # Layout components
│       ├── contexts/    # React contexts
│       ├── services/    # Services layer
│       │   └── api/       # API services and types
│       │       ├── types/   # TypeScript type definitions
│       │       └── base.ts  # Base API configuration
│       ├── test/        # Frontend test utilities
│       │   └── __mocks__/ # Component mocks
│       ├── utils/       # Utility functions
│       └── constants/   # Shared constants
├── package.json        # Root package with scripts
└── .gitignore         # Root git ignore rules
```

## 🚀 **Current Production Features**

### ✅ **Transaction Management System** (Complete)
**AI-Powered Processing with Smart Automation**
- **Smart Bank Scraping**: Israeli bank integration with 80% bandwidth reduction through incremental updates
- **AI Categorization**: Intelligent transaction categorization with confidence scoring and manual override
- **Enhanced Keyword Matching**: 80% reduction in false positives with word boundary detection
- **Advanced Filtering**: Comprehensive search, filtering, and bulk operations
- **Mobile-First UX**: Touch-optimized categorization workflow with step-by-step guidance

### ✅ **RSU Portfolio Management** (Production Ready)
**Comprehensive Stock Equity Management**
- **Multi-Grant Tracking**: Unlimited RSU grants with quarterly vesting (20 periods over 5 years)
- **Israeli Tax Compliance**: Complex tax calculations (65% wage income + 25%/65% capital gains)
- **Event-Driven Timeline**: Accurate portfolio evolution with historical price integration
- **Professional CRUD Operations**: Grant creation, sale recording, tax preview with Material-UI
- **Stock Price Integration**: Multi-API fallback system with historical data accuracy

### ✅ **Budget Management System** (Advanced)
**Multi-Layered Budget Architecture**
- **CategoryBudget Foundation**: Fixed/variable budget types with template-based management
- **Monthly & Project Budgets**: Subcategory-level precision with multi-source funding
- **Pattern Detection**: 95%+ accuracy in recurring expense identification
- **Transaction Tagging**: ObjectId-based system with project allocation
- **Budget Analytics**: Real-time variance analysis with drill-down transaction views

### ✅ **Modern Navigation & UX** (Phase 1 Complete)
**Professional User Experience**
- **4-Item Structure**: Overview, Transactions, Budgets, RSUs with integrated bank management
- **Enhanced Overview**: Financial summary, action items, recent activity timeline
- **Mobile-Responsive Design**: Touch-friendly interfaces across all features
- **Material-UI Components**: Consistent professional design system

## 🏗️ **System Architecture**

### **Production Infrastructure**
```
39 API Endpoints | 15+ Database Models | Service-Oriented Architecture

Backend: Node.js + Express + MongoDB
├── RSU Service (21 endpoints) - Portfolio, tax calculations, timeline
├── Budget Service (15 endpoints) - Monthly, projects, pattern detection  
├── Transaction Service - AI categorization, smart scraping
├── Stock Price Service - Multi-API integration with historical data
└── Pattern Detection - 95%+ accuracy recurring expense identification

Frontend: React + TypeScript + Material-UI
├── Professional Component Library (RSU, Budget, Transaction)
├── Context-Based State Management with optimistic updates
├── Mobile-First Responsive Design with touch optimization
└── Comprehensive TypeScript interfaces and error handling
```

### **Key Technical Achievements**
- **Zero Concurrency Issues**: Per-date stock price records eliminated MongoDB version conflicts
- **Timeline Accuracy**: Event-driven calculations with proper historical price usage
- **Test Performance**: 70x improvement in test execution (230+ seconds → 3.3 seconds)
- **Pattern Recognition**: Machine learning-based detection with 95%+ accuracy
- **Mobile Optimization**: 60fps interactions with professional loading states

## 🎯 **What Users Can Do Today**

### **RSU Portfolio Management**
- Track unlimited RSU grants from multiple companies
- View real-time portfolio value with gain/loss analysis
- Record sales with automatic Israeli tax calculations
- Visualize vesting timeline with event-driven accuracy
- Preview tax implications before sales (2-year threshold handling)

### **Advanced Budget Management**  
- Create monthly budgets with subcategory-level precision
- Set up project budgets with multiple funding sources
- Auto-calculate budgets from historical transaction patterns
- Track budget vs actual with real-time progress indicators
- Detect recurring expense patterns automatically

### **Smart Transaction Processing**
- Scrape Israeli bank accounts with intelligent scheduling
- AI-powered categorization with manual override capability
- Tag transactions for project allocation and organization
- Advanced filtering and bulk operations
- Mobile-optimized categorization workflow

### **Integrated Financial Overview**
- Unified dashboard with financial summary and RSU portfolio
- Recent activity timeline with quick categorization
- Uncategorized transaction alerts with direct navigation
- Budget progress tracking with variance analysis
- Professional Material-UI design across all components

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

## Environment Setup

1. Copy the environment template:
```bash
cp backend/.env.example backend/.env
```

2. Configure backend/.env with your settings:
```
PORT=3001
MONGODB_URI=mongodb://localhost:27777/gerifinancial
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=24h
NODE_ENV=development
```

## Installation

1. Install all dependencies (frontend and backend):
```bash
npm run install-all
```

2. Start development servers:
```bash
npm run dev
```

This will start:
- Frontend on http://localhost:3000
- Backend on http://localhost:3001
- Connects to MongoDB on port 27777

## Available Scripts

In the root directory:
- `npm run install-all`: Install dependencies for both frontend and backend
- `npm run dev`: Start both servers concurrently
- `npm run backend`: Start only the backend server
- `npm run frontend`: Start only the frontend server

## Testing

The project includes comprehensive testing setup for both backend and frontend:

### Backend Tests

- Unit and integration tests using Jest
- MongoDB Memory Server for database testing
- API endpoint testing with Supertest
- Test utilities for auth token generation and user creation
- Clean test data management

Run backend tests:
```bash
cd backend && npm test
```

### Frontend Tests

- Component tests using React Testing Library
- End-to-end tests using Cypress
- Custom Cypress commands for common operations
- Integration with MUI components
- Isolated test database for E2E tests
- Improved test stability and reliability

Run frontend tests:
```bash
# Unit tests
cd frontend && npm test

# E2E tests (interactive)
cd frontend && npm run cypress:open

# E2E tests (headless)
cd frontend && npm run cypress:run

# Run specific test suites
npm run test:e2e:auth    # Run auth-related E2E tests
npm run test:e2e:bank    # Run bank-related E2E tests
```

### Running All Tests

From the root directory:
```bash
# Run all tests (unit + E2E)
npm run test:all

# Run only E2E tests
npm run test:e2e

# Run E2E tests headless
npm run test:e2e:headless

# Run new improved E2E tests
npm run test:e2e:new    # Uses in-memory DB and improved stability
```

For detailed information about test improvements and roadmap, see TESTING_ROADMAP.md

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

## 📋 **Current Development Priorities**

### **Navigation Simplification** (Phases 2-4)
- Mobile bottom tab navigation  
- Breadcrumb system implementation
- URL structure optimization and legacy redirect handling

### **Pattern Detection UI Integration**
- Budget component pattern indicators
- Transaction pattern awareness displays
- Pattern approval workflows and management

### **Advanced Analytics & Reporting** (Next Quarter)
- Data visualization and insights dashboard
- Export functionality for tax reporting
- Performance benchmarking and trend analysis

### **Category System Enhancements** (Planned)
- Professional PNG icons with color theming
- Category structure optimization (flatten Income/Transfer)
- Enhanced visual design system

## 📚 **Documentation & Resources**

### **Primary Documentation**
- **[PROJECT_STATUS_OVERVIEW.md](PROJECT_STATUS_OVERVIEW.md)** - Comprehensive feature status and achievements
- **[CURRENT_CAPABILITIES.md](CURRENT_CAPABILITIES.md)** - User-focused guide to current system capabilities
- **[RSU_FEATURE_ROADMAP.md](RSU_FEATURE_ROADMAP.md)** - Complete RSU implementation details
- **[BUDGET_FEATURE_ROADMAP.md](BUDGET_FEATURE_ROADMAP.md)** - Budget system architecture and features
- **[NAVIGATION_SIMPLIFICATION_ROADMAP.md](NAVIGATION_SIMPLIFICATION_ROADMAP.md)** - Navigation modernization plan
- **[TESTING_ROADMAP.md](TESTING_ROADMAP.md)** - Testing strategy and coverage goals

### **Implementation Summaries**
- **[RSU_TIMEOUT_FIXES_SUMMARY.md](RSU_TIMEOUT_FIXES_SUMMARY.md)** - Test performance improvements
- **[TIMELINE_REWORK_SUMMARY.md](TIMELINE_REWORK_SUMMARY.md)** - Event-driven timeline accuracy
- **[STOCK_PRICE_RESTRUCTURE_SUMMARY.md](STOCK_PRICE_RESTRUCTURE_SUMMARY.md)** - Concurrency issue resolution

## ⚡ **Quick Start**

### Installation & Setup
```bash
# Install all dependencies
npm run install-all

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI and JWT secret

# Start development servers
npm run dev
```

### Access Points
- **Frontend**: http://localhost:3000 (React + TypeScript + Material-UI)
- **Backend**: http://localhost:3001 (Node.js + Express + MongoDB)
- **MongoDB**: localhost:27777 (Local development database)

### Available Scripts
```bash
npm run dev              # Start both frontend and backend
npm run backend         # Backend only
npm run frontend        # Frontend only
npm run install-all     # Install all dependencies
npm run test:all        # Run all tests (unit + E2E)
npm run test:e2e        # Cypress E2E tests only
```

## 🔧 **Technical Stack**

### **Backend Architecture**
- **Runtime**: Node.js with Express framework
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **External APIs**: israeli-bank-scrapers, stock price APIs (Yahoo Finance, Alpha Vantage)
- **Services**: 7 major service layers with comprehensive business logic
- **Testing**: Jest with MongoDB Memory Server and Supertest

### **Frontend Architecture**  
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI (MUI) v5 with custom theming
- **State Management**: Context API with optimistic updates
- **Routing**: React Router v6 with query parameter management
- **API Layer**: Axios with TypeScript interfaces and error handling
- **Testing**: React Testing Library + Cypress E2E

### **Security & Performance**
- **Authentication**: JWT-based with automatic token refresh
- **Data Protection**: Encrypted bank credentials, sanitized API responses
- **Performance**: Code splitting, lazy loading, optimized bundle size
- **Mobile**: Touch-optimized interfaces with 60fps interactions
- **Error Handling**: Comprehensive error boundaries and user feedback

## Contributing

1. Create your feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
3. Push to the branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## License

ISC License
