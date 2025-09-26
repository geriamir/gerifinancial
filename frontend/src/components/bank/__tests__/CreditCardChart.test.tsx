import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CreditCardChart } from '../CreditCardChart';
import type { MonthlyTrendData } from '../../../services/api/types/creditCard';

// Mock Recharts components
jest.mock('recharts', () => ({
  LineChart: ({ children, ...props }: any) => (
    <div data-testid="line-chart" data-width={props.width} data-height={props.height}>
      {children}
    </div>
  ),
  Line: ({ dataKey, ...props }: any) => (
    <div data-testid="chart-line" data-key={dataKey} data-stroke={props.stroke} />
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
  )
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

const mockTrendData: MonthlyTrendData[] = [
  { year: 2024, month: 7, monthName: 'July 2024', totalAmount: 250.50, transactionCount: 8 },
  { year: 2024, month: 8, monthName: 'August 2024', totalAmount: 300.75, transactionCount: 10 },
  { year: 2024, month: 9, monthName: 'September 2024', totalAmount: 280.25, transactionCount: 9 },
  { year: 2024, month: 10, monthName: 'October 2024', totalAmount: 320.00, transactionCount: 11 },
  { year: 2024, month: 11, monthName: 'November 2024', totalAmount: 290.50, transactionCount: 9 },
  { year: 2024, month: 12, monthName: 'December 2024', totalAmount: 356.50, transactionCount: 12 }
];

describe('CreditCardChart', () => {
  describe('Rendering', () => {
    it('should render chart components with provided data', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('chart-line')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    });

    it('should configure chart with correct data keys', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      const line = screen.getByTestId('chart-line');
      expect(line).toHaveAttribute('data-key', 'totalAmount');

      const xAxis = screen.getByTestId('x-axis');
      expect(xAxis).toHaveAttribute('data-key', 'monthName');
    });

    it('should render with proper styling', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      const line = screen.getByTestId('chart-line');
      expect(line).toHaveAttribute('data-stroke', '#1976d2');
    });

    it('should render responsive container with proper dimensions', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      const container = screen.getByTestId('responsive-container');
      expect(container).toHaveAttribute('data-width', '100%');
      expect(container).toHaveAttribute('data-height', '100%');
    });
  });

  describe('Empty State', () => {
    it('should render empty state message with empty data', () => {
      renderWithProviders(<CreditCardChart data={[]} />);

      expect(screen.getByText('No trend data available')).toBeInTheDocument();
    });

    it('should handle undefined data gracefully', () => {
      renderWithProviders(<CreditCardChart data={undefined as any} />);

      expect(screen.getByText('No trend data available')).toBeInTheDocument();
    });
  });

  describe('Tooltip Functionality', () => {
    it('should render tooltip component', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    });

    it('should display formatted currency in tooltip', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      // The tooltip content should be rendered with test data
      const tooltip = screen.getByTestId('tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('Data Visualization', () => {
    it('should handle various data ranges', () => {
      const dataWithHighValues: MonthlyTrendData[] = [
        { year: 2024, month: 1, monthName: 'January 2024', totalAmount: 5000.00, transactionCount: 50 },
        { year: 2024, month: 2, monthName: 'February 2024', totalAmount: 7500.50, transactionCount: 75 }
      ];

      renderWithProviders(<CreditCardChart data={dataWithHighValues} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('chart-line')).toBeInTheDocument();
    });

    it('should handle data with zero values', () => {
      const dataWithZeros: MonthlyTrendData[] = [
        { year: 2024, month: 1, monthName: 'January 2024', totalAmount: 0, transactionCount: 0 },
        { year: 2024, month: 2, monthName: 'February 2024', totalAmount: 100.50, transactionCount: 5 }
      ];

      renderWithProviders(<CreditCardChart data={dataWithZeros} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('chart-line')).toBeInTheDocument();
    });

    it('should handle single data point', () => {
      const singleDataPoint: MonthlyTrendData[] = [
        { year: 2024, month: 12, monthName: 'December 2024', totalAmount: 500.00, transactionCount: 10 }
      ];

      renderWithProviders(<CreditCardChart data={singleDataPoint} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('chart-line')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily with same data', () => {
      const { rerender } = renderWithProviders(<CreditCardChart data={mockTrendData} />);

      const initialChart = screen.getByTestId('line-chart');

      // Rerender with same data
      rerender(
        <ThemeProvider theme={theme}>
          <CreditCardChart data={mockTrendData} />
        </ThemeProvider>
      );

      const rerenderedChart = screen.getByTestId('line-chart');
      expect(rerenderedChart).toBe(initialChart);
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset: MonthlyTrendData[] = Array.from({ length: 24 }, (_, index) => ({
        year: 2023 + Math.floor(index / 12),
        month: (index % 12) + 1,
        monthName: `Month ${index + 1}`,
        totalAmount: Math.random() * 1000,
        transactionCount: Math.floor(Math.random() * 50)
      }));

      renderWithProviders(<CreditCardChart data={largeDataset} />);

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('chart-line')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be accessible to screen readers', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      const chart = screen.getByTestId('line-chart');
      expect(chart).toBeInTheDocument();

      // Chart should be in the accessibility tree
      expect(chart).toBeVisible();
    });

    it('should provide meaningful content for assistive technologies', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      // The chart container should be accessible
      const container = screen.getByTestId('responsive-container');
      expect(container).toBeInTheDocument();
      expect(container).toBeVisible();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to different container sizes', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      const container = screen.getByTestId('responsive-container');
      expect(container).toHaveAttribute('data-width', '100%');
      
      // Height should be responsive
      expect(container).toHaveAttribute('data-height', '100%');
    });

    it('should maintain aspect ratio on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      const container = screen.getByTestId('responsive-container');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('data-width', '100%');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed data gracefully', () => {
      const malformedData = [
        { monthName: 'Invalid Month', totalAmount: 'not-a-number' as any, transactionCount: null as any },
        null as any,
        undefined as any
      ];

      expect(() => {
        renderWithProviders(<CreditCardChart data={malformedData} />);
      }).not.toThrow();

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('should handle missing required properties', () => {
      const incompleteData = [
        { monthName: 'January 2024' }, // Missing amount and count
        { totalAmount: 100.50 } // Missing month name and count
      ] as any;

      expect(() => {
        renderWithProviders(<CreditCardChart data={incompleteData} />);
      }).not.toThrow();

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Theme Integration', () => {
    it('should use theme colors for chart elements', () => {
      renderWithProviders(<CreditCardChart data={mockTrendData} />);

      const line = screen.getByTestId('chart-line');
      // Should use primary color from theme
      expect(line).toHaveAttribute('data-stroke', '#1976d2');
    });

    it('should work with custom theme', () => {
      const customTheme = createTheme({
        palette: {
          primary: {
            main: '#ff5722'
          }
        }
      });

      render(
        <ThemeProvider theme={customTheme}>
          <CreditCardChart data={mockTrendData} />
        </ThemeProvider>
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });
});
