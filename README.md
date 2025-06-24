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
│       ├── services/    # API services
│       │   └── types/     # TypeScript type definitions
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

### Phase 2: Bank Integration (In Progress)

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

### Test Improvements

Recent enhancements to the testing setup include:

1. **Reliable Database Management**
   - In-memory MongoDB for E2E tests
   - Automatic test data cleanup
   - Isolated test environment

2. **Improved Test Stability**
   - Better UI component interaction
   - Proper wait conditions
   - Reduced test flakiness
   - Clean server startup/shutdown

3. **Enhanced Developer Experience**
   - Reduced console noise
   - Clear test output
   - Faster test execution
   - Improved error messages

## Next Steps

### Phase 3: Financial Analysis (Future)
1. Implement transaction categorization
   - Automatic categorization rules
   - Custom categories
   - Bulk categorization
   - Category statistics

2. Add data visualization
   - Monthly spending charts
   - Category-based analysis
   - Income vs. expenses
   - Trend analysis

3. Implement budgeting features
   - Monthly budget setting
   - Category-based budgets
   - Budget alerts
   - Remaining budget calculations

4. Add financial reports and insights
   - Monthly financial summaries
   - Spending pattern analysis
   - Savings recommendations
   - Financial health indicators

## Technical Details

### Backend Stack
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- Israeli-bank-scrapers for bank data

### Frontend Stack
- React with TypeScript
- Material-UI components
- React Router for navigation
- Axios for API calls
- Custom form handling
- Analytics tracking

### Security Features
- JWT-based authentication
- Secure credential handling
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
