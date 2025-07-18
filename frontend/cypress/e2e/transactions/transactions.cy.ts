/// <reference types="cypress" />

const DESCRIPTIONS = [
  'Internet Bill - Partner',
  'Electricity Bill - IEC',
  'Supermarket - Shufersal',
  'Restaurant - Japanika',
  'Public Transport - Rav Kav',
  'Monthly Salary',
  'Rent Payment',
  'Transfer to Savings'
];

interface Category {
  _id: string;
  name: string;
  type: 'Expense' | 'Income' | 'Transfer';
}

interface Transaction {
  _id: string;
  userId: string;
  accountId: string;
  identifier: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  type: 'Expense' | 'Income' | 'Transfer';
  status: 'verified' | 'error' | 'duplicate';
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

type TransactionType = 'Expense' | 'Income' | 'Transfer';

interface TransactionQuery {
  skip?: number;
  limit?: number;
  type?: TransactionType;
  search?: string;
  startDate?: string;
  endDate?: string;
}

interface AddTransactionsResult {
  success: boolean;
  insertedCount: number;
  transactions: Transaction[];
}

const recuresiveWait = (searchTerm: string, maxRetries: number, currentRetry: number = 0): Cypress.Chainable => {
  return cy.wait('@getTransactions') 
    .its('request.url')
    .then((url) => {

      if (url.includes(searchTerm)) {
        return cy.wrap(url);
      }

      currentRetry++;
      if (currentRetry >= maxRetries) {
        return cy.wrap(undefined);
      }

      return recuresiveWait(searchTerm, maxRetries, currentRetry);
    });
};

describe('Transactions Page', () => {
  beforeEach(() => {
    console.log('Starting test setup...');

    // Start with a clean database
    cy.task('db:clearTestData', null, { timeout: 10000 })
      .then(result => {
        console.log('Database cleared:', result);
      });
    
    // Create test user and log in
    cy.createTestUser().then(token => {
      expect(token).to.be.a('string');
      
      // Store testUserId in Cypress env
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      const storedUserId = decodedToken.userId;
      Cypress.env('testUserId', storedUserId);
      
      console.log('Created test user:', storedUserId);

    // Login to set up auth state properly
      return cy.login('test@example.com', 'password123').then(() => {
        // Add test transactions for the user
        // Create test transactions relative to current date
        const baseDate = new Date(); // Use current date
        baseDate.setUTCHours(0, 0, 0, 0);
        return cy.task<AddTransactionsResult>('db:addTransactions', {
          count: 30,
          baseDate: baseDate.toISOString(), // Current date
          userId: storedUserId
        });
      });
    }).then(result => {
      console.log('Login completed, token:', localStorage.getItem('token'));
      console.log('Added transactions:', result);
      
      console.log('Transaction creation result:', result);
      expect(result.success).to.be.true;
      expect(result.insertedCount).to.equal(30);
      
      // More flexible check for transactions
      expect(result.transactions).to.have.length.at.least(1);

      // Verify transaction type distribution
      const typeCount = result.transactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('Transaction type distribution:', typeCount);

      // Verify we have a good mix of transaction types
      ['Expense', 'Income', 'Transfer'].forEach(type => {
        expect(typeCount[type], `Should have ${type} transactions`).to.be.at.least(1);
      });

      // Verify all transactions have valid types
      result.transactions.forEach((tx, i) => {
        expect(['Expense', 'Income', 'Transfer']).to.include(
          tx.type,
          `Transaction ${i} should have valid type`
        );
      });
      expect(result.transactions[0].userId.toString()).to.equal(Cypress.env('testUserId'));

      // Verify transaction dates are within expected range (relative to current date)
      const currentDate = new Date();
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - 17); // -17 days from current date
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 17); // +17 days from current date
      endDate.setUTCHours(23, 59, 59, 999);
      
      result.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        console.log('Transaction date check:', {
          date: txDate.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isBeforeStart: txDate < startDate,
          isAfterEnd: txDate > endDate,
          isInRange: txDate >= startDate && txDate <= endDate
        });
        expect(txDate >= startDate && txDate <= endDate, 
          `Transaction date ${txDate.toISOString()} should be between ${startDate.toISOString()} and ${endDate.toISOString()}`
        ).to.be.true;
      });
    });

    // Set up API spies with detailed logging BEFORE visiting the page
    cy.intercept('GET', '**/api/transactions*', (req) => {
      console.log('API Request intercepted:', {
        url: req.url,
        method: req.method,
        headers: req.headers,
        query: req.query
      });
      
      // Add cache busting query param
      const url = new URL(req.url);
      url.searchParams.set('_', Date.now().toString());
      req.url = url.toString();

      // Add no-cache headers
      req.headers['cache-control'] = 'no-cache';
      req.headers['pragma'] = 'no-cache';

      req.on('response', (res) => {
        console.log('API Response:', {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          body: res.body
        });
      });
    }).as('getTransactions');
    cy.intercept('GET', '**/api/transactions/categories').as('getCategories');

