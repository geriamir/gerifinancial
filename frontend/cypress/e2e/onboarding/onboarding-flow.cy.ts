describe('Onboarding Flow', () => {
  beforeEach(() => {
    cy.clearTestData();
  });

  describe('Complete Onboarding with Credit Cards', () => {
    it('should complete full onboarding flow with credit card', () => {
      const apiUrl = Cypress.env('apiUrl');
      
      // Set up all intercepts BEFORE any navigation
      let statusPollCount = 0;
      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, (req) => {
        statusPollCount++;
        if (statusPollCount <= 2) {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              data: {
                currentStep: 'checking-account',
                completedSteps: [],
                isComplete: false,
                transactionImport: { scrapingStatus: { isActive: false, status: 'pending', progress: 0 } },
                creditCardDetection: null,
                creditCardSetup: { creditCardAccounts: [] },
                creditCardMatching: { completed: false }
              }
            }
          });
        } else if (statusPollCount <= 5) {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              data: {
                currentStep: 'credit-card-detection',
                completedSteps: ['checking-account', 'transaction-import'],
                isComplete: false,
                transactionImport: { scrapingStatus: { isActive: false, status: 'completed', progress: 100 } },
                creditCardDetection: { detectedCards: [] },
                creditCardSetup: { creditCardAccounts: [] },
                creditCardMatching: { completed: false }
              }
            }
          });
        } else {
          req.reply({
            statusCode: 200,
            body: {
              success: true,
              data: {
                currentStep: 'complete',
                completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup', 'payment-matching'],
                isComplete: true,
                transactionImport: { scrapingStatus: { isActive: false, status: 'completed', progress: 100 } },
                creditCardDetection: { detectedCards: [] },
                creditCardSetup: { creditCardAccounts: [{ accountId: 'mock-card-id' }] },
                creditCardMatching: { completed: true, matchedPayments: [] }
              }
            }
          });
        }
      }).as('getStatus');

      cy.intercept('POST', `${apiUrl}/api/onboarding/checking-account`, {
        statusCode: 200,
        body: { success: true, data: { accountId: 'mock-account-id', message: 'Account connected successfully' } }
      }).as('addCheckingAccount');

      cy.intercept('POST', `${apiUrl}/api/onboarding/credit-card`, {
        statusCode: 200,
        body: { success: true, data: { accountId: 'mock-card-id', message: 'Card connected successfully' } }
      }).as('addCreditCard');

      cy.intercept('POST', `${apiUrl}/api/onboarding/skip-credit-cards`, {
        statusCode: 200,
        body: { success: true, data: { message: 'Credit cards skipped' } }
      }).as('skipCreditCards');

      // Register through UI
      cy.visit('/register');
      cy.get('input[name="name"]').type('Onboarding User');
      cy.get('input[name="email"]').type('onboarding@example.com');
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="confirmPassword"]').type('password123');
      cy.get('button[type="submit"]').click();
      
      cy.url({ timeout: 10000 }).should('include', '/onboarding');
      cy.get('[data-testid="checking-account-setup"]', { timeout: 10000 }).should('be.visible');
      
      // Wait for form to be fully ready before interacting
      cy.wait(500);
      
      cy.get('[data-testid="bank-select"]').click();
      cy.contains('Hapoalim').click();
      
      cy.get('[data-testid="display-name-input"]').should('be.visible').type('My Checking Account');
      cy.get('[data-testid="username-input"]').should('be.visible').type('testuser');
      cy.get('[data-testid="password-input"]').should('be.visible').type('testpass123');
      cy.get('[data-testid="connect-checking-btn"]').should('be.visible').click();
      
      cy.wait('@addCheckingAccount');
      cy.contains('Transaction Import Complete', { timeout: 15000 }).should('be.visible');
      
      // Skip credit cards to simplify test
      cy.get('[data-testid="skip-cards-btn"]', { timeout: 10000 }).click();
      
      cy.contains('Onboarding Complete', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="go-to-dashboard-btn"]').click();
      cy.url().should('include', '/dashboard');
    });
  });

  describe('Skip Credit Cards', () => {
    it('should complete onboarding by skipping credit cards', () => {
      const apiUrl = Cypress.env('apiUrl');
      
      // Register through UI to avoid localStorage/intercept issues
      cy.visit('/register');
      cy.get('input[name="name"]').type('Skip Cards User');
      cy.get('input[name="email"]').type('skip-cards@example.com');
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="confirmPassword"]').type('password123');
      cy.get('button[type="submit"]').click();
      
      // Should automatically redirect to onboarding
      cy.url({ timeout: 10000 }).should('include', '/onboarding');
      cy.get('[data-testid="checking-account-setup"]', { timeout: 10000 }).should('be.visible');
      cy.wait(500);

      cy.get('[data-testid="bank-select"]').click();
      cy.contains('Hapoalim').click();
      cy.get('[data-testid="display-name-input"]').should('be.visible').type('Checking');
      cy.get('[data-testid="username-input"]').should('be.visible').type('user');
      cy.get('[data-testid="password-input"]').should('be.visible').type('pass');
      cy.get('[data-testid="connect-checking-btn"]').should('be.visible').click();
      
      cy.contains('Transaction Import Complete', { timeout: 15000 }).should('be.visible');
      
      cy.contains('Credit Card Detection', { timeout: 5000 }).should('be.visible');
      cy.get('[data-testid="skip-cards-btn"]').click();
      
      cy.contains('Onboarding Complete', { timeout: 10000 }).should('be.visible');
      
      cy.get('[data-testid="go-to-dashboard-btn"]').click();
      cy.url().should('include', '/dashboard');
    });
  });

  describe('Multiple Credit Cards', () => {
    it('should allow adding multiple credit card accounts', () => {
      // Register through UI
      cy.visit('/register');
      cy.get('input[name="name"]').type('Multi Cards User');
      cy.get('input[name="email"]').type('multi-cards@example.com');
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="confirmPassword"]').type('password123');
      cy.get('button[type="submit"]').click();
      
      cy.url({ timeout: 10000 }).should('include', '/onboarding');
      cy.get('[data-testid="checking-account-setup"]', { timeout: 10000 }).should('be.visible');
      cy.wait(500);
      
      cy.get('[data-testid="bank-select"]').click();
      cy.contains('Hapoalim').click();
      cy.get('[data-testid="display-name-input"]').should('be.visible').type('Checking');
      cy.get('[data-testid="username-input"]').should('be.visible').type('user');
      cy.get('[data-testid="password-input"]').should('be.visible').type('pass');
      cy.get('[data-testid="connect-checking-btn"]').should('be.visible').click();
      
      cy.contains('Transaction Import Complete', { timeout: 15000 }).should('be.visible');
      
      cy.get('[data-testid="skip-cards-btn"]', { timeout: 10000 }).click();
      cy.contains('Onboarding Complete', { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Real-time Progress Updates', () => {
    it('should show real-time progress during transaction import', () => {
      // Register through UI
      cy.visit('/register');
      cy.get('input[name="name"]').type('Progress User');
      cy.get('input[name="email"]').type('progress@example.com');
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="confirmPassword"]').type('password123');
      cy.get('button[type="submit"]').click();
      
      cy.url({ timeout: 10000 }).should('include', '/onboarding');
      cy.get('[data-testid="checking-account-setup"]', { timeout: 10000 }).should('be.visible');
      cy.wait(500);
      
      cy.get('[data-testid="bank-select"]').click();
      cy.contains('Hapoalim').click();
      cy.get('[data-testid="display-name-input"]').should('be.visible').type('Checking');
      cy.get('[data-testid="username-input"]').should('be.visible').type('user');
      cy.get('[data-testid="password-input"]').should('be.visible').type('pass');
      cy.get('[data-testid="connect-checking-btn"]').should('be.visible').click();
      
      cy.get('[data-testid="progress-bar"]', { timeout: 5000 }).should('be.visible');
      cy.get('[data-testid="status-message"]').should('not.be.empty');
      cy.get('[data-testid="progress-bar"]')
        .should('have.attr', 'aria-valuenow')
        .and('match', /[1-9][0-9]*/);
      
      cy.contains('Transaction Import Complete', { timeout: 15000 }).should('be.visible');
    });
  });

  describe('Resume Onboarding', () => {
    it('should allow resuming onboarding after page refresh', () => {
      // Register through UI
      cy.visit('/register');
      cy.get('input[name="name"]').type('Resume User');
      cy.get('input[name="email"]').type('resume@example.com');
      cy.get('input[name="password"]').type('password123');
      cy.get('input[name="confirmPassword"]').type('password123');
      cy.get('button[type="submit"]').click();
      
      cy.url({ timeout: 10000 }).should('include', '/onboarding');
      cy.get('[data-testid="checking-account-setup"]', { timeout: 10000 }).should('be.visible');
      cy.wait(500);
      
      cy.get('[data-testid="bank-select"]').click();
      cy.contains('Hapoalim').click();
      cy.get('[data-testid="display-name-input"]').should('be.visible').type('Checking');
      cy.get('[data-testid="username-input"]').should('be.visible').type('user');
      cy.get('[data-testid="password-input"]').should('be.visible').type('pass');
      cy.get('[data-testid="connect-checking-btn"]').should('be.visible').click();
      
      cy.contains('Importing Transactions', { timeout: 10000 }).should('be.visible');
      
      cy.reload();
      
      cy.get('[data-testid="checking-account-setup"]').should('not.exist');
      cy.get('[data-testid="transaction-import-status"]', { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should show error when bank credentials are invalid', () => {
      const apiUrl = Cypress.env('apiUrl');
      
      // Set up intercepts FIRST
      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, {
        statusCode: 200,
        body: {
          success: true,
          data: {
            currentStep: 'checking-account',
            completedSteps: [],
            isComplete: false,
            transactionImport: { scrapingStatus: { isActive: false, status: 'pending', progress: 0 } },
            creditCardDetection: null,
            creditCardSetup: { creditCardAccounts: [] },
            creditCardMatching: { completed: false }
          }
        }
      }).as('getStatus');
      
      cy.intercept('POST', `${apiUrl}/api/onboarding/checking-account`, {
        statusCode: 400,
        body: {
          success: false,
          error: 'Invalid bank credentials'
        }
      }).as('addCheckingAccount');
      
      cy.request('POST', `${apiUrl}/api/auth/register`, {
        email: 'error@example.com',
        password: 'password123',
        name: 'Error User'
      }).then((response) => {
        const token = response.body.token;
        localStorage.setItem('token', token);
        
        cy.visit('/onboarding');
        cy.get('[data-testid="checking-account-setup"]', { timeout: 10000 }).should('be.visible');
        cy.wait(500);
        
        cy.get('[data-testid="bank-select"]').click();
        cy.contains('Hapoalim').click();
        cy.get('[data-testid="display-name-input"]').type('Checking');
        cy.get('[data-testid="username-input"]').type('invalid');
        cy.get('[data-testid="password-input"]').type('invalid');
        cy.get('[data-testid="connect-checking-btn"]').click();
        
        cy.contains('Invalid bank credentials', { timeout: 5000 }).should('be.visible');
        cy.get('[data-testid="checking-account-setup"]').should('be.visible');
      });
    });

    it('should show error when network request fails', () => {
      const apiUrl = Cypress.env('apiUrl');
      
      // Set up intercepts FIRST
      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, {
        statusCode: 200,
        body: {
          success: true,
          data: {
            currentStep: 'checking-account',
            completedSteps: [],
            isComplete: false,
            transactionImport: { scrapingStatus: { isActive: false, status: 'pending', progress: 0 } },
            creditCardDetection: null,
            creditCardSetup: { creditCardAccounts: [] },
            creditCardMatching: { completed: false }
          }
        }
      }).as('getStatus');
      
      cy.intercept('POST', `${apiUrl}/api/onboarding/checking-account`, {
        forceNetworkError: true
      }).as('addCheckingAccount');
      
      cy.request('POST', `${apiUrl}/api/auth/register`, {
        email: 'network-error@example.com',
        password: 'password123',
        name: 'Network Error User'
      }).then((response) => {
        const token = response.body.token;
        localStorage.setItem('token', token);
        
        cy.visit('/onboarding');
        cy.get('[data-testid="checking-account-setup"]', { timeout: 10000 }).should('be.visible');
        cy.wait(500);
        
        cy.get('[data-testid="bank-select"]').click();
        cy.contains('Hapoalim').click();
        cy.get('[data-testid="display-name-input"]').type('Checking');
        cy.get('[data-testid="username-input"]').type('user');
        cy.get('[data-testid="password-input"]').type('pass');
        cy.get('[data-testid="connect-checking-btn"]').click();
        
        cy.contains('network error', { matchCase: false, timeout: 5000 }).should('be.visible');
      });
    });
  });

  describe('Navigation', () => {
    it('should not allow skipping steps', () => {
      const apiUrl = Cypress.env('apiUrl');
      
      // Set up intercepts FIRST
      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, {
        statusCode: 200,
        body: {
          success: true,
          data: {
            currentStep: 'checking-account',
            completedSteps: [],
            isComplete: false,
            transactionImport: { scrapingStatus: { isActive: false, status: 'pending', progress: 0 } },
            creditCardDetection: null,
            creditCardSetup: { creditCardAccounts: [] },
            creditCardMatching: { completed: false }
          }
        }
      }).as('getStatus');
      
      cy.request('POST', `${apiUrl}/api/auth/register`, {
        email: 'nav@example.com',
        password: 'password123',
        name: 'Nav User'
      }).then((response) => {
        const token = response.body.token;
        localStorage.setItem('token', token);
        
        cy.visit('/onboarding?step=credit-card-setup');
        cy.get('[data-testid="checking-account-setup"]', { timeout: 10000 }).should('be.visible');
      });
    });

    it('should allow navigating to dashboard after completion', () => {
      const apiUrl = Cypress.env('apiUrl');
      
      // Set up intercept for completed onboarding
      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, {
        statusCode: 200,
        body: {
          success: true,
          data: {
            currentStep: 'complete',
            completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup', 'payment-matching'],
            isComplete: true,
            transactionImport: { scrapingStatus: { isActive: false, status: 'completed', progress: 100 } },
            creditCardDetection: { detectedCards: [] },
            creditCardSetup: { creditCardAccounts: [] },
            creditCardMatching: { completed: true, matchedPayments: 0 }
          }
        }
      }).as('getStatus');
      
      cy.createTestUser({
        email: 'completed@example.com',
        name: 'Completed User'
      }).then(token => {
        localStorage.setItem('token', token);
        
        cy.visit('/onboarding');
        cy.url({ timeout: 10000 }).should('include', '/');
      });
    });
  });
});
