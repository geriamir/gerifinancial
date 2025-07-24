describe('Bank Accounts Management', () => {
  let authToken: string;

  beforeEach(() => {
    cy.clearTestData();
    // Create and login test user before each test
    cy.createTestUser({
      email: 'banktest@example.com',
      name: 'Bank Test User'
    }).then(token => {
      authToken = token;
      localStorage.setItem('token', token);
    });
  });

  it('should add a new bank account', () => {
    // Intercept API calls before visiting the page
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('getAccounts');
    cy.intercept('POST', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('addAccount');
    
    // Visit the page and wait for initial load
    cy.visit('/transactions?tab=bank-management');
    cy.wait('@getAccounts');

    // Click add bank account button
    cy.contains('Add Bank Account').click();

    // Fill in the bank account form
    // Open MUI Select dropdown
    cy.get('[role="combobox"]').click();
    // Select the 'Bank Hapoalim' option from the menu
    cy.get('[role="listbox"]').contains('Bank Hapoalim').click();
    cy.get('input[name="username"]').type('testuser');
    cy.get('input[name="password"]').type('bankpass123');
    cy.get('input[name="name"]').type('My Test Account');

    // Submit the form
    cy.contains('button', 'Add Account').click();

    // Wait for the add request and subsequent fetch
    cy.wait('@addAccount');
    cy.get('dialog').should('not.exist');
    cy.wait('@getAccounts');

    // Assert account appears in the list
    cy.contains('My Test Account')
      .parents('.MuiCard-root')
      .within(() => {
        cy.contains('Bank Hapoalim').should('be.visible');
      });
  });

  it('should display validation errors for invalid form submission', () => {
    // Intercept API calls before visiting the page
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('getAccounts');
    
    // Visit the page and wait for initial load
    cy.visit('/transactions?tab=bank-management');
    cy.wait('@getAccounts');

    cy.contains('Add Bank Account').click();

    // Submit empty form
    cy.contains('button', 'Add Account').click();

    // Check if form is still open (wasn't submitted due to validation)
    cy.get('form').should('exist');
    cy.contains('Add Bank Account').should('be.visible');

    // Check all inputs are marked as required
    cy.get('[name="bankId"]').should('have.attr', 'required');
    cy.get('input[name="username"]').should('have.attr', 'required');
    cy.get('input[name="password"]').should('have.attr', 'required');
    cy.get('input[name="name"]').should('have.attr', 'required');
  });

  it('should handle invalid bank credentials', () => {
    // Intercept API calls before visiting the page
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('getAccounts');
    cy.intercept('POST', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('addAccount');
    
    // Visit the page and wait for initial load
    cy.visit('/transactions?tab=bank-management');
    cy.wait('@getAccounts');

    cy.contains('Add Bank Account').click();

    // Fill in form with invalid credentials
    // Open MUI Select dropdown
    cy.get('[role="combobox"]').click();
    // Select the 'Bank Hapoalim' option from the menu
    cy.get('[role="listbox"]').contains('Bank Hapoalim').click();
    cy.get('input[name="username"]').type('invalid');
    cy.get('input[name="password"]').type('invalid123');
    cy.get('input[name="name"]').type('Invalid Account');

    // Intercept the API call
    cy.intercept('POST', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('addAccount');

    // Submit form
    cy.contains('button', 'Add Account').click();

    // Wait for error response
    cy.wait('@addAccount');

    // Assert error message from backend
    cy.contains('Invalid bank credentials').should('be.visible');
  });

  it('should list bank accounts', () => {
    // Intercept API call before visiting the page
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('getAccounts');

    // Add test accounts
    cy.createBankAccount(authToken, {
      bankId: 'hapoalim',
      name: 'Personal Account',
      username: 'testuser',
      password: 'bankpass123'
    });

    cy.createBankAccount(authToken, {
      bankId: 'leumi',
      name: 'Business Account',
      username: 'testuser',
      password: 'bankpass123'
    });

    // Visit page and wait for accounts to load
    cy.visit('/transactions?tab=bank-management');
    cy.wait('@getAccounts');

    // Assert accounts are listed
    cy.contains('Personal Account').should('be.visible');
    cy.contains('Business Account').should('be.visible');
    cy.contains('Bank Hapoalim').should('be.visible');
    cy.contains('Bank Leumi').should('be.visible');
  });

  it('should delete a bank account', () => {
    // Intercept API calls
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('getAccounts');
    cy.intercept('DELETE', `${Cypress.env('apiUrl')}/api/bank-accounts/*`).as('deleteAccount');

    // Add test account
    cy.createBankAccount(authToken, {
      bankId: 'hapoalim',
      name: 'Account to Delete',
      username: 'testuser',
      password: 'bankpass123'
    });

    cy.visit('/transactions?tab=bank-management');
    cy.wait('@getAccounts');

    // Set up confirmation dialog handler
    cy.on('window:confirm', () => true);

    // Intercept delete request
    cy.intercept('DELETE', `${Cypress.env('apiUrl')}/api/bank-accounts/*`).as('deleteAccount');

    // Find and click delete button for the account
    cy.contains('Account to Delete')
      .parents('.MuiCard-root')
      .within(() => {
        cy.get('[title="Delete Account"]').click();
      });

    // Wait for server response
    cy.wait('@deleteAccount');

    // Assert account was removed from the list
    cy.contains('Account to Delete').should('not.exist');
  });

  it('should handle connection test', () => {
    // Intercept API calls
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`).as('getAccounts');
    cy.intercept('POST', `${Cypress.env('apiUrl')}/api/bank-accounts/*/test`).as('testConnection');

    // Add test account
    cy.createBankAccount(authToken, {
      bankId: 'hapoalim',
      name: 'Test Connection Account',
      username: 'testuser',
      password: 'bankpass123'
    });

    cy.visit('/transactions?tab=bank-management');
    cy.wait('@getAccounts');

    // Find and click test connection button
    cy.contains('Test Connection Account')
      .parents('.MuiCard-root')
      .within(() => {
        cy.get('[title="Test Connection"]')
          .click();
      });

    // Wait for test and refresh to complete
    cy.wait('@testConnection');
    cy.wait('@getAccounts');

    // Assert connection test updates account status
    cy.contains('Test Connection Account')
      .parents('.MuiCard-root')
      .within(() => {
        cy.contains('active').should('be.visible');
      });
  });

  it('should handle network errors gracefully', () => {
    // Simulate offline state
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`, {
      forceNetworkError: true
    }).as('failedRequest');

    cy.visit('/transactions?tab=bank-management');
    cy.wait('@failedRequest');

    // Assert error message
    cy.contains('Failed to load bank accounts').should('be.visible');
  });
});
