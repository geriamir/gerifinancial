// Sign in for tests.
//
// The real flow redirects through github.com, which end-to-end tests cannot
// drive, so they seed a session through the test-only endpoint instead. The
// backend restricts it to the test and e2e environments.
Cypress.Commands.add('login', (email: string) => {
  return cy.request('POST', `${Cypress.env('apiUrl')}/api/test/create-test-user`, {
    email
  }).then((response) => response.body.token);
});

// Create test user command
Cypress.Commands.add('createTestUser', (options = {}) => {
  const defaultOptions = {
    email: 'test@example.com',
    name: 'Test User',
    ...options
  };

  return cy.request('POST', `${Cypress.env('apiUrl')}/api/test/create-test-user`, defaultOptions)
    .then((response) => {
      const token = response.body.token;
      Cypress.env('testUserId', response.body.user?.id);
      
      // Set onboarding as complete for test users to skip onboarding flow
      // Update both legacy (onboardingStatus) and new (onboarding) fields
      return cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/api/users/onboarding-status`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          isComplete: true,
          completedSteps: ['checking-account', 'complete'],
          hasCheckingAccount: true,
          hasCreditCards: false
        }
      }).then(() => {
        return cy.request({
          method: 'POST',
          url: `${Cypress.env('apiUrl')}/api/onboarding/complete-onboarding`,
          headers: { Authorization: `Bearer ${token}` }
        });
      }).then(() => token);
    });
});

// Create onboarding user (without completing onboarding)
Cypress.Commands.add('createOnboardingUser', (options = {}) => {
  const defaultOptions = {
    email: 'onboarding@example.com',
    name: 'Onboarding User',
    ...options
  };

  return cy.request('POST', `${Cypress.env('apiUrl')}/api/test/create-test-user`, defaultOptions)
    .then((response) => {
      const token = response.body.token;
      const userId = response.body.user?.id;
      Cypress.env('testUserId', userId);
      
      cy.log('Created onboarding user:', userId);
      
      // New users automatically get onboarding structure with defaults:
      // isComplete: false, currentStep: 'checking-account'
      // This matches what happens in the real app
      return token;
    });
});

export interface TestUserOptions {
  email: string;
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
  cy.task('db:clearTestData', null, { timeout: 30000 }).then(() => {
    cy.clearCookies();
    localStorage.clear();
  });
});

// Re-apply a session cookie yielded by createTestUser.
//
// Cypress clears cookies between tests, so specs that seed a user once in
// before() need to restore the session at the start of each test.
Cypress.Commands.add('setSession', (token: string) => {
  cy.setCookie('gerifinancial_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });
});

// Add support for more specific bank account actions
Cypress.Commands.add('deleteAccount', (accountId: string) => {
  // cy.request replays the session cookie from the browser's jar, so these
  // helpers need no token of their own.
  return cy.request({
    method: 'DELETE',
    url: `${Cypress.env('apiUrl')}/api/bank-accounts/${accountId}`
  });
});

Cypress.Commands.add('testConnection', (accountId: string) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/bank-accounts/${accountId}/test`
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
