describe('Transaction Category Icons', () => {
  beforeEach(() => {
    // Intercept API calls and provide mock data
    cy.intercept('GET', '/api/transactions*', {
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
            category: {
              _id: 'cat1',
              name: 'Household',
              type: 'expense'
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
            category: {
              _id: 'cat2',
              name: 'Other',
              type: 'expense'
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
    });
  });

  it('should display mapped subcategory as icon with tooltip', () => {
    // Debug: Log all data-testid attributes
    cy.get('[data-testid]').each($el => {
      cy.log(`Found element with data-testid: ${$el.attr('data-testid')}`);
    });

    // Find the first transaction's IconChip
    cy.get('[data-testid="transaction-tx1-content-subcategory-chip-icon"]')
      .should('exist')
      .trigger('mouseover');

    // Verify tooltip shows correct text
    cy.get('[role="tooltip"]')
      .should('be.visible')
      .and('contain.text', 'Mortgage');
  });

  it('should display unmapped subcategory as text chip', () => {
    // Find the second transaction's text chip
    cy.get('[data-testid="transaction-tx2-content-subcategory-chip-text"]')
      .should('exist')
      .within(() => {
        cy.get('.MuiTypography-root')
          .should('have.text', 'Custom Category');
      });
  });

  it('should handle transaction without subcategory', () => {
    // Intercept and mock transaction without subcategory
    cy.intercept('GET', '/api/transactions*', {
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

  it('should maintain consistent layout with different subcategory displays', () => {
    // Check alignment and spacing of subcategory containers
    cy.get('[data-testid="transaction-tx1-content-subcategory"]')
      .should('have.css', 'display', 'flex')
      .and('have.css', 'align-items', 'center');

    cy.get('[data-testid="transaction-tx2-content-subcategory"]')
      .should('have.css', 'display', 'flex')
      .and('have.css', 'align-items', 'center');
  });
});
