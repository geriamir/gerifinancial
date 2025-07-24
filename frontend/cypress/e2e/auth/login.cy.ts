describe('Login Flow', () => {
  beforeEach(() => {
    cy.clearTestData(); // Clear any previous test data
    cy.visit('/');
  });

  it('should successfully log in with valid credentials', () => {
    // Create test user and get token
    cy.createTestUser();
    
    // Visit login page
    cy.visit('/login');

    // Fill in login form
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    // Assert successful login
    cy.url().should('include', '/overview');
    
    // Wait for the avatar to appear in the AppBar and verify user is logged in
    cy.get('[data-testid="user-avatar"]', { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', 'T');  // First letter of Test User
  });

  it('should show error with invalid credentials', () => {
    cy.visit('/login');

    // Fill in login form with incorrect password
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    // Assert error message
    cy.contains('Invalid email or password').should('be.visible');
    cy.url().should('include', '/login');
  });

  it('should validate required fields', () => {
    cy.visit('/login');

    // Try to submit empty form
    cy.get('button[type="submit"]').click();

    // Assert validation messages
    cy.contains('Email is required').should('be.visible');
    cy.contains('Password is required').should('be.visible');
  });

  it('should navigate to registration page', () => {
    cy.visit('/login');
    
    // Click register link
    cy.contains('Register').click();
    
    // Assert navigation to register page
    cy.url().should('include', '/register');
  });

  it('should maintain authentication state after refresh', () => {
    // Create test user and login
    cy.createTestUser({
      email: 'persist@example.com',
      name: 'Persist User'
    }).then(token => {
      localStorage.setItem('token', token);
      
      // Visit protected route
      cy.visit('/overview');
      
      // Assert we're logged in
      cy.get('[data-testid="user-avatar"]', { timeout: 10000 })
        .should('be.visible')
        .and('contain.text', 'P');  // First letter of Persist User
      
      // Refresh page
      cy.reload();
      
      // Assert we're still logged in
      cy.get('[data-testid="user-avatar"]', { timeout: 10000 })
        .should('be.visible')
        .and('contain.text', 'P');
      cy.url().should('include', '/overview');
    });
  });

  it('should logout successfully', () => {
    // Create test user and login
    cy.createTestUser({
      email: 'logout@example.com',
      name: 'Logout User'
    }).then(token => {
      localStorage.setItem('token', token);
      cy.visit('/overview');
      
      // Open user menu and click logout
      cy.get('[data-testid="user-avatar"]', { timeout: 10000 }).should('be.visible').click();
      cy.get('.MuiMenu-paper').contains('Logout').click();
      
      // Assert we're logged out and redirected
      cy.url().should('include', '/login');
      
      // Try to visit protected route
      cy.visit('/overview');
      
      // Assert we're redirected to login
      cy.url().should('include', '/login');
    });
  });
});
