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

export interface TestUserOptions {
  email: string;
  password: string;
  name: string;
}

export interface BankAccountOptions {
  bankId?: string;
  name?: string;
  username?: string;
  password?: string;
}

// Create bank account command
Cypress.Commands.add('createBankAccount', (token: string, options: Partial<BankAccountOptions> = {}) => {
  const { username, password, ...rest } = {
    bankId: 'hapoalim',
    name: 'Test Account',
    username: 'testuser',
    password: 'bankpass123',
    ...options
  };

  const defaultOptions = {
    ...rest,
    credentials: {
      username,
      password
    }
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
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/test/clear-data`,
    failOnStatusCode: false
  }).then((response) => {
    if (response.status !== 200) {
      cy.log('Warning: Failed to clear test database');
    }
    // Clear localStorage regardless of DB clear result
    localStorage.clear();
  });
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
