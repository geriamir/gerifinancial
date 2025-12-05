const validCredentials = {
  username: 'testuser',
  password: 'bankpass123'
};

// Static date for consistent testing
const STATIC_DATE = '2025-06-27T00:00:00.000Z';

// Mock data for scraped transactions
const mockTransactions = [
  {
    identifier: 'mock-txn-1',
    date: STATIC_DATE,
    processedDate: STATIC_DATE,
    description: 'Super Market Purchase',
    memo: 'Shopping',
    type: 'Expense',  // Matches our TransactionType enum
    chargedAmount: -150.50,
    currency: 'ILS',
    status: 'verified'
  },
  {
    identifier: 'mock-txn-2',
    date: STATIC_DATE,
    processedDate: STATIC_DATE,
    description: 'Salary Payment',
    memo: 'Monthly Salary',
    type: 'Income',  // Matches our TransactionType enum
    chargedAmount: 5000.00,
    currency: 'ILS',
    status: 'verified'
  },
  {
    identifier: 'mock-txn-3',
    date: STATIC_DATE,
    processedDate: STATIC_DATE,
    description: 'Credit Card Payment',
    memo: 'Monthly Payment',
    type: 'Transfer',  // Matches our TransactionType enum
    chargedAmount: 2000.00,
    currency: 'ILS',
    status: 'verified'
  }
];

module.exports = {
  validCredentials,
  createScraper: (options) => {

    // Add special case for error testing
    if (options.companyId === 'error_bank') {
      return {
        initialize: async () => true,
        login: async () => true,
        getAccountsData: async () => {
          throw new Error('Bank API is temporarily unavailable');
        },
        scrape: async () => {
          throw new Error('Bank API is temporarily unavailable');
        }
      };
    }
    return {
      initialize: async () => {
        return true;
      },
      login: async (credentials) => {
        
        // For validation and login attempts
        if (!credentials.username || !credentials.password) {
          throw new Error('Missing credentials');
        }

        // In e2e mode, still reject specifically invalid credentials for error testing
        // but accept most other credentials
        const isE2E = process.env.NODE_ENV === 'e2e';
        
        if (isE2E) {
          // Special case: reject explicitly invalid credentials for error testing
          if (credentials.username === 'invalid' && credentials.password === 'invalid') {
            throw new Error('Invalid bank credentials');
          }
          // Accept all other credentials in e2e mode
          return true;
        }

        // In unit test mode, verify against specific test credentials
        if (credentials.username === validCredentials.username && 
            credentials.password === validCredentials.password) {
          return true;
        }

        // Test credentials failed
        throw new Error('Invalid bank credentials');
      },
      getAccountsData: async () => {
        return [{
          accountNumber: '123456',
          balance: 1000
        }];
      },
      scrape: async (credentials) => {
        if (!credentials || !credentials.username || !credentials.password) {
          return {
            success: false,
            errorType: 'InvalidCredentials',
            errorMessage: 'Missing credentials'
          };
        }

        const isE2E = process.env.NODE_ENV === 'e2e';
        
        // In e2e mode, accept any credentials and return mock data
        if (isE2E || (credentials.username === validCredentials.username && 
            credentials.password === validCredentials.password)) {
          return {
            success: true,
            accounts: [{
              accountNumber: '123456',
              balance: 10000,
              txns: mockTransactions
            }]
          };
        }
        
        return {
          success: false,
          errorType: 'InvalidCredentials',
          errorMessage: 'Invalid credentials provided'
        };
      },

      // Support checking methods for strategy pattern
      doesSupportTransactions: () => true,
      doesSupportPortfolios: () => true,
      doesSupportForeignCurrencyAccounts: () => true,

      // Mock portfolio scraping
      scrapePortfolios: async (credentials) => {
        if (!credentials || !credentials.username || !credentials.password) {
          return {
            success: false,
            errorType: 'InvalidCredentials',
            errorMessage: 'Missing credentials'
          };
        }

        if (credentials.username === validCredentials.username && 
            credentials.password === validCredentials.password) {
          return {
            success: true,
            portfolios: [{
              portfolioId: 'mock-portfolio-1',
              portfolioName: 'Test Portfolio',
              totalValue: 50000,
              transactions: []
            }]
          };
        }
        
        return {
          success: false,
          errorType: 'InvalidCredentials',
          errorMessage: 'Invalid credentials provided'
        };
      },

      // Mock foreign currency scraping
      scrapeForeignCurrencyAccounts: async (credentials) => {
        if (!credentials || !credentials.username || !credentials.password) {
          return {
            success: false,
            errorType: 'InvalidCredentials',
            errorMessage: 'Missing credentials'
          };
        }

        if (credentials.username === validCredentials.username && 
            credentials.password === validCredentials.password) {
          return {
            success: true,
            foreignCurrencyAccounts: [{
              accountNumber: 'USD-123456',
              currency: 'USD',
              balance: 1000,
              txns: []
            }]
          };
        }
        
        return {
          success: false,
          errorType: 'InvalidCredentials',
          errorMessage: 'Invalid credentials provided'
        };
      }
    };
  },
  mockTransactions
};
