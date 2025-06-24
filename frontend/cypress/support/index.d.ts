/// <reference types="cypress" />
import { BankAccountOptions, TestUserOptions } from './commands';

declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      /**
       * Login with email and password
       */
      login(email: string, password: string): void;

      /**
       * Create a test user
       */
      createTestUser(options?: Partial<TestUserOptions>): Chainable<string>;

      /**
       * Create a bank account
       */
      createBankAccount(token: string, options?: Partial<BankAccountOptions>): Chainable<Cypress.Response<any>>;

      /**
       * Clear test data from the database
       */
      clearTestData(): void;

      /**
       * Delete a bank account
       */
      deleteAccount(accountId: string): Chainable<Cypress.Response<any>>;

      /**
       * Test bank account connection
       */
      testConnection(accountId: string): Chainable<Cypress.Response<any>>;
    }
  }
}
