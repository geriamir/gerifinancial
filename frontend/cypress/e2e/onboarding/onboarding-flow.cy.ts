describe('Onboarding Flow', () => {
  beforeEach(() => {
    cy.clearTestData();
  });

  describe('Complete Onboarding with Credit Cards', () => {
    it('should complete full onboarding flow with credit card', () => {
      const apiUrl = Cypress.env('apiUrl');
      let onboardingStep = 'checking-account';

      const stepData: Record<string, any> = {
        'checking-account': {
          currentStep: 'checking-account', completedSteps: [], isComplete: false,
          checkingAccount: { connected: false, accountId: null, connectedAt: null, bankId: null },
          transactionImport: { completed: false, transactionsImported: 0, completedAt: null, scrapingStatus: { isActive: false, status: 'pending', progress: 0, message: null, error: null } },
          creditCardDetection: { analyzed: false, analyzedAt: null, transactionCount: 0, recommendation: null, sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        },
        'credit-card-detection': {
          currentStep: 'credit-card-detection', completedSteps: ['checking-account', 'transaction-import'], isComplete: false,
          checkingAccount: { connected: true, accountId: 'mock-id', connectedAt: new Date().toISOString(), bankId: 'hapoalim' },
          transactionImport: { completed: true, transactionsImported: 42, completedAt: new Date().toISOString(), scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null } },
          creditCardDetection: { analyzed: true, analyzedAt: new Date().toISOString(), transactionCount: 0, recommendation: 'skip', sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        },
        'complete': {
          currentStep: 'complete', completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup', 'credit-card-matching'], isComplete: true,
          checkingAccount: { connected: true, accountId: 'mock-id', connectedAt: new Date().toISOString(), bankId: 'hapoalim' },
          transactionImport: { completed: true, transactionsImported: 42, completedAt: new Date().toISOString(), scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null } },
          creditCardDetection: { analyzed: true, analyzedAt: new Date().toISOString(), transactionCount: 0, recommendation: 'skip', sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [], skipped: true, skippedAt: new Date().toISOString() },
          creditCardMatching: { completed: true, completedAt: new Date().toISOString(), totalCreditCardPayments: 0, coveredPayments: 0, uncoveredPayments: 0, coveragePercentage: 0, matchedPayments: [] }
        }
      };

      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, (req) => {
        req.reply({ statusCode: 200, body: { success: true, data: stepData[onboardingStep] || stepData['checking-account'] } });
      }).as('getStatus');

      cy.intercept('POST', `${apiUrl}/api/onboarding/checking-account`, (req) => {
        onboardingStep = 'credit-card-detection';
        req.reply({ statusCode: 200, body: { success: true, data: { accountId: 'mock-account-id', message: 'Account connected successfully' } } });
      }).as('addCheckingAccount');

      cy.intercept('POST', `${apiUrl}/api/onboarding/skip-credit-cards`, (req) => {
        onboardingStep = 'complete';
        req.reply({ statusCode: 200, body: { success: true, data: { message: 'Credit cards skipped' } } });
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
      cy.wait(500);
      
      cy.get('[data-testid="bank-select"]').click();
      cy.contains('Hapoalim').click();
      cy.get('[data-testid="display-name-input"]').should('be.visible').type('My Checking Account');
      cy.get('[data-testid="username-input"]').should('be.visible').type('testuser');
      cy.get('[data-testid="password-input"]').should('be.visible').type('testpass123');
      cy.get('[data-testid="connect-checking-btn"]').should('be.visible').click();
      
      cy.wait('@addCheckingAccount');
      
      // After connecting, wizard advances to credit card detection via status refetch
      cy.get('[data-testid="skip-cards-btn"]', { timeout: 15000 }).should('be.visible').click();
      cy.wait('@skipCreditCards');
      
      cy.contains('Onboarding Complete', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="go-to-dashboard-btn"]').click();
      cy.url().should('not.include', '/onboarding');
    });
  });

  describe('Skip Credit Cards', () => {
    it('should complete onboarding by skipping credit cards', () => {
      const apiUrl = Cypress.env('apiUrl');
      let onboardingStep = 'checking-account';

      const stepData: Record<string, any> = {
        'checking-account': {
          currentStep: 'checking-account', completedSteps: [], isComplete: false,
          checkingAccount: { connected: false, accountId: null, connectedAt: null, bankId: null },
          transactionImport: { completed: false, transactionsImported: 0, completedAt: null, scrapingStatus: { isActive: false, status: 'pending', progress: 0, message: null, error: null } },
          creditCardDetection: { analyzed: false, analyzedAt: null, transactionCount: 0, recommendation: null, sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        },
        'credit-card-detection': {
          currentStep: 'credit-card-detection', completedSteps: ['checking-account', 'transaction-import'], isComplete: false,
          checkingAccount: { connected: true, accountId: 'mock-id', connectedAt: new Date().toISOString(), bankId: 'hapoalim' },
          transactionImport: { completed: true, transactionsImported: 42, completedAt: new Date().toISOString(), scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null } },
          creditCardDetection: { analyzed: true, analyzedAt: new Date().toISOString(), transactionCount: 0, recommendation: 'skip', sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        },
        'complete': {
          currentStep: 'complete', completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup', 'credit-card-matching'], isComplete: true,
          checkingAccount: { connected: true, accountId: 'mock-id', connectedAt: new Date().toISOString(), bankId: 'hapoalim' },
          transactionImport: { completed: true, transactionsImported: 42, completedAt: new Date().toISOString(), scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null } },
          creditCardDetection: { analyzed: true, analyzedAt: new Date().toISOString(), transactionCount: 0, recommendation: 'skip', sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [], skipped: true, skippedAt: new Date().toISOString() },
          creditCardMatching: { completed: true, completedAt: new Date().toISOString(), totalCreditCardPayments: 0, coveredPayments: 0, uncoveredPayments: 0, coveragePercentage: 0, matchedPayments: [] }
        }
      };

      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, (req) => {
        req.reply({ statusCode: 200, body: { success: true, data: stepData[onboardingStep] || stepData['checking-account'] } });
      }).as('getStatus');

      cy.intercept('POST', `${apiUrl}/api/onboarding/checking-account`, (req) => {
        onboardingStep = 'credit-card-detection';
        req.reply({ statusCode: 200, body: { success: true, data: { accountId: 'mock-account-id', message: 'Account connected' } } });
      }).as('addCheckingAccount');

      cy.intercept('POST', `${apiUrl}/api/onboarding/skip-credit-cards`, (req) => {
        onboardingStep = 'complete';
        req.reply({ statusCode: 200, body: { success: true, data: { message: 'Credit cards skipped' } } });
      }).as('skipCreditCards');

      // Register through UI
      cy.visit('/register');
      cy.get('input[name="name"]').type('Skip Cards User');
      cy.get('input[name="email"]').type('skip-cards@example.com');
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
      cy.wait('@addCheckingAccount');
      
      // After connecting, skip credit cards
      cy.get('[data-testid="skip-cards-btn"]', { timeout: 15000 }).should('be.visible').click();
      cy.wait('@skipCreditCards');
      
      cy.contains('Onboarding Complete', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="go-to-dashboard-btn"]').click();
      cy.url().should('not.include', '/onboarding');
    });
  });

  describe('Multiple Credit Cards', () => {
    it('should allow adding multiple credit card accounts', () => {
      const apiUrl = Cypress.env('apiUrl');
      let onboardingStep = 'checking-account';

      const stepData: Record<string, any> = {
        'checking-account': {
          currentStep: 'checking-account', completedSteps: [], isComplete: false,
          checkingAccount: { connected: false, accountId: null, connectedAt: null, bankId: null },
          transactionImport: { completed: false, transactionsImported: 0, completedAt: null, scrapingStatus: { isActive: false, status: 'pending', progress: 0, message: null, error: null } },
          creditCardDetection: { analyzed: false, analyzedAt: null, transactionCount: 0, recommendation: null, sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        },
        'credit-card-detection': {
          currentStep: 'credit-card-detection', completedSteps: ['checking-account', 'transaction-import'], isComplete: false,
          checkingAccount: { connected: true, accountId: 'mock-id', connectedAt: new Date().toISOString(), bankId: 'hapoalim' },
          transactionImport: { completed: true, transactionsImported: 42, completedAt: new Date().toISOString(), scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null } },
          creditCardDetection: { analyzed: true, analyzedAt: new Date().toISOString(), transactionCount: 0, recommendation: 'skip', sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        },
        'complete': {
          currentStep: 'complete', completedSteps: ['checking-account', 'transaction-import', 'credit-card-detection', 'credit-card-setup', 'credit-card-matching'], isComplete: true,
          checkingAccount: { connected: true, accountId: 'mock-id', connectedAt: new Date().toISOString(), bankId: 'hapoalim' },
          transactionImport: { completed: true, transactionsImported: 42, completedAt: new Date().toISOString(), scrapingStatus: { isActive: false, status: 'complete', progress: 100, message: null, error: null } },
          creditCardDetection: { analyzed: true, analyzedAt: new Date().toISOString(), transactionCount: 0, recommendation: 'skip', sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [], skipped: true, skippedAt: new Date().toISOString() },
          creditCardMatching: { completed: true, completedAt: new Date().toISOString(), totalCreditCardPayments: 0, coveredPayments: 0, uncoveredPayments: 0, coveragePercentage: 0, matchedPayments: [] }
        }
      };

      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, (req) => {
        req.reply({ statusCode: 200, body: { success: true, data: stepData[onboardingStep] || stepData['checking-account'] } });
      }).as('getStatus');

      cy.intercept('POST', `${apiUrl}/api/onboarding/checking-account`, (req) => {
        onboardingStep = 'credit-card-detection';
        req.reply({ statusCode: 200, body: { success: true, data: { accountId: 'mock-account-id', message: 'Account connected' } } });
      }).as('addCheckingAccount');

      cy.intercept('POST', `${apiUrl}/api/onboarding/skip-credit-cards`, (req) => {
        onboardingStep = 'complete';
        req.reply({ statusCode: 200, body: { success: true, data: { message: 'Credit cards skipped' } } });
      }).as('skipCreditCards');

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
      cy.wait('@addCheckingAccount');
      
      cy.get('[data-testid="skip-cards-btn"]', { timeout: 15000 }).should('be.visible').click();
      cy.wait('@skipCreditCards');
      cy.contains('Onboarding Complete', { timeout: 10000 }).should('be.visible');
    });
  });

  describe('Real-time Progress Updates', () => {
    it('should show real-time progress during transaction import', () => {
      const apiUrl = Cypress.env('apiUrl');
      let onboardingStep = 'checking-account';

      const stepData: Record<string, any> = {
        'checking-account': {
          currentStep: 'checking-account', completedSteps: [], isComplete: false,
          checkingAccount: { connected: false, accountId: null, connectedAt: null, bankId: null },
          transactionImport: { completed: false, transactionsImported: 0, completedAt: null, scrapingStatus: { isActive: false, status: 'pending', progress: 0, message: null, error: null } },
          creditCardDetection: { analyzed: false, analyzedAt: null, transactionCount: 0, recommendation: null, sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        },
        'transaction-import': {
          currentStep: 'transaction-import', completedSteps: ['checking-account'], isComplete: false,
          checkingAccount: { connected: true, accountId: 'mock-id', connectedAt: new Date().toISOString(), bankId: 'hapoalim' },
          transactionImport: { completed: false, transactionsImported: 0, completedAt: null, scrapingStatus: { isActive: true, status: 'scraping', progress: 45, message: 'Importing transactions...', error: null } },
          creditCardDetection: { analyzed: false, analyzedAt: null, transactionCount: 0, recommendation: null, sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        }
      };

      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, (req) => {
        req.reply({ statusCode: 200, body: { success: true, data: stepData[onboardingStep] || stepData['checking-account'] } });
      }).as('getStatus');

      cy.intercept('POST', `${apiUrl}/api/onboarding/checking-account`, (req) => {
        onboardingStep = 'transaction-import';
        req.reply({ statusCode: 200, body: { success: true, data: { accountId: 'mock-account-id', message: 'Account connected' } } });
      }).as('addCheckingAccount');

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
      cy.wait('@addCheckingAccount');
      
      // Verify progress UI elements during import
      cy.get('[data-testid="progress-bar"]', { timeout: 10000 }).should('be.visible');
      cy.get('[data-testid="status-message"]').should('be.visible').and('not.be.empty');
      cy.get('[data-testid="transaction-import-status"]').should('be.visible');
    });
  });

  describe('Resume Onboarding', () => {
    it('should allow resuming onboarding after page refresh', () => {
      const apiUrl = Cypress.env('apiUrl');
      let onboardingStep = 'checking-account';

      const stepData: Record<string, any> = {
        'checking-account': {
          currentStep: 'checking-account', completedSteps: [], isComplete: false,
          checkingAccount: { connected: false, accountId: null, connectedAt: null, bankId: null },
          transactionImport: { completed: false, transactionsImported: 0, completedAt: null, scrapingStatus: { isActive: false, status: 'pending', progress: 0, message: null, error: null } },
          creditCardDetection: { analyzed: false, analyzedAt: null, transactionCount: 0, recommendation: null, sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        },
        'transaction-import': {
          currentStep: 'transaction-import', completedSteps: ['checking-account'], isComplete: false,
          checkingAccount: { connected: true, accountId: 'mock-id', connectedAt: new Date().toISOString(), bankId: 'hapoalim' },
          transactionImport: { completed: false, transactionsImported: 0, completedAt: null, scrapingStatus: { isActive: true, status: 'scraping', progress: 30, message: 'Importing transactions...', error: null } },
          creditCardDetection: { analyzed: false, analyzedAt: null, transactionCount: 0, recommendation: null, sampleTransactions: [] },
          creditCardSetup: { creditCardAccounts: [] },
          creditCardMatching: { completed: false }
        }
      };

      cy.intercept('GET', `${apiUrl}/api/onboarding/status`, (req) => {
        req.reply({ statusCode: 200, body: { success: true, data: stepData[onboardingStep] || stepData['checking-account'] } });
      }).as('getStatus');

      cy.intercept('POST', `${apiUrl}/api/onboarding/checking-account`, (req) => {
        onboardingStep = 'transaction-import';
        req.reply({ statusCode: 200, body: { success: true, data: { accountId: 'mock-account-id', message: 'Account connected' } } });
      }).as('addCheckingAccount');

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
      cy.wait('@addCheckingAccount');
      
      // Verify import is shown
      cy.contains('Importing Transactions', { timeout: 10000 }).should('be.visible');
      
      // Reload page
      cy.reload();
      
      // After reload, should still be on onboarding with import status visible
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
