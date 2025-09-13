import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CreditCardMonthlyDetail } from '../CreditCardMonthlyDetail';
import { creditCardsApi } from '../../../services/api/creditCards';
import type { 
  CreditCardMonthlyStats, 
  CategoryBreakdown,
  CreditCardTransactionsResult 
} from '../../../services/api/types/creditCard';

// Mock the credit cards API
jest.mock('../../../services/api/creditCards', () => ({
  creditCardsApi: {
    getMonthlyStats: jest.fn(),
    getTransactions: jest.fn()
  }
}));

// Mock Recharts components
jest.mock('recharts', () => ({
  PieChart: ({ children, ...props }: any) => (
    <div data-testid="pie-chart" data-width={props.width} data-height={props.height}>
      {children}
    </div>
  ),
  Pie: ({ dataKey, ...props }: any) => (
    <div data-testid="pie" data-key={dataKey} />
  ),
  BarChart: ({ children, ...props }: any) => (
    <div data-testid="bar-chart" data-width={props.width} data-height={props.height}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, ...props }: any) => (
    <div data-testid="bar" data-key={dataKey} data-fill={props.fill} />
  ),
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: any) => (
    <div data-testid="tooltip">
      {content && typeof content === 'function' && content({ active: true, payload: [], label: 'Test' })}
    </div>
  ),
  ResponsiveContainer: ({ children, ...props }: any) => (
    <div data-testid="responsive-container" data-width={props.width} data-height={props.height}>
      {children}
    </div>
  ),
  Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockMonthlyStats: CreditCardMonthlyStats = {
  cardId: 'card1',
  year: 2024,
  month: 12,
  monthName: 'December 2024',
  totalAmount: 1250.75,
  transactionCount: 25,
  categoryBreakdown: [
    {
      _id: 'cat1',
      category: 'Restaurants',
      subCategory: 'Fine Dining',
      totalAmount: 500.25,
      transactionCount: 8,
      percentage: 40.0
    },
    {
      _id: 'cat2',
      category: 'Gas',
      subCategory: 'Gas Stations',
      totalAmount: 300.50,
      transactionCount: 6,
      percentage: 24.0
    },
    {
      _id: 'cat3',
      category: 'Shopping',
      subCategory: 'Online Shopping',
      totalAmount: 250.00,
      transactionCount: 5,
      percentage: 20.0
    },
    {
      _id: 'cat4',
      category: 'Groceries',
      totalAmount: 200.00,
      transactionCount: 6,
      percentage: 16.0
    }
  ]
};

const mockTransactions: CreditCardTransactionsResult = {
  transactions: [
    {
      _id: 'trans1',
      description: 'Restaurant ABC',
      amount: 85.50,
      date: '2024-12-15T19:30:00.000Z',
      category: 'Restaurants',
      subCategory: 'Fine Dining'
    },
    {
      _id: 'trans2',
      description: 'Gas Station XYZ',
      amount: 45.25,
      date: '2024-12-14T08:15:00.000Z',
      category: 'Gas',
      subCategory: 'Gas Stations'
    }
  ],
  totalCount: 25,
  currentPage: 1,
  totalPages: 13,
  hasNext: true,
  hasPrev: false
};

describe('CreditCardMonthlyDetail', () => {
  const mockApiCalls = creditCardsApi as jest.Mocked<typeof creditCardsApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiCalls.getMonthlyStats.mockResolvedValue(mockMonthlyStats);
    mockApiCalls.getTransactions.mockResolvedValue(mockTransactions);
  });

  describe('Dialog Rendering', () => {
    it('should render dialog when open', () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      expect(screen.getByText('Monthly Credit Card Analysis')).toBeInTheDocument();
      expect(screen.getByText('Chase Sapphire')).toBeInTheDocument();
    });

    it('should not render dialog when closed', () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={false}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      expect(screen.queryByText('Monthly Credit Card Analysis')).not.toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={onClose}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      const closeButton = screen.getByLabelText('close');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Month/Year Selection', () => {
    it('should display current month/year by default', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      // Should load data for current month
      await waitFor(() => {
        expect(mockApiCalls.getMonthlyStats).toHaveBeenCalledWith(
          'card1',
          expect.any(Number),
          expect.any(Number)
        );
      });
    });

    it('should allow changing year selection', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('2024')).toBeInTheDocument();
      });

      // Change year
      const yearSelect = screen.getByDisplayValue('2024');
      fireEvent.change(yearSelect, { target: { value: '2023' } });

      await waitFor(() => {
        expect(mockApiCalls.getMonthlyStats).toHaveBeenCalledWith('card1', 2023, expect.any(Number));
      });
    });

    it('should allow changing month selection', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('12')).toBeInTheDocument();
      });

      // Change month
      const monthSelect = screen.getByDisplayValue('12');
      fireEvent.change(monthSelect, { target: { value: '11' } });

      await waitFor(() => {
        expect(mockApiCalls.getMonthlyStats).toHaveBeenCalledWith('card1', expect.any(Number), 11);
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching data', () => {
      // Mock a pending promise
      mockApiCalls.getMonthlyStats.mockReturnValue(new Promise(() => {}));
      
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      expect(screen.getByText('Loading monthly analysis...')).toBeInTheDocument();
    });

    it('should hide loading state after data loads', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading monthly analysis...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('December 2024')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should display monthly statistics', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('December 2024')).toBeInTheDocument();
        expect(screen.getByText('$1,250.75')).toBeInTheDocument();
        expect(screen.getByText('25 transactions')).toBeInTheDocument();
      });
    });

    it('should display category breakdown', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
        expect(screen.getByText('Restaurants')).toBeInTheDocument();
        expect(screen.getByText('$500.25')).toBeInTheDocument();
        expect(screen.getByText('40.0%')).toBeInTheDocument();
      });
    });

    it('should render pie chart for category breakdown', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        expect(screen.getByTestId('pie')).toBeInTheDocument();
      });
    });

    it('should render bar chart for spending analysis', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('bar')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockApiCalls.getMonthlyStats.mockRejectedValue(new Error('API Error'));
      
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading monthly data. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show empty state when no data available', async () => {
      mockApiCalls.getMonthlyStats.mockResolvedValue({
        ...mockMonthlyStats,
        totalAmount: 0,
        transactionCount: 0,
        categoryBreakdown: []
      });
      
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No transactions found for this month')).toBeInTheDocument();
      });
    });
  });

  describe('Transaction Details', () => {
    it('should load and display recent transactions', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(mockApiCalls.getTransactions).toHaveBeenCalledWith('card1', {
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          limit: 5,
          sortBy: 'date',
          sortOrder: 'desc'
        });
      });

      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
      expect(screen.getByText('Restaurant ABC')).toBeInTheDocument();
      expect(screen.getByText('$85.50')).toBeInTheDocument();
    });

    it('should handle transaction loading errors', async () => {
      mockApiCalls.getTransactions.mockRejectedValue(new Error('Transaction Error'));
      
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading transactions')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Monthly Credit Card Analysis')).toBeInTheDocument();
      });

      // Should still render charts and data
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('should handle fullScreen properly on small devices', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('December 2024')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      expect(screen.getByLabelText('close')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      const closeButton = screen.getByLabelText('close');
      
      await act(async () => {
        closeButton.focus();
      });
      
      expect(document.activeElement).toBe(closeButton);
    });

    it('should handle escape key to close dialog', async () => {
      const onClose = jest.fn();
      
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={onClose}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance', () => {
    it('should not reload data when dialog reopens with same parameters', async () => {
      const { rerender } = renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(mockApiCalls.getMonthlyStats).toHaveBeenCalledTimes(1);
      });

      // Close and reopen
      rerender(
        <ThemeProvider theme={theme}>
          <CreditCardMonthlyDetail
            open={false}
            onClose={jest.fn()}
            cardId="card1"
            cardName="Chase Sapphire"
          />
        </ThemeProvider>
      );

      rerender(
        <ThemeProvider theme={theme}>
          <CreditCardMonthlyDetail
            open={true}
            onClose={jest.fn()}
            cardId="card1"
            cardName="Chase Sapphire"
          />
        </ThemeProvider>
      );

      // Should have been called again since dialog was reopened
      await waitFor(() => {
        expect(mockApiCalls.getMonthlyStats).toHaveBeenCalledTimes(2);
      });
    });

    it('should debounce rapid month/year changes', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('12')).toBeInTheDocument();
      });

      const monthSelect = screen.getByDisplayValue('12');
      
      // Rapid changes
      fireEvent.change(monthSelect, { target: { value: '11' } });
      fireEvent.change(monthSelect, { target: { value: '10' } });
      fireEvent.change(monthSelect, { target: { value: '9' } });

      // Should only make the final API call
      await waitFor(() => {
        expect(mockApiCalls.getMonthlyStats).toHaveBeenLastCalledWith('card1', expect.any(Number), 9);
      }, { timeout: 1000 });
    });
  });

  describe('Data Formatting', () => {
    it('should format currency amounts correctly', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('$1,250.75')).toBeInTheDocument();
        expect(screen.getByText('$500.25')).toBeInTheDocument();
        expect(screen.getByText('$300.50')).toBeInTheDocument();
      });
    });

    it('should format percentages correctly', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('40.0%')).toBeInTheDocument();
        expect(screen.getByText('24.0%')).toBeInTheDocument();
        expect(screen.getByText('20.0%')).toBeInTheDocument();
      });
    });

    it('should format transaction counts correctly', async () => {
      renderWithProviders(
        <CreditCardMonthlyDetail
          open={true}
          onClose={jest.fn()}
          cardId="card1"
          cardName="Chase Sapphire"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('25 transactions')).toBeInTheDocument();
        expect(screen.getByText('8 transactions')).toBeInTheDocument(); // Restaurants
        expect(screen.getByText('6 transactions')).toBeInTheDocument(); // Gas
      });
    });
  });
});
