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
      cy.visit('/dashboard');
    });
  });

  it('should add a new bank account', () => {
    // Click add bank account button
    cy.contains('Add Bank Account').click();

    // Fill in the bank account form
    cy.get('select[name="bankId"]').select('hapoalim');
    cy.get('input[name="accountNumber"]').type('123456');
    cy.get('input[name="username"]').type('testuser');
    cy.get('input[name="password"]').type('bankpass123');
    cy.get('input[name="nickname"]').type('My Test Account');

    // Submit the form
    cy.get('button[type="submit"]').click();

    // Assert account was added
    cy.contains('My Test Account').should('be.visible');
    cy.contains('Bank Hapoalim').should('be.visible');
    cy.contains('Account added successfully').should('be.visible');
  });

  it('should display validation errors for invalid form submission', () => {
    cy.contains('Add Bank Account').click();

    // Submit empty form
    cy.get('button[type="submit"]').click();

    // Assert validation errors
    cy.contains('Bank is required').should('be.visible');
    cy.contains('Account number is required').should('be.visible');
    cy.contains('Username is required').should('be.visible');
    cy.contains('Password is required').should('be.visible');
    cy.contains('Nickname is required').should('be.visible');
  });

  it('should handle invalid bank credentials', () => {
    cy.contains('Add Bank Account').click();

    // Fill in form with invalid credentials
    cy.get('select[name="bankId"]').select('hapoalim');
    cy.get('input[name="accountNumber"]').type('999999');
    cy.get('input[name="username"]').type('invalid');
    cy.get('input[name="password"]').type('invalid123');
    cy.get('input[name="nickname"]').type('Invalid Account');

    cy.get('button[type="submit"]').click();

    // Assert error message
    cy.contains('Invalid bank credentials').should('be.visible');
  });

  it('should list bank accounts', () => {
    // Add test accounts
    cy.createBankAccount(authToken, {
      bankId: 'hapoalim',
      accountNumber: '123456',
      username: 'testuser1',
      password: 'pass123',
      nickname: 'Personal Account'
    });

    cy.createBankAccount(authToken, {
      bankId: 'leumi',
      accountNumber: '789012',
      username: 'testuser2',
      password: 'pass123',
      nickname: 'Business Account'
    });

    // Refresh page to see new accounts
    cy.reload();

    // Assert accounts are listed
    cy.contains('Personal Account').should('be.visible');
    cy.contains('Business Account').should('be.visible');
    cy.contains('Bank Hapoalim').should('be.visible');
    cy.contains('Bank Leumi').should('be.visible');
  });

  it('should delete a bank account', () => {
    // Add test account
    cy.createBankAccount(authToken, {
      bankId: 'hapoalim',
      accountNumber: '123456',
      username: 'testuser',
      password: 'pass123',
      nickname: 'Account to Delete'
    });

    cy.reload();

    // Find and click delete button for the account
    cy.contains('Account to Delete')
      .parent()
      .find('[aria-label="Delete account"]')
      .click();

    // Confirm deletion in dialog
    cy.contains('Yes, delete').click();

    // Assert account was deleted
    cy.contains('Account deleted successfully').should('be.visible');
    cy.contains('Account to Delete').should('not.exist');
  });

  it('should handle connection test', () => {
    // Add test account
    cy.createBankAccount(authToken, {
      bankId: 'hapoalim',
      accountNumber: '123456',
      username: 'testuser',
      password: 'pass123',
      nickname: 'Test Connection Account'
    });

    cy.reload();

    // Find and click test connection button
    cy.contains('Test Connection Account')
      .parent()
      .find('[aria-label="Test connection"]')
      .click();

    // Assert connection test result
    cy.contains('Connection test successful').should('be.visible');
  });

  it('should handle network errors gracefully', () => {
    // Simulate offline state
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/bank-accounts`, {
      forceNetworkError: true
    });

    cy.reload();

    // Assert error message
    cy.contains('Error loading bank accounts').should('be.visible');
  });
});