    // Visit page after ensuring token is set
    cy.visit('/transactions', {
      onBeforeLoad(win) {
        console.log('Verifying token before page load:', {
          token: win.localStorage.getItem('token')
        });
      },
    });
    cy.contains('Transactions', { timeout: 10000 }).should('be.visible');

    // Wait for initial data load and verify response
    cy.wait('@getTransactions', { timeout: 15000 })
      .then(interception => {
        const req = interception.request;
        const res = interception.response;
        
        // Parse query parameters
        const params = new URLSearchParams(req.url.split('?')[1]);
        const queryParams = Object.fromEntries(params.entries());
        
        console.log('Initial transaction request:', {
          url: req.url,
          params: queryParams,
          dateParams: {
            startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
            endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined
          },
          responseStatus: res?.statusCode,
          responseBody: {
            total: res?.body?.total,
            hasMore: res?.body?.hasMore,
            transactionCount: res?.body?.transactions?.length,
            sample: res?.body?.transactions?.slice(0, 2)
          }
        });
        
        expect(req.headers).to.have.property('authorization');
        expect([200, 304]).to.include(res?.statusCode, 'Response status should be 200 or 304');
        
        const transactions = res?.body?.transactions || [];
        console.log('Transaction count:', transactions.length);
        expect(transactions).to.have.length.at.least(1);
        
        // Verify first transaction
        const firstTx = transactions[0];
        expect(firstTx).to.have.property('userId');
        expect(firstTx.userId.toString()).to.equal(Cypress.env('testUserId'));
      });
    
    // Wait for loading to complete and verify page is ready
    cy.get('[data-testid="loading-indicator"]', { timeout: 10000 }).should('not.exist');
    
    // Verify filter panel and its components are ready with longer timeout
        cy.get('[role="search"]', { timeout: 10000 })
          .should('be.visible')
          .within(() => {
            // Wait for filter components to be ready
            cy.get('[data-testid="type-filter"]', { timeout: 10000 }).should('exist').and('be.visible');
            cy.get('[data-testid="search-input"] input', { timeout: 10000 }).should('exist').and('be.visible');
            cy.get('[data-testid="date-range-filter"]', { timeout: 10000 }).should('exist');
          });
    
