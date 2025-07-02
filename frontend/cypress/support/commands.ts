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
      Cypress.env('testUserId', response.body.userId);
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
  const defaults = {
    bankId: 'hapoalim',
    name: 'Test Account',
    username: 'testuser',
    password: 'bankpass123'
  };

  const { username, password, ...rest } = {
    ...defaults,
    ...options
  };

  const requestBody = {
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
    body: requestBody
  });
});

// Clear test data command - now uses MongoDB task
Cypress.Commands.add('clearTestData', () => {
  cy.task('db:clearTestData', null, { timeout: 10000 }).then(() => {
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
