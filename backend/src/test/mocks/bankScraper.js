const validCredentials = {
  username: 'testuser',
  password: 'bankpass123'
};

module.exports = {
  createScraper: (options) => {
    console.log('Creating mock scraper with options:', options);
    return {
      initialize: async () => {
        console.log('Mock scraper initialize called');
        return true;
      },
      login: async (credentials) => {
        console.log('Mock scraper login called with:', credentials);
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
      }
    };
  }
};
