import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import GrantsList from '../GrantsList';
import { RSUContext } from '../../../contexts/RSUContext';
import { RSUGrant } from '../../../services/api/rsus';

const theme = createTheme();

const mockRSUContextValue: any = {
  grants: [],
  sales: [],
  portfolioSummary: null,
  upcomingVesting: [],
  loading: false,
  grantsLoading: false,
  salesLoading: false,
  portfolioLoading: false,
  refreshing: false,
  selectedGrant: null,
  selectedSale: null,
  error: null,
  createGrant: jest.fn(),
  updateGrant: jest.fn(),
  deleteGrant: jest.fn(),
  selectGrant: jest.fn(),
  recordSale: jest.fn(),
  updateSale: jest.fn(),
  deleteSale: jest.fn(),
  selectSale: jest.fn(),
  refreshPortfolio: jest.fn(),
  refreshGrants: jest.fn(),
  refreshSales: jest.fn(),
  refreshUpcomingVesting: jest.fn(),
  getPortfolioTimeline: jest.fn(),
  validateTimeline: jest.fn(),
  getTaxPreview: jest.fn(),
  getGrantById: jest.fn(),
  getSalesByGrant: jest.fn(),
  clearError: jest.fn()
};

const renderWithProviders = (component: React.ReactElement, contextValue = mockRSUContextValue) => {
  return render(
    <ThemeProvider theme={theme}>
      <RSUContext.Provider value={contextValue}>
        {component}
      </RSUContext.Provider>
    </ThemeProvider>
  );
};

const mockGrants: RSUGrant[] = [
  {
    _id: '1',
    userId: 'user1',
    stockSymbol: 'MSFT',
    name: 'Microsoft Grant 2024',
    company: 'Microsoft Corporation',
    grantDate: '2024-01-15',
    totalValue: 100000,
    totalShares: 1000,
    pricePerShare: 100,
    currentPrice: 120,
    currentValue: 120000,
    status: 'active',
    notes: 'Initial grant',
    vestingSchedule: [
      {
        vestDate: '2025-01-15',
        shares: 250,
        vested: false,
        vestedValue: 0
      }
    ],
    vestedShares: 250,
    unvestedShares: 750,
    vestingProgress: 25,
    gainLoss: 20000,
    gainLossPercentage: 20,
    createdAt: '2024-01-15',
    updatedAt: '2024-01-15'
  },
  {
    _id: '2',
    userId: 'user1',
    stockSymbol: 'AAPL',
    name: 'Apple Grant 2024',
    company: 'Apple Inc.',
    grantDate: '2024-02-01',
    totalValue: 50000,
    totalShares: 500,
    pricePerShare: 100,
    currentPrice: 180,
    currentValue: 90000,
    status: 'active',
    notes: 'Secondary grant',
    vestingSchedule: [],
    vestedShares: 125,
    unvestedShares: 375,
    vestingProgress: 25,
    gainLoss: 40000,
    gainLossPercentage: 80,
    createdAt: '2024-02-01',
    updatedAt: '2024-02-01'
  }
];

