/// <reference types="cypress" />

interface TestUserOptions {
  email: string;
  password: string;
  name: string;
}

interface BankAccountOptions {
  bankId?: string;
  name?: string;
  username?: string;
  password?: string;
}

declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      /**
       * Login with email and password
       * @example
       * cy.login('test@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>;

      /**
       * Create a test user with optional parameters
       * @example
       * cy.createTestUser()
       * cy.createTestUser({ email: 'custom@example.com' })
       */
      createTestUser(options?: Partial<TestUserOptions>): Chainable<string>;

      /**
       * Clear test data from MongoDB and localStorage
       * @example
       * cy.clearTestData()
       */
      clearTestData(): Chainable<void>;

      /**
       * Create a new bank account
       * @example
       * cy.createBankAccount(token, { name: 'My Account' })
       */
      createBankAccount(token: string, options?: Partial<BankAccountOptions>): Chainable<Cypress.Response<any>>;

      /**
       * Delete a bank account
       * @example
       * cy.deleteAccount('account-id')
       */
      deleteAccount(accountId: string): Chainable<Cypress.Response<any>>;

      /**
       * Test bank account connection
       * @example
       * cy.testConnection('account-id')
       */
      testConnection(accountId: string): Chainable<Cypress.Response<any>>;
    }
  }
}

export {};
