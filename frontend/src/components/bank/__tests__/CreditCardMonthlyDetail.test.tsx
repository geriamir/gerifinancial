import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CreditCardMonthlyDetail } from '../CreditCardMonthlyDetail';
import { creditCardsApi } from '../../../services/api/creditCards';
import type { 
  CreditCardMonthlyStats, 
  CategoryBreakdown
} from '../../../services/api/types/creditCard';

// Mock the credit cards API
jest.mock('../../../services/api/creditCards', () => ({
  creditCardsApi: {
    getMonthlyStats: jest.fn()
  }
}));

// Mock utils
jest.mock('../../../utils/formatters', () => ({
  formatCurrency: (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
  Legend: () => <div data-testid="legend" />
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
  monthName: 'December',
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

describe('CreditCardMonthlyDetail', () => {
  const mockApiCalls = creditCardsApi as jest.Mocked<typeof creditCardsApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiCalls.getMonthlyStats.mockResolvedValue(mockMonthlyStats);
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

      expect(screen.getByText('Monthly Details - Chase Sapphire')).toBeInTheDocument();
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

      expect(screen.queryByText('Monthly Details - Chase Sapphire')).not.toBeInTheDocument();
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

      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Month/Year Selection', () => {
    it('should display current month/year by default', async () => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      
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
          currentYear,
          currentMonth
        );
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

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
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
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      expect(screen.getByText('December 2024 Summary')).toBeInTheDocument();
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
        expect(screen.getByText('December 2024 Summary')).toBeInTheDocument();
        expect(screen.getByText('$1,250.75')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
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
        expect(screen.getByText('Fine Dining')).toBeInTheDocument();
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
        expect(screen.getByText('Failed to load monthly statistics')).toBeInTheDocument();
      });
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
        expect(screen.getByText('8 transactions')).toBeInTheDocument(); // Restaurants
        expect(screen.getAllByText('6 transactions')).toHaveLength(2); // Gas and Groceries both have 6
        expect(screen.getByText('5 transactions')).toBeInTheDocument(); // Shopping
      });
    });
  });
});