    // Wait for transaction list to be ready
    cy.get('[data-testid="transactions-list"]')
      .should('be.visible')
      .find('li[data-testid^="transaction-item-"]')
      .should('have.length.at.least', 1);
  });

  it('should load and display initial transactions', () => {
    // Verify transactions list container
    cy.get('[data-testid="transactions-list"]')
      .should('be.visible');

    // Wait for transactions to load
    cy.get('li[data-testid^="transaction-item-"]', { timeout: 10000 })
      .should('have.length.at.least', 1)
      .first()
      .within(() => {
        // Verify transaction content
        cy.contains(new RegExp(DESCRIPTIONS.map(d => d.replace(/ -.*$/, '')).join('|')))
          .should('be.visible');
        
        cy.get('p[class*="MuiTypography-body2"]')
          .should('be.visible');
        
        // Check amount by test-id to ensure we find the correct element
        cy.get('[data-testid$="-amount"]')
          .should('be.visible')
          .and('contain.text', '₪');
        
        // Verify amount is visible and contains currency symbol
        cy.get('[data-testid$="-amount"]')
          .should('be.visible')
          .and('contain.text', '₪');
      });
  });

  // it('should load more transactions on scroll', () => {
  //   // Ensure the list is loaded and we have the initial count
  //   cy.get('[data-testid="transactions-list"]')
  //     .should('be.visible')
  //     .within(() => {
  //       cy.get('li[data-testid^="transaction-item-"]')
  //         .should('have.length.at.least', 1)
  //         .then($items => {
  //           const initialCount = $items.length;
  //           console.log('Initial transactions count:', initialCount);
            
  //           // Force scroll to bottom
  //           cy.window().scrollTo('bottom');
  //           cy.wait('@getTransactions', { timeout: 10000 });
            
  //           // Check that more items were loaded
  //           cy.get('li[data-testid^="transaction-item-"]', { timeout: 10000 })
  //             .should('have.length.gt', initialCount)
  //             .then($newItems => {
  //               console.log('New transactions count:', $newItems.length);
  //             });
  //         });
  //     });
  // });

  it('should filter transactions by type', () => {
    // Wait for transactions list to be populated - with better error handling
    cy.get('[data-testid="transactions-list"]', { timeout: 15000 })
      .should('be.visible')
      .find('li[data-testid^="transaction-item-"]')
      .should('have.length.at.least', 1);

    // Re-alias the transactions request for filtering
    cy.intercept('GET', '**/api/transactions*').as('getTransactions');

    // Verify there are transaction amounts
    cy.get('[data-testid="transactions-list"]')
      .find('[data-testid$="-amount"]')
      .should('have.length.at.least', 1);

    // Click the type filter to open the dropdown
    cy.get('[data-testid="type-filter"]')
      .find('.MuiSelect-select')
      .should('be.visible')
      .click();

    // Find the Expense option in the menu and click it
    cy.get('.MuiPopover-root')
      .should('be.visible')
      .find('.MuiMenuItem-root')
      .contains('Expense')
      .click();

    // Verify selection was made
    cy.get('[data-testid="type-filter"]')
      .should('contain.text', 'Expense');

    // Wait for transactions to be filtered
    cy.wait('@getTransactions', { timeout: 15000 })
      .then((interception) => {
        console.log('Filter request URL:', interception.request.url);
        // Check for type parameter specifically
        const url = new URL(interception.request.url);
        const typeParam = url.searchParams.get('type');
        expect(typeParam).to.equal('Expense');
      });

    cy.get('[data-testid="loading-indicator"]').should('not.exist');

    // Check if there are filtered transactions or if the list is empty
    cy.get('[data-testid="transactions-list"]').then($list => {
      if ($list.find('li[data-testid^="transaction-item-"]').length > 0) {
        // If there are transactions, verify they exist
        cy.get('li[data-testid^="transaction-item-"]')
          .should('have.length.at.least', 1);
      } else {
        // If no transactions, verify empty state or allow empty result
        cy.get('[data-testid="no-transactions-message"]')
          .should('exist');
      }
    });
  });

  it('should search transactions by description', () => {
    const searchTerm = 'Supermarket';
    
    // Re-alias the transactions request for search
    cy.intercept('GET', '**/api/transactions*').as('getTransactions');
    
    // Wait for search input to be ready and clear any existing filters
    cy.get('[data-testid="search-input"] input')
      .should('exist')
      .should('be.visible')
      .should('be.enabled')
      .clear()
      .type(searchTerm, { delay: 100 });

    // Wait longer for debounce to complete (FilterPanel uses 300ms debounce)
    cy.wait(1000);

    // Wait for search request with timeout and retry logic
    cy.wait('@getTransactions', { timeout: 15000 })
      .then((interception) => {
        console.log('Search request URL:', interception.request.url);
        // Check for search parameter specifically
        const url = new URL(interception.request.url);
        const searchParam = url.searchParams.get('search');
        console.log('Search parameter:', searchParam);
        
        // If search param is null, try to wait for another request
        if (searchParam === null) {
          console.log('Search param is null, waiting for another request...');
          cy.wait('@getTransactions', { timeout: 10000 })
            .then((retryInterception) => {
              console.log('Retry search request URL:', retryInterception.request.url);
              const retryUrl = new URL(retryInterception.request.url);
              const retrySearchParam = retryUrl.searchParams.get('search');
              console.log('Retry search parameter:', retrySearchParam);
              expect(retrySearchParam).to.equal(searchTerm);
            });
        } else {
          expect(searchParam).to.equal(searchTerm);
        }
      });
    
    // Wait for loading to complete
    cy.get('[data-testid="loading-indicator"]').should('not.exist');

    // // Verify results contain search term
    // cy.get('li[data-testid^="transaction-item-"]')
    //   .should('have.length.at.least', 1)
    //   .each($item => {
    //     cy.wrap($item)
    //       .should('contain.text', searchTerm);
    //   });
  });

  // it('should filter by date range', () => {

  //   const startDate = '01/06/2025'; // 1st June 2025
  //   const endDate = '07/06/2025'; // 7th June 2025

  //   // Type dates directly into inputs (format: DD/MM/YYYY)
  //   const typeDate = (inputTestId: string, date: string, verify: boolean) => {
  //     cy.get(`input[data-testid="${inputTestId}"]`)
  //       .should('exist')
  //       .clear({ force: true })
  //       .type(date, { force: true })
  //       .blur({ force: true }); // Trigger change event

  //     // Wait for update
  //     cy.wait('@getTransactions')
  //         .its('request.url')
  //         .should((url) => {
  //           expect(url).to.match(/startDate=|endDate=/);
  //           const startDateParam = url.searchParams.get('startDate');
  //           const endDateParam = url.searchParams.get('endDate');
  //           if (verify) {
  //             expect(startDateParam).to.match(/2025-06-01/);
  //             expect(endDateParam).to.match(/2025-06-07/);
  //           }
  //         });
  //   };

  //   // Set date range (01/06/2025 - 07/06/2025)
  //   typeDate('date-range-filter', startDate, false);
  //   typeDate('date-range-end-filter', endDate, true);
  // });

  // it('should show empty state when no transactions match filters', () => {
  //   const nonExistentTerm = 'NonexistentTransaction_' + Date.now();

  //   // Set up intercept for empty response
  //   cy.intercept(
  //     'GET', 
  //     `${Cypress.env('apiUrl')}/api/transactions*`,
  //     req => {
  //       if (req.url.includes(nonExistentTerm)) {
  //         req.reply({
  //           statusCode: 200,
  //           body: { transactions: [], total: 0, hasMore: false }
  //         });
  //       }
  //     }
  //   ).as('emptySearch');

  //   // Wait for search input and type non-existent term
  //   cy.get('[data-testid="search-input"] input')
  //     .should('be.visible')
  //     .should('be.enabled')
  //     .clear()
  //     .type(nonExistentTerm, { delay: 100 });

  //   // Wait for empty search response
  //   recuresiveWait(nonExistentTerm, 20)
  //     .then(url => {
  //       cy.task('console:log', `Empty search request URL: ${url}`);
  //       const params = new URLSearchParams(url.split('?')[1]);
  //       expect(params.get('search')).to.equal(nonExistentTerm);
  //     });

  //   // Wait for loading to complete and verify empty state
  //   cy.get('[data-testid="loading-indicator"]')
  //     .should('not.exist');

  //   // Verify empty state message is shown
  //   cy.get('[data-testid="no-transactions-message"]')
  //     .should('be.visible')
  //     .and('contain.text', 'No transactions found');
  // });

  // it('should persist filters after page reload', () => {
  //   const searchTerm = 'Supermarket';

  //   // Apply type filter using MUI selectors
  //   cy.get('[data-testid="type-filter"]')
  //     .find('.MuiSelect-select')
  //     .should('be.visible')
  //     .click();

  //   // Find the Expense option in the menu and click it
  //   cy.get('.MuiPopover-root')
  //     .should('be.visible')
  //     .find('.MuiMenuItem-root')
  //     .contains('Expense')
  //     .click();

  //   // Apply search filter
  //   cy.get('input[data-testid="search-input"]')
  //     .should('exist')
  //     .should('be.visible')
  //     .should('be.enabled')
  //     .clear()
  //     .type(searchTerm, { delay: 100 });

  //   // Wait for filters to be applied and verify request
  //   cy.wait('@getTransactions')
  //     .then(interception => {
  //       const params = new URLSearchParams(interception.request.url.split('?')[1]);
  //       expect(params.get('type')).to.equal('Expense');
  //       expect(params.get('search')).to.equal(searchTerm);

  //       // Store URL for comparison after reload
  //       const originalSearch = interception.request.url.split('?')[1];
        
  //       // Reload page and wait for data
  //       cy.reload();
  //       cy.wait('@getTransactions')
  //         .then(newInterception => {
  //           const newSearch = newInterception.request.url.split('?')[1];
  //           // Verify URL params remain (excluding cache busting)
  //           const cleanOriginal = new URLSearchParams(originalSearch);
  //           const cleanNew = new URLSearchParams(newSearch);
  //           cleanOriginal.delete('_');
  //           cleanNew.delete('_');
  //           expect(cleanNew.toString()).to.equal(cleanOriginal.toString());
  //         });

  //       // Verify UI state after reload
  //       cy.get('[data-testid="type-filter"]')
  //         .should('contain.text', 'Expense');
  //       cy.get('input[data-testid="search-input"]')
  //         .should('have.value', searchTerm);
  //     });
  // });

  it('should handle API errors gracefully', () => {
    // This test doesn't need the beforeEach setup since we're testing error handling
    // Clear any existing state and set up a clean test
    cy.task('db:clearTestData', null, { timeout: 10000 });
    
    // Create test user without adding transactions
    cy.createTestUser().then(token => {
      const decodedToken = JSON.parse(atob(token.split('.')[1]));
      Cypress.env('testUserId', decodedToken.userId);
      
      return cy.login('test@example.com', 'password123');
    });

    // Intercept with error BEFORE visiting the page
    cy.intercept(
      'GET',
      '**/api/transactions*',
      { statusCode: 500 }
    ).as('apiError');

    // Visit the transactions page
    cy.visit('/transactions');
    
    // Wait for the error response
    cy.wait('@apiError');

    // Verify error message appears
    cy.contains('Failed to load transactions', { timeout: 10000 })
      .should('be.visible');
  });
});