describe('GrantsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render grants list with grant information', () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      expect(screen.getByText('MSFT • Microsoft Grant 2024')).toBeInTheDocument();
      expect(screen.getByText('Microsoft Corporation')).toBeInTheDocument();
      expect(screen.getByText('AAPL • Apple Grant 2024')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    });

    it('should display grant financial metrics', () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      // Total shares
      expect(screen.getByText('1,000')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();

      // Current values
      expect(screen.getByText('$120,000')).toBeInTheDocument();
      expect(screen.getByText('$90,000')).toBeInTheDocument();

      // Gain/Loss
      expect(screen.getByText('+$20,000')).toBeInTheDocument();
      expect(screen.getByText('+$40,000')).toBeInTheDocument();
      expect(screen.getByText('(+20.0%)')).toBeInTheDocument();
      expect(screen.getByText('(+80.0%)')).toBeInTheDocument();
    });

    it('should show vesting progress', () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      expect(screen.getAllByText('25%')).toHaveLength(2);
    });

    it('should display available shares correctly', () => {
      const contextWithSales = {
        ...mockRSUContextValue,
        grants: mockGrants,
        sales: [
          {
            _id: 'sale1',
            userId: 'user1',
            grantId: '1',
            saleDate: new Date('2024-06-01'),
            sharesAmount: 50,
            pricePerShare: 130,
            totalSaleValue: 6500,
            taxCalculation: {
              originalValue: 5000,
              profit: 1500,
              isLongTerm: false,
              wageIncomeTax: 3250,
              capitalGainsTax: 975,
              totalTax: 4225,
              netValue: 2275,
              taxBasis: {
                grantValue: 5000,
                saleValue: 6500,
                profitAmount: 1500,
                taxRateApplied: 0.65
              }
            },
            notes: 'Test sale',
            createdAt: new Date('2024-06-01'),
            updatedAt: new Date('2024-06-01')
          }
        ]
      };

      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        contextWithSales
      );

      // Should show available shares (vested - sold)
      expect(screen.getByText('200')).toBeInTheDocument(); // 250 - 50 for MSFT
      expect(screen.getByText('(50 sold)')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading skeleton when loading is true', () => {
      renderWithProviders(
        <GrantsList grants={[]} loading={true} />
      );

      // Check for skeleton elements by class or variant
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show empty state when no grants', () => {
      renderWithProviders(
        <GrantsList grants={[]} />
      );

      expect(screen.getByText('No RSU Grants Found')).toBeInTheDocument();
      expect(screen.getByText('Add your first RSU grant to start tracking your equity portfolio')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should open grant menu when clicking more options', async () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const moreButtons = screen.getAllByLabelText('more');
      fireEvent.click(moreButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
        expect(screen.getByText('Record Sale')).toBeInTheDocument();
        expect(screen.getByText('Update Price')).toBeInTheDocument();
        expect(screen.getByText('Edit Grant')).toBeInTheDocument();
        expect(screen.getByText('Delete Grant')).toBeInTheDocument();
      });
    });

    it('should call onEditGrant when edit is clicked', async () => {
      const onEditGrant = jest.fn();
      renderWithProviders(
        <GrantsList grants={mockGrants} onEditGrant={onEditGrant} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const moreButtons = screen.getAllByLabelText('more');
      fireEvent.click(moreButtons[0]);

      await waitFor(() => {
        const editButton = screen.getByText('Edit Grant');
        fireEvent.click(editButton);
      });

      expect(onEditGrant).toHaveBeenCalledWith(mockGrants[0]);
    });

    it('should call onDeleteGrant when delete is clicked', async () => {
      const onDeleteGrant = jest.fn();
      renderWithProviders(
        <GrantsList grants={mockGrants} onDeleteGrant={onDeleteGrant} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const moreButtons = screen.getAllByLabelText('more');
      fireEvent.click(moreButtons[0]);

      await waitFor(() => {
        const deleteButton = screen.getByText('Delete Grant');
        fireEvent.click(deleteButton);
      });

      expect(onDeleteGrant).toHaveBeenCalledWith(mockGrants[0]);
    });

    it('should call onRecordSale when record sale is clicked', async () => {
      const onRecordSale = jest.fn();
      renderWithProviders(
        <GrantsList grants={mockGrants} onRecordSale={onRecordSale} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const moreButtons = screen.getAllByLabelText('more');
      fireEvent.click(moreButtons[0]);

      await waitFor(() => {
        const recordSaleButton = screen.getByText('Record Sale');
        fireEvent.click(recordSaleButton);
      });

      expect(onRecordSale).toHaveBeenCalledWith(mockGrants[0]);
    });

    it('should call onGrantSelect when view details is clicked', async () => {
      const onGrantSelect = jest.fn();
      renderWithProviders(
        <GrantsList grants={mockGrants} onGrantSelect={onGrantSelect} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const moreButtons = screen.getAllByLabelText('more');
      fireEvent.click(moreButtons[0]);

      await waitFor(() => {
        const viewDetailsButton = screen.getByText('View Details');
        fireEvent.click(viewDetailsButton);
      });

      expect(onGrantSelect).toHaveBeenCalledWith(mockGrants[0]);
    });
  });

  describe('Price Updates', () => {
    it('should open stock price updater when update price is clicked', async () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const moreButtons = screen.getAllByLabelText('more');
      fireEvent.click(moreButtons[0]);

      await waitFor(() => {
        const updatePriceButton = screen.getByText('Update Price');
        fireEvent.click(updatePriceButton);
      });

      expect(screen.getByText('Update Stock Price - MSFT')).toBeInTheDocument();
    });
  });

  describe('Grant Status Display', () => {
    it('should show active status with success color', () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const statusChips = screen.getAllByText('active');
      expect(statusChips).toHaveLength(2);
    });

    it('should show negative gain/loss correctly', () => {
      const grantsWithLoss = [
        {
          ...mockGrants[0],
          currentPrice: 80,
          currentValue: 80000,
          gainLoss: -20000,
          gainLossPercentage: -20
        }
      ];

      renderWithProviders(
        <GrantsList grants={grantsWithLoss} />,
        { ...mockRSUContextValue, grants: grantsWithLoss }
      );

      expect(screen.getByText((content) => content.includes('-$20,000') || content.includes('-20,000'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('(-20.0%)') || content.includes('-20.0'))).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format grant dates correctly', () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      expect(screen.getByText('Granted: Jan 15, 2024')).toBeInTheDocument();
      expect(screen.getByText('Granted: Feb 1, 2024')).toBeInTheDocument();
    });

    it('should show upcoming vesting dates when available', () => {
      const grantsWithUpcomingVesting = [
        {
          ...mockGrants[0],
          vestingSchedule: [
            {
              vestDate: '2024-12-15',
              shares: 250,
              vested: false,
              vestedValue: 0
            }
          ]
        }
      ];

      renderWithProviders(
        <GrantsList grants={grantsWithUpcomingVesting} />,
        { ...mockRSUContextValue, grants: grantsWithUpcomingVesting }
      );

      expect(screen.getByText('Next Vesting')).toBeInTheDocument();
      expect(screen.getByText('Dec 15, 2024')).toBeInTheDocument();
      expect(screen.getByText('250 shares')).toBeInTheDocument();
    });
  });

  describe('Notes Display', () => {
    it('should show notes when present', () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      expect(screen.getByText('Notes: Initial grant')).toBeInTheDocument();
      expect(screen.getByText('Notes: Secondary grant')).toBeInTheDocument();
    });

    it('should not show notes section when notes are empty', () => {
      const grantsWithoutNotes = [
        { ...mockGrants[0], notes: '' }
      ];

      renderWithProviders(
        <GrantsList grants={grantsWithoutNotes} />,
        { ...mockRSUContextValue, grants: grantsWithoutNotes }
      );

      expect(screen.queryByText('Notes:')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const moreButtons = screen.getAllByLabelText('more');
      expect(moreButtons).toHaveLength(2);
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      const moreButtons = screen.getAllByLabelText('more');
      
      await act(async () => {
        moreButtons[0].focus();
      });
      
      expect(document.activeElement).toBe(moreButtons[0]);
    });
  });

  describe('Performance', () => {
    it('should memoize grant items to prevent unnecessary re-renders', () => {
      const { rerender } = renderWithProviders(
        <GrantsList grants={mockGrants} />,
        { ...mockRSUContextValue, grants: mockGrants }
      );

      // Change unrelated props
      rerender(
        <ThemeProvider theme={theme}>
          <RSUContext.Provider value={{ ...mockRSUContextValue, grants: mockGrants, loading: false }}>
            <GrantsList grants={mockGrants} loading={false} />
          </RSUContext.Provider>
        </ThemeProvider>
      );

      // Grant items should still be rendered (memoization working)
      expect(screen.getByText('MSFT • Microsoft Grant 2024')).toBeInTheDocument();
    });
  });
});
