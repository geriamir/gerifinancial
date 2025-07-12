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

        // Always verify credentials
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

        if (credentials.username === validCredentials.username && 
            credentials.password === validCredentials.password) {
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
      }
    };
  },
  mockTransactions
};
