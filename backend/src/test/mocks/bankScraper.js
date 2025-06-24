const validCredentials = {
  username: 'testuser',
  password: 'bankpass123'
};

// Mock data for scraped transactions
const mockTransactions = [
  {
    identifier: 'mock-txn-1',
    date: new Date().toISOString(),
    processedDate: new Date().toISOString(),
    description: 'Super Market Purchase',
    memo: 'Shopping',
    type: 'normal',
    chargedAmount: -150.50,
    currency: 'ILS',
    status: 'completed'
  },
  {
    identifier: 'mock-txn-2',
    date: new Date().toISOString(),
    processedDate: new Date().toISOString(),
    description: 'Salary Payment',
    memo: 'Monthly Salary',
    type: 'normal',
    chargedAmount: 5000.00,
    currency: 'ILS',
    status: 'completed'
  },
  {
    identifier: 'mock-txn-3',
    date: new Date().toISOString(),
    processedDate: new Date().toISOString(),
    description: 'Credit Card Payment',
    memo: 'Monthly Payment',
    type: 'CREDIT_CARD_PAYMENT',
    chargedAmount: -2000.00,
    currency: 'ILS',
    status: 'completed'
  }
];

module.exports = {
  createScraper: (options) => {
    console.log('Creating mock scraper with options:', options);

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
        console.log('Mock scraper initialize called');
        return true;
      },
      login: async (credentials) => {
        console.log('Mock scraper login called with:', { username: credentials.username, password: '[REDACTED]' });
        if (credentials.username !== validCredentials.username || 
            credentials.password !== validCredentials.password) {
          throw new Error('Invalid credentials');
        }
        return true;
      },
      getAccountsData: async () => {
        console.log('Mock scraper getAccountsData called');
        return [{
          accountNumber: '123456',
          balance: 1000
        }];
      },
      scrape: async (credentials) => {
        console.log('Mock scraper scrape called with:', { username: credentials.credentials.username, password: '[REDACTED]' });
        if (credentials.credentials.username !== validCredentials.username || 
            credentials.credentials.password !== validCredentials.password) {
          return {
            success: false,
            errorType: 'InvalidCredentials',
            errorMessage: 'Invalid credentials provided'
          };
        }
        return {
          success: true,
          accounts: [{
            accountNumber: '123456',
            balance: 10000,
            txns: mockTransactions
          }]
        };
      }
    };
  },
  mockTransactions
};
