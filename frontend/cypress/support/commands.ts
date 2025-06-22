// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request('POST', `${Cypress.env('apiUrl')}/api/auth/login`, {
    email,
    password
  }).then((response) => {
    localStorage.setItem('token', response.body.token);
  });
});

// Create test user command
Cypress.Commands.add('createTestUser', (options = {}) => {
  const defaultOptions = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    ...options
  };

  return cy.request('POST', `${Cypress.env('apiUrl')}/api/auth/register`, defaultOptions)
    .then((response) => {
      return response.body.token;
    });
});

// Create bank account command
Cypress.Commands.add('createBankAccount', (token: string, options = {}) => {
  const defaultOptions = {
    bankId: 'hapoalim',
    accountNumber: '123456',
    username: 'testuser',
    password: 'bankpass123',
    nickname: 'Test Account',
    ...options
  };

  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/bank-accounts`,
    headers: { Authorization: `Bearer ${token}` },
    body: defaultOptions
  });
});

// Clear test data command
Cypress.Commands.add('clearTestData', () => {
  // Get the current token if it exists
  const token = localStorage.getItem('token');
  
  if (token) {
    // Delete all bank accounts for the current user
    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/api/bank-accounts`,
      headers: { Authorization: `Bearer ${token}` }
    }).then((response) => {
      response.body.forEach((account: { _id: string }) => {
        cy.request({
          method: 'DELETE',
          url: `${Cypress.env('apiUrl')}/api/bank-accounts/${account._id}`,
          headers: { Authorization: `Bearer ${token}` }
        });
      });
    });
  }

  // Clear localStorage
  localStorage.clear();
});

// Add support for more specific bank account actions
Cypress.Commands.add('deleteAccount', (accountId: string) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No token found');

  return cy.request({
    method: 'DELETE',
    url: `${Cypress.env('apiUrl')}/api/bank-accounts/${accountId}`,
    headers: { Authorization: `Bearer ${token}` }
  });
});

Cypress.Commands.add('testConnection', (accountId: string) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No token found');

  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/bank-accounts/${accountId}/test`,
    headers: { Authorization: `Bearer ${token}` }
  });
});

// Interceptors for common API calls
beforeEach(() => {
  // Reset API call tracking between tests
  cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('getBankAccounts');
  cy.intercept('POST', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('createBankAccount');
  cy.intercept('DELETE', `${Cypress.env('apiUrl')}/api/bank-accounts/*`).as('deleteBankAccount');
  cy.intercept('POST', `${Cypress.env('apiUrl')}/api/bank-accounts/*/test`).as('testConnection');
});
