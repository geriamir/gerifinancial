describe('Login Flow', () => {
  beforeEach(() => {
    cy.clearTestData(); // Clear any previous test data
  });

  it('should offer GitHub as the only sign-in method', () => {
    cy.visit('/login');

    cy.get('[data-testid="github-login-button"]')
      .should('be.visible')
      .and('contain.text', 'Continue with GitHub')
      .and('have.attr', 'href')
      .and('include', '/api/auth/github/login');

    // Password auth is gone: nothing to type, and nothing to register.
    cy.get('input[name="password"]').should('not.exist');
    cy.get('input[name="email"]').should('not.exist');
    cy.contains('Register').should('not.exist');
  });

  it('should explain a cancelled sign-in', () => {
    cy.visit('/login?auth_error=access_denied');

    cy.contains('Sign-in was cancelled').should('be.visible');
  });

  it('should redirect unauthenticated visitors to login', () => {
    cy.visit('/');

    cy.url().should('include', '/login');
  });

  it('should maintain authentication state after refresh', () => {
    // The session cookie is set by the test-only seeding endpoint, standing in
    // for the GitHub callback that end-to-end tests cannot drive.
    cy.createTestUser({
      email: 'persist@example.com',
      name: 'Persist User'
    }).then(() => {
      cy.visit('/');

      cy.get('[data-testid="user-avatar"]', { timeout: 10000 })
        .should('be.visible')
        .and('contain.text', 'P');  // First letter of Persist User

      cy.reload();

      cy.get('[data-testid="user-avatar"]', { timeout: 10000 })
        .should('be.visible')
        .and('contain.text', 'P');
      cy.url().should('eq', 'http://localhost:3000/');
    });
  });

  it('should logout successfully', () => {
    cy.createTestUser({
      email: 'logout@example.com',
      name: 'Logout User'
    }).then(() => {
      cy.visit('/');

      cy.get('[data-testid="user-avatar"]', { timeout: 10000 }).should('be.visible').click();
      cy.get('.MuiMenu-paper').contains('Logout').click();

      cy.url().should('include', '/login');

      // The session cookie is cleared server-side, so protected routes bounce.
      cy.visit('/');
      cy.url().should('include', '/login');
    });
  });
});
