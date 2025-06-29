interface Transaction {
  _id: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  type: 'Expense' | 'Income' | 'Transfer';
  status: 'pending' | 'processed' | 'error';
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

describe('Transactions Page', () => {
  beforeEach(() => {
    // Intercept API calls
    cy.intercept('GET', '/api/transactions*', (req) => {
      const skip = parseInt(req.query.skip as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as TransactionType;
      const search = req.query.search as string;

      // Generate mock transactions based on filters
      const transactions: Transaction[] = Array.from({ length: limit }, (_, i) => ({
        _id: `transaction-${skip + i}`,
        amount: 100 + i,
        currency: 'ILS',
        date: new Date(2025, 5, i + 1).toISOString(),
        description: `Test Transaction ${skip + i}`,
        type: i % 2 === 0 ? 'Expense' as const : 'Income' as const,
        status: 'pending'
      }));

      // Apply type filter if present
      const filtered = type 
        ? transactions.filter(t => t.type === type)
        : transactions;

      // Apply search filter if present
      const searchFiltered = search
        ? filtered.filter(t => t.description.toLowerCase().includes(search.toLowerCase()))
        : filtered;

      return {
        statusCode: 200,
        body: {
          transactions: searchFiltered,
          total: 100,
          hasMore: skip + limit < 100
        }
      };
    }).as('getTransactions');

    cy.visit('/transactions');
  });

  it('should load and display initial transactions', () => {
    cy.wait('@getTransactions');
    cy.contains('Test Transaction 0').should('be.visible');
    cy.contains('Test Transaction 19').should('be.visible');
  });

  it('should load more transactions on scroll', () => {
    cy.wait('@getTransactions');
    
    // Scroll to bottom to trigger loading more
    cy.get('div').last().scrollIntoView();
    
    cy.wait('@getTransactions');
    cy.contains('Test Transaction 20').should('be.visible');
  });

  it('should filter transactions by type', () => {
    cy.wait('@getTransactions');

    // Click type filter
    cy.contains('Type').click();
    cy.contains('Expense').click();

    cy.wait('@getTransactions')
      .its('request.url')
      .should('include', 'type=Expense');

    // Verify filtered results
    cy.get('body').should('contain', 'Expense');
    cy.get('body').should('not.contain', 'Income');
  });

  it('should search transactions by description', () => {
    cy.wait('@getTransactions');

    // Type in search
    cy.get('input[placeholder*="Search"]').type('Transaction 1');

    // Wait for debounced API call
    cy.wait('@getTransactions')
      .its('request.url')
      .should('include', 'search=Transaction%201');

    // Verify search results
    cy.contains('Test Transaction 1').should('be.visible');
  });

  it('should filter by date range', () => {
    cy.wait('@getTransactions');

    // Open date picker
    cy.get('button').contains('Last 30 days').click();

    // Select custom range
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);

    // Click the start date
    cy.get('button').contains(startDate.getDate().toString()).first().click();
    // Click the end date (today)
    cy.get('button').contains(today.getDate().toString()).last().click();

    // Apply date filter
    cy.contains('Apply').click();

    // Verify API call includes date params
    cy.wait('@getTransactions')
      .its('request.url')
      .should(url => {
        expect(url).to.include('startDate');
        expect(url).to.include('endDate');
      });
  });

  it('should show empty state when no transactions match filters', () => {
    // Intercept with empty response
    cy.intercept('GET', '/api/transactions*', {
      statusCode: 200,
      body: {
        transactions: [],
        total: 0,
        hasMore: false
      }
    }).as('getEmptyTransactions');

    // Apply search that will return no results
    cy.get('input[placeholder*="Search"]').type('NonexistentTransaction');
    
    cy.wait('@getEmptyTransactions');
    cy.contains('No transactions found.').should('be.visible');
  });

  it('should persist filters after page reload', () => {
    cy.wait('@getTransactions');

    // Apply filters
    cy.contains('Type').click();
    cy.contains('Expense').click();
    cy.get('input[placeholder*="Search"]').type('Test');

    // Reload page
    cy.reload();

    // Verify filters are restored
    cy.wait('@getTransactions')
      .its('request.url')
      .should(url => {
        expect(url).to.include('type=Expense');
        expect(url).to.include('search=Test');
      });
  });

  it('should handle API errors gracefully', () => {
    // Intercept with error response
    cy.intercept('GET', '/api/transactions*', {
      statusCode: 500,
      body: {
        error: 'Internal Server Error'
      }
    }).as('getTransactionsError');

    cy.reload();
    cy.wait('@getTransactionsError');
    
    cy.contains('Failed to load transactions').should('be.visible');
  });
});
