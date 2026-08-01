/// <reference types="cypress" />

interface TestUserOptions {
  email: string;
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
       * Sign in as an existing test user and yield the session token
       * @example
       * cy.login('test@example.com')
       */
      login(email: string): Chainable<string>;

      /**
       * Create a test user with optional parameters
       * @example
       * cy.createTestUser()
       * cy.createTestUser({ email: 'custom@example.com' })
       */
      createTestUser(options?: Partial<TestUserOptions>): Chainable<string>;

      /**
       * Create an onboarding user (without completing onboarding)
       * @example
       * cy.createOnboardingUser()
       * cy.createOnboardingUser({ email: 'custom@example.com' })
       */
      createOnboardingUser(options?: Partial<TestUserOptions>): Chainable<string>;

      /**
       * Clear test data from MongoDB, cookies and localStorage
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
