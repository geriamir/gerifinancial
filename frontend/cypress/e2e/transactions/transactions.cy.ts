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
  status: 'pending' | 'processed' | 'error';
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

      cy.task('console:log', `Checking URL for search term "${searchTerm}": ${url}`);

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
        // Create test transactions with explicit ISO dates
        const baseDate = new Date(2025, 5, 1);
        baseDate.setUTCHours(0, 0, 0, 0);
        return cy.task<AddTransactionsResult>('db:addTransactions', {
          count: 30,
          baseDate: baseDate.toISOString(), // June 1st, 2025
          userId: storedUserId
        });
      });
    }).then(result => {
      console.log('Login completed, token:', localStorage.getItem('token'));
      console.log('Added transactions:', result);
      
      expect(result.success).to.be.true;
      expect(result.insertedCount).to.equal(30);
      expect(result.transactions).to.have.length(30);

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

      // Verify transaction dates are within expected range
      const startDate = new Date('2025-05-13T00:00:00.000Z'); // -17 days from June 1st
      const endDate = new Date('2025-06-17T23:59:59.999Z');   // +17 days from June 1st
      
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

    // Visit page after ensuring token is set
    cy.visit('/transactions', {
      onBeforeLoad(win) {
        console.log('Verifying token before page load:', {
          token: win.localStorage.getItem('token')
        });
      },
    });
    cy.contains('Transactions', { timeout: 10000 }).should('be.visible');

    // Set up API spies with detailed logging
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/transactions*`, (req) => {
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
    cy.intercept('GET', `${Cypress.env('apiUrl')}/api/transactions/categories`).as('getCategories');

    // Wait for initial data load and verify response
    cy.wait('@getTransactions', { timeout: 10000 })
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
        
        cy.get('span[class*="MuiChip-label"]')
          .invoke('text')
          .should('match', /(Expense|Income|Transfer)/);
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
    // Wait for transactions to load and verify expense transactions exist
    cy.get('[data-testid="transactions-list"]')
      .should('be.visible')
      .find('li[data-testid^="transaction-item-"]')
      .should('have.length.at.least', 1)
      .then($items => {
        // At least one item should be an expense
        const hasExpense = $items.toArray().some(item => 
          item.textContent?.includes('Expense')
        );
        expect(hasExpense, 'Should have at least one Expense transaction').to.be.true;
      });

    // Proceed with filtering
    cy.get('[data-testid="transactions-list"]')
      .find('li[data-testid^="transaction-item-"]')
      .contains('Expense', { timeout: 10000 })
      .should('exist')
      .then(() => {
        // Only proceed with filter test once we confirm Expense transactions exist
        cy.log('Found Expense transactions, proceeding with filter test');
      });

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
    const searchTerm = 'type=Expense';
    const result = recuresiveWait(searchTerm, 4);
    result.then((url) => { 
      expect(url).to.include(searchTerm, `Request URL should include ${searchTerm}`);
    });

    cy.get('[data-testid="loading-indicator"]').should('not.exist');

    // Verify filtered results
    cy.get('li[data-testid^="transaction-item-"]')
      .should('have.length.at.least', 1)
      .each($item => {
        cy.wrap($item)
          .find('span[class*="MuiChip-label"]')
          .should('have.text', 'Expense');
      });

    // Verify URL params
    // cy.location('search').should('include', 'type=Expense');
  });

  it('should search transactions by description', () => {
    const searchTerm = 'Supermarket';
    
    // Wait for search input to be ready
    cy.get('[data-testid="search-input"] input')
      .should('exist')
      .should('be.visible')
      .should('be.enabled')
      .clear()
      .type(searchTerm, { delay: 100 });

    // Wait for search request and verify search parameter
    const result = recuresiveWait(searchTerm, 20);
    result.then((url) => { 
      expect(url).to.include(searchTerm, `Request URL should include ${searchTerm}`);
    });
    
    // Wait for loading to complete
    cy.get('[data-testid="loading-indicator"]').should('not.exist');

    // Verify results contain search term
    cy.get('li[data-testid^="transaction-item-"]')
      .should('have.length.at.least', 1)
      .each($item => {
        cy.wrap($item)
          .should('contain.text', searchTerm);
      });
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
    // Intercept with error
    cy.intercept(
      'GET',
      `${Cypress.env('apiUrl')}/api/transactions*`,
      { statusCode: 500 }
    ).as('apiError');

    // Trigger new request
    cy.reload();
    cy.wait('@apiError');

    // Verify error message
    cy.contains('Failed to load transactions')
      .should('be.visible');
  });
});
