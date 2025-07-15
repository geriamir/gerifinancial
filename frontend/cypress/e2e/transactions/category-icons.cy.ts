describe('Transaction Category Icons', () => {
  beforeEach(() => {
    // Intercept API calls and provide mock data
    cy.intercept('GET', '**/api/transactions*', {
      statusCode: 200,
      body: {
        transactions: [
          {
            _id: 'tx1',
            amount: -100,
            currency: 'ILS',
            date: '2025-07-02T12:00:00.000Z',
            description: 'Monthly Mortgage Payment',
            type: 'Expense',
            userId: Cypress.env('testUserId'),
            identifier: 'tx1',
            accountId: 'acc1',
            status: 'pending',
            createdAt: '2025-07-02T12:00:00.000Z',
            updatedAt: '2025-07-02T12:00:00.000Z',
            category: {
              _id: 'cat1',
              name: 'Household',
              type: 'Expense'
            },
            subCategory: {
              _id: 'subcat1',
              name: 'Mortgage',
              parentCategory: {
                _id: 'cat1',
                name: 'Household',
                type: 'expense'
              },
              keywords: ['mortgage', 'loan'],
              isDefault: true
            }
          },
          {
            _id: 'tx2',
            amount: -50,
            currency: 'ILS',
            date: '2025-07-02T12:00:00.000Z',
            description: 'Custom Expense',
            type: 'Expense',
            userId: Cypress.env('testUserId'),
            identifier: 'tx2',
            accountId: 'acc1',
            status: 'pending',
            createdAt: '2025-07-02T12:00:00.000Z',
            updatedAt: '2025-07-02T12:00:00.000Z',
            category: {
              _id: 'cat2',
              name: 'Other',
              type: 'Expense'
            },
            subCategory: {
              _id: 'subcat2',
              name: 'Custom Category',
              parentCategory: {
                _id: 'cat2',
                name: 'Other',
                type: 'expense'
              },
              keywords: [],
              isDefault: false
            }
          }
        ],
        total: 2,
        hasMore: false
      }
    }).as('getTransactions');

    // Create and authenticate test user
    cy.task('db:clearTestData');
    cy.createTestUser().then((token) => {
      localStorage.setItem('token', token);
      // Visit transactions page after setting token
      cy.visit('/transactions');
      cy.wait('@getTransactions');
      
      // Wait for transactions to render
      cy.get('[data-testid="transactions-list"]')
        .should('be.visible')
        .find('li')
        .should('have.length.at.least', 1);
    });
  });

  it('should display subcategory name for mapped subcategory', () => {
    // Find the first transaction's category (shows subcategory for expense transactions)
    cy.get('[data-testid="transaction-tx1-content-category"]')
      .should('exist')
      .and('have.text', 'Mortgage');
  });

  it('should display subcategory name for unmapped subcategory', () => {
    // Find the second transaction's category (shows subcategory for expense transactions)
    cy.get('[data-testid="transaction-tx2-content-category"]')
      .should('exist')
      .and('have.text', 'Custom Category');
  });

  it('should handle transaction without subcategory', () => {
    // Intercept and mock transaction without subcategory
    cy.intercept('GET', '**/api/transactions*', {
      statusCode: 200,
      body: {
        transactions: [
          {
            _id: 'tx3',
            amount: -75,
            currency: 'ILS',
            date: '2025-07-02T12:00:00.000Z',
            description: 'Uncategorized Transaction',
            type: 'Expense',
            category: {
              _id: 'cat3',
              name: 'Other',
              type: 'expense'
            }
          }
        ],
        total: 1,
        hasMore: false
      }
    }).as('getTransactionsNoSubcat');

    // Reload page to get new data
    cy.reload();
    cy.wait('@getTransactionsNoSubcat');

    // Verify no subcategory element is present
    cy.get('[data-testid*="subcategory"]').should('not.exist');
  });

  it('should maintain consistent typography for subcategories', () => {
    // Check typography styles are consistent
    cy.get('[data-testid="transaction-tx1-content-category"]')
      .should('have.css', 'display', 'block')
      .invoke('css', 'font-size')
      .should('match', /(0.75rem|12px)/);

    cy.get('[data-testid="transaction-tx2-content-category"]')
      .should('have.css', 'display', 'block')
      .invoke('css', 'font-size')
      .should('match', /(0.75rem|12px)/);
  });
});
