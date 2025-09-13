import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CreditCardsList } from '../CreditCardsList';
import { creditCardsApi } from '../../../services/api/creditCards';
import type { 
  CreditCardWithStats, 
  CreditCardBasicStats, 
  CreditCardTrend 
} from '../../../services/api/types/creditCard';

// Mock the credit cards API
jest.mock('../../../services/api/creditCards', () => ({
  creditCardsApi: {
    getAll: jest.fn(),
    getBasicStats: jest.fn(),
    getTrend: jest.fn(),
    getMonthlyStats: jest.fn(),
    getTransactions: jest.fn(),
    getDetails: jest.fn()
  }
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockCreditCards: CreditCardWithStats[] = [
  {
    _id: 'card1',
    bankAccountId: 'account1',
    userId: 'user1',
    identifier: '**** **** **** 1234',
    name: 'Chase Sapphire',
    cutoffDay: 15,
    gracePeriodDays: 25,
    recentTransactionCount: 45,
    totalSpentLast6Months: 2500.75,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-12-15T10:00:00.000Z'
  },
  {
    _id: 'card2',
    bankAccountId: 'account2',
    userId: 'user1',
    identifier: '**** **** **** 5678',
    name: 'AmEx Gold',
    cutoffDay: 10,
    gracePeriodDays: 20,
    recentTransactionCount: 28,
    totalSpentLast6Months: 1200.25,
    createdAt: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-12-10T15:30:00.000Z'
  }
];

const mockBasicStats: CreditCardBasicStats = {
  cardId: 'card1',
  last6MonthsTotal: 2500.75,
  avgMonthlySpending: 416.79,
  totalTransactions: 45,
  periodStart: '2024-07-01T00:00:00.000Z',
  periodEnd: '2024-12-31T23:59:59.999Z'
};

const mockTrendData: CreditCardTrend = {
  cardId: 'card1',
  months: [
    { year: 2024, month: 7, monthName: 'July 2024', totalAmount: 250.50, transactionCount: 8 },
    { year: 2024, month: 8, monthName: 'August 2024', totalAmount: 300.75, transactionCount: 10 },
    { year: 2024, month: 9, monthName: 'September 2024', totalAmount: 280.25, transactionCount: 9 },
    { year: 2024, month: 10, monthName: 'October 2024', totalAmount: 320.00, transactionCount: 11 },
    { year: 2024, month: 11, monthName: 'November 2024', totalAmount: 290.50, transactionCount: 9 },
    { year: 2024, month: 12, monthName: 'December 2024', totalAmount: 356.50, transactionCount: 12 }
  ],
  totalPeriodAmount: 1798.50,
  avgMonthlyAmount: 299.75
};

describe('CreditCardsList', () => {
  const mockApiCalls = creditCardsApi as jest.Mocked<typeof creditCardsApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiCalls.getAll.mockResolvedValue(mockCreditCards);
    mockApiCalls.getBasicStats.mockResolvedValue(mockBasicStats);
    mockApiCalls.getTrend.mockResolvedValue(mockTrendData);
  });

  describe('Initial Rendering', () => {
    it('should render loading state initially', () => {
      renderWithProviders(<CreditCardsList />);
      
      // Should show loading text
      expect(screen.getByText('Loading credit cards...')).toBeInTheDocument();
    });

    it('should render credit cards after loading', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
        expect(screen.getByText('AmEx Gold')).toBeInTheDocument();
      });

      expect(screen.getByText('**** **** **** 1234')).toBeInTheDocument();
      expect(screen.getByText('**** **** **** 5678')).toBeInTheDocument();
    });

    it('should display basic credit card statistics', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Check for transaction counts in chip format
      expect(screen.getByText('45 transactions')).toBeInTheDocument();
      expect(screen.getByText('28 transactions')).toBeInTheDocument();

      // Check for total amounts
      expect(screen.getByText('$2,500.75')).toBeInTheDocument();
      expect(screen.getByText('$1,200.25')).toBeInTheDocument();
    });

    it('should show empty state when no credit cards', async () => {
      mockApiCalls.getAll.mockResolvedValue([]);
      
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('No Credit Cards Found')).toBeInTheDocument();
      });

      expect(screen.getByText('Credit cards will appear here once they are detected from your bank account transactions.')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockApiCalls.getAll.mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load credit cards')).toBeInTheDocument();
      });
    });

    it('should show error when stats loading fails', async () => {
      mockApiCalls.getBasicStats.mockRejectedValue(new Error('Stats Error'));
      
      renderWithProviders(<CreditCardsList />);

      // Wait for cards to load
      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Expand first card
      const expandButton = screen.getAllByLabelText('expand')[0];
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to load credit card details')).toBeInTheDocument();
      });
    });

    it('should show error when trend data loading fails', async () => {
      mockApiCalls.getTrend.mockRejectedValue(new Error('Trend Error'));
      
      renderWithProviders(<CreditCardsList />);

      // Wait for cards to load
      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Expand first card
      const expandButton = screen.getAllByLabelText('expand')[0];
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to load credit card details')).toBeInTheDocument();
      });
    });
  });

  describe('Card Expansion', () => {
    it('should expand card and load detailed stats when clicked', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      const expandButton = screen.getAllByLabelText('expand')[0];
      fireEvent.click(expandButton);

      expect(mockApiCalls.getBasicStats).toHaveBeenCalledWith('card1');
      expect(mockApiCalls.getTrend).toHaveBeenCalledWith('card1');

      await waitFor(() => {
        expect(screen.getByText('Statistics')).toBeInTheDocument();
        expect(screen.getByText('6-Month Trend')).toBeInTheDocument();
      });
    });

    it('should collapse card when expand button is clicked again', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      const expandButton = screen.getAllByLabelText('expand')[0];
      
      // Expand
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByText('Statistics')).toBeInTheDocument();
      });

      // Collapse
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Statistics')).not.toBeInTheDocument();
      });
    });

    it('should only load data once per card expansion', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      const expandButton = screen.getAllByLabelText('expand')[0];
      
      // Expand and collapse multiple times
      fireEvent.click(expandButton);
      await waitFor(() => {
        expect(screen.getByText('Statistics')).toBeInTheDocument();
      });
      
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByText('Statistics')).toBeInTheDocument();
      });

      // Should only be called once
      expect(mockApiCalls.getBasicStats).toHaveBeenCalledTimes(1);
      expect(mockApiCalls.getTrend).toHaveBeenCalledTimes(1);
    });
  });

  describe('Monthly Detail Dialog', () => {
    it('should open monthly detail dialog when View Monthly Details is clicked', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Expand card
      const expandButton = screen.getAllByLabelText('expand')[0];
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('View Monthly Details')).toBeInTheDocument();
      });

      // Click monthly details button
      const monthlyButton = screen.getByText('View Monthly Details');
      fireEvent.click(monthlyButton);

      await waitFor(() => {
        expect(screen.getByText('Monthly Credit Card Analysis')).toBeInTheDocument();
      });
    });

    it('should close monthly detail dialog when close button is clicked', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Expand card and open dialog
      const expandButton = screen.getAllByLabelText('expand')[0];
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('View Monthly Details')).toBeInTheDocument();
      });

      const monthlyButton = screen.getByText('View Monthly Details');
      fireEvent.click(monthlyButton);

      await waitFor(() => {
        expect(screen.getByText('Monthly Credit Card Analysis')).toBeInTheDocument();
      });

      // Close dialog
      const closeButton = screen.getByLabelText('close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Monthly Credit Card Analysis')).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('should format currency amounts correctly', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('$2,500.75')).toBeInTheDocument();
        expect(screen.getByText('$1,200.25')).toBeInTheDocument();
      });
    });

    it('should display statistics when expanded', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Expand card
      const expandButton = screen.getAllByLabelText('expand')[0];
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Statistics')).toBeInTheDocument();
        expect(screen.getByText('Average Monthly Spending')).toBeInTheDocument();
        expect(screen.getByText('Total Transactions (6 months)')).toBeInTheDocument();
        expect(screen.getByText('$416.79')).toBeInTheDocument(); // Average monthly
        expect(screen.getByText('45')).toBeInTheDocument(); // Total transactions
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for expand buttons', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      const expandButtons = screen.getAllByLabelText('expand');
      expect(expandButtons).toHaveLength(2);
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      const expandButtons = screen.getAllByLabelText('expand');
      
      await act(async () => {
        expandButtons[0].focus();
      });
      
      expect(document.activeElement).toBe(expandButtons[0]);
    });
  });

  describe('Performance', () => {
    it('should not reload data when component rerenders with same props', async () => {
      const { rerender } = renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Rerender with same props
      rerender(
        <ThemeProvider theme={theme}>
          <CreditCardsList />
        </ThemeProvider>
      );

      // Should only call API once
      expect(mockApiCalls.getAll).toHaveBeenCalledTimes(1);
    });

    it('should debounce rapid expansion clicks', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      const expandButton = screen.getAllByLabelText('expand')[0];
      
      // Rapid clicks
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);
      fireEvent.click(expandButton);

      // Should only process the final state
      await waitFor(() => {
        expect(mockApiCalls.getBasicStats).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render properly on mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
      });

      // Cards should still be visible and functional
      const expandButton = screen.getAllByLabelText('expand')[0];
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Statistics')).toBeInTheDocument();
      });
    });
  });

  describe('Card Status Display', () => {
    it('should display credit card names and identifiers', async () => {
      renderWithProviders(<CreditCardsList />);

      await waitFor(() => {
        expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
        expect(screen.getByText('AmEx Gold')).toBeInTheDocument();
      });

      // Should show identifiers
      expect(screen.getByText('**** **** **** 1234')).toBeInTheDocument();
      expect(screen.getByText('**** **** **** 5678')).toBeInTheDocument();
    });
  });
});
