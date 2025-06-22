# GeriFinancial

Financial management application with Israeli bank scraping capabilities.

[Previous content remains the same until Testing section...]

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

[Rest of the README remains the same...]
