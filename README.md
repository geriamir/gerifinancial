# GeriFinancial

Financial management application with Israeli bank scraping capabilities.

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

## Development Progress

### Phase 1: Initial Setup (Completed)

#### Backend Implementation
1. Set up Node.js project with Express
2. Integrated MongoDB with mongoose
3. Created User model with authentication
4. Created BankAccount model for storing bank credentials
5. Implemented JWT-based authentication
6. Set up israeli-bank-scrapers integration
7. Created authentication routes (register, login, profile)
8. Created bank account management routes
9. Implemented environment configuration

#### Frontend Implementation
1. Created React application with TypeScript
2. Set up Material-UI for styling
3. Implemented authentication context
4. Created login and registration forms
5. Added protected route functionality
6. Created authenticated layout with navigation
7. Set up API service layer

#### Project Configuration
1. Set up concurrent running of frontend and backend
2. Configured environment variables
3. Set up proper .gitignore files
4. Added development scripts in root package.json

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

### Phase 3: Transaction Productization (Completed)

#### Comprehensive Transaction Management System
1. **Smart Scraping Optimization**:
   - Intelligent start date logic (6 months back for first scrape, incremental thereafter)
   - Automatic `lastScraped` timestamp tracking
   - 80%+ bandwidth reduction through incremental scraping
   - Error-resilient scraping with proper failure handling

2. **Enhanced Dashboard Experience**:
   - Uncategorized transactions widget with real-time stats
   - Visual warning/success state indicators
   - One-click navigation to filtered transaction views
   - Responsive card-based layout
   - Smart URL parameter support for deep linking

3. **Transaction Detail Views**:
   - Comprehensive transaction detail dialog
   - Click-to-view functionality from transaction lists
   - Complete transaction metadata display
   - Categorization reasoning and debugging information
   - Mobile-responsive design with touch-friendly interactions

4. **Enhanced Manual Categorization Experience**:
   - Step-by-step categorization workflow (Type → Category → Subcategory)
   - Visual category thumbnails with emoji icons
   - Smart transaction type inference based on amount
   - Mobile-first design with touch gestures
   - Lightweight back navigation between steps
   - Loading states and comprehensive error handling

#### Transaction System Features
- **AI-Powered Categorization**: Intelligent transaction categorization with confidence scoring
- **Manual Override**: User-friendly manual categorization with visual feedback
- **Category Management**: Hierarchical category and subcategory system
- **Smart Filtering**: Advanced filtering by date, type, category, and search terms
- **Real-time Stats**: Live uncategorized transaction counts and progress tracking
- **Accessibility**: Full keyboard navigation and screen reader support

#### Backend Enhancements
- **Transaction Service**: Comprehensive transaction processing and categorization
- **Category AI Service**: Machine learning-based categorization suggestions
- **Category Mapping Service**: Intelligent mapping between user actions and categories
- **Translation Service**: Hebrew text processing and translation for categorization
- **Verification Workflow**: Complete transaction verification and audit trail

#### Frontend Architecture
- **Component Library**: Reusable transaction components with TypeScript support
- **State Management**: Efficient state handling with optimistic updates
- **Mobile Optimization**: Touch-friendly interface optimized for mobile devices
- **Performance**: Optimized rendering with minimal re-renders
- **Error Handling**: Comprehensive error recovery and user feedback

## Future Roadmap

See FEATURES_ROADMAP.md for detailed feature implementation plans.

### Phase 4: Budget Management System ✅ (Completed)

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

### Phase 5: Advanced Financial Analysis (Future)
- Data visualization and reporting
- Advanced budgeting insights
- Spending pattern analysis
- Performance optimizations
- Export functionality

## Technical Details

### Backend Stack
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- Israeli-bank-scrapers for bank data
- Service-based architecture for business logic
- Comprehensive test coverage with Jest

### Frontend Stack
- React with TypeScript
- Material-UI components
- React Router for navigation
- Axios for API calls
- Custom form handling
- Analytics tracking

### Security Features
- JWT-based authentication
- Secure credential handling through service layer
- Encrypted bank credentials
- No sensitive data exposure
- Automatic response sanitization
- Protected routes and endpoints
- Clean form state management

### Analytics Setup
- Event-based tracking
- User action monitoring
- Error tracking
- Success metrics
- Development logging
- Extensible analytics abstraction

## Contributing

1. Create your feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
3. Push to the branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## License

ISC License
