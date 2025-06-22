const mockFn = (returnValue) => () => Promise.resolve(returnValue);

module.exports = {
  createScraper: () => ({
    initialize: mockFn(true),
    login: mockFn(true),
    getAccountsData: mockFn([{
      accountNumber: '123456',
      balance: 1000
    }])
  })
};
