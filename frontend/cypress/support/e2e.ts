import './commands';

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Sign in as an existing test user and yield the session token.
       *
       * The real flow redirects through github.com, so tests seed a session
       * through the test-only endpoint instead.
       * @param email - User email
       * @example
       * cy.login('test@example.com')
       */
      login(email: string): Chainable<string>;

      /**
       * Create a new test user and return the token
       * @param options - User creation options
       * @example
       * cy.createTestUser({ email: 'test@example.com', name: 'Test User' })
       */
      createTestUser(options?: {
        email?: string;
        name?: string;
      }): Chainable<string>;

      /**
       * Create a test bank account
       * @param token - Auth token
       * @param options - Bank account options
       * @example
       * cy.createBankAccount(token, { bankId: 'hapoalim', accountNumber: '123456' })
       */
      createBankAccount(
        token: string,
        options?: {
          bankId?: string;
          accountNumber?: string;
          username?: string;
          password?: string;
          nickname?: string;
        }
      ): Chainable<any>;

      /**
       * Clear test data (users and bank accounts)
       * @example
       * cy.clearTestData()
       */
      clearTestData(): Chainable<void>;

      /**
       * Restore a session cookie yielded by createTestUser
       * @example
       * cy.setSession(token)
       */
      setSession(token: string): Chainable<void>;

      /**
       * Delete a bank account
       * @param accountId - The ID of the account to delete
       * @example
       * cy.deleteAccount('123456')
       */
      deleteAccount(accountId: string): Chainable<any>;

      /**
       * Test bank account connection
       * @param accountId - The ID of the account to test
       * @example
       * cy.testConnection('123456')
       */
      testConnection(accountId: string): Chainable<any>;
    }
  }
}
