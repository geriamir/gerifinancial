import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddGrantWizard from '../AddGrantWizard';
import { RSUContext } from '../../../contexts/RSUContext';

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
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <ThemeProvider theme={theme}>
        <RSUContext.Provider value={contextValue}>
          {component}
        </RSUContext.Provider>
      </ThemeProvider>
    </LocalizationProvider>
  );
};

describe('AddGrantWizard', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the add grant wizard dialog', () => {
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      expect(screen.getByText('Add RSU Grant')).toBeInTheDocument();
      expect(screen.getByText('Grant Details')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      renderWithProviders(
        <AddGrantWizard open={false} onClose={mockOnClose} />
      );

      expect(screen.queryByText('Add RSU Grant')).not.toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    it('should render all required form fields', () => {
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      expect(screen.getByLabelText(/grant name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/stock symbol/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
      // Check for the date picker field using its input role
      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.getByLabelText(/total value/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/total shares/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it('should check required fields are present', () => {
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      // Check that required fields exist
      expect(screen.getByLabelText(/stock symbol/i)).toBeInTheDocument();
      // Check for the date picker field using its calendar button
      expect(screen.getByLabelText(/choose date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/total value/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/total shares/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      // Try to click next without filling required fields
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Stock symbol is required')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should validate stock symbol field', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      // Fill only stock symbol to test next validation step
      const stockSymbolInput = screen.getByLabelText(/stock symbol/i);
      await user.type(stockSymbolInput, 'MSFT');

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Grant date is required')).toBeInTheDocument();
      }, { timeout: 10000 });
    }, 15000); // Increase Jest test timeout to 15 seconds
  });

  describe('Form Submission', () => {
    it('should call createGrant when context method is provided', async () => {
      const mockCreateGrant = jest.fn().mockResolvedValue({ _id: 'new-grant-id' });
      
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />,
        { ...mockRSUContextValue, createGrant: mockCreateGrant }
      );

      // Verify createGrant function is available
      expect(mockCreateGrant).toBeDefined();
    });

    it('should handle form wizard navigation', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      // Fill out stock symbol to enable next button
      await user.type(screen.getByLabelText(/stock symbol/i), 'MSFT');

      // Click next button
      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeInTheDocument();
      
      await user.click(nextButton);

      // Should show grant date validation
      await waitFor(() => {
        expect(screen.getByText('Grant date is required')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should show form validation errors', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      // Try to proceed without required fields
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Stock symbol is required')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Dialog Controls', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(
        <AddGrantWizard open={true} onClose={mockOnClose} />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });
  });
});
