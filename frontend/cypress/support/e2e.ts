import './commands';

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login as a user
       * @param email - User email
       * @param password - User password
       * @example
       * cy.login('test@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>;

      /**
       * Create a new test user and return the token
       * @param options - User creation options
       * @example
       * cy.createTestUser({ email: 'test@example.com', password: 'password123', name: 'Test User' })
       */
      createTestUser(options?: {
        email?: string;
        password?: string;
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
