import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import RecordSaleForm from '../RecordSaleForm';
import RSUContext from '../../../contexts/RSUContext';

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

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <RSUContext.Provider value={mockRSUContextValue}>
          {component}
        </RSUContext.Provider>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

describe('RecordSaleForm', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the record sale form dialog', () => {
    renderWithProviders(
      <RecordSaleForm open={true} onClose={mockOnClose} grant={null} />
    );

    expect(screen.getByText('Record RSU Sale')).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    renderWithProviders(
      <RecordSaleForm open={false} onClose={mockOnClose} grant={null} />
    );

    expect(screen.queryByText('Record RSU Sale')).not.toBeInTheDocument();
  });
});
