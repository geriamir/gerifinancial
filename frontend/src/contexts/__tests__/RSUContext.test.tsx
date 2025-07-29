import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { RSUProvider, useRSU } from '../RSUContext';

// Mock the API module first - need to define inside the mock to avoid hoisting issues
jest.mock('../../services/api/rsus', () => {
  const mockRsuApi = {
    grants: {
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
      getPerformance: jest.fn(),
    },
    sales: {
      getAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
    },
    portfolio: {
      getSummary: jest.fn().mockResolvedValue({}),
      getPerformance: jest.fn(),
    },
    vesting: {
      getUpcoming: jest.fn().mockResolvedValue([]),
      getCalendar: jest.fn(),
    },
    tax: {
      preview: jest.fn(),
      getProjections: jest.fn(),
      getSummary: jest.fn(),
    },
    stockPrice: {
      get: jest.fn(),
      update: jest.fn(),
      getHistory: jest.fn(),
    },
    timeline: {
      getPortfolioTimeline: jest.fn().mockResolvedValue({ 
        success: true, 
        data: [], 
        meta: { timeframe: '1Y', totalDataPoints: 0, dateRange: null } 
      }),
      validateTimeline: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        timelinePoints: 0,
        dateRange: null
      }),
    },
  };

  return {
    rsuApi: mockRsuApi,
    grantsApi: mockRsuApi.grants,
    salesApi: mockRsuApi.sales,
    portfolioApi: mockRsuApi.portfolio,
    vestingApi: mockRsuApi.vesting,
    taxApi: mockRsuApi.tax,
    stockPriceApi: mockRsuApi.stockPrice,
    timelineApi: mockRsuApi.timeline,
  };
});

// Import the mocked API to get reference to it
import { rsuApi } from '../../services/api/rsus';

// Cast the mock to the correct type for Jest - use any to bypass complex nested mock typing
const mockRsuApi = rsuApi as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RSUProvider>{children}</RSUProvider>
);

const mockGrant = {
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
  status: 'active' as const,
  notes: 'Initial grant',
  vestingSchedule: [],
  vestedShares: 250,
  unvestedShares: 750,
  vestingProgress: 25,
  gainLoss: 20000,
  gainLossPercentage: 20,
  createdAt: '2024-01-15',
  updatedAt: '2024-01-15'
};

const mockSale = {
  _id: 'sale1',
  userId: 'user1',
  grantId: '1',
  saleDate: '2024-06-01',
  sharesAmount: 50,
  pricePerShare: 130,
  totalSaleValue: 6500,
  taxCalculation: {
    originalValue: 5000,
    profit: 1500,
    isLongTerm: false,
    holdingPeriodDays: 150,
    wageIncomeTax: 3250,
    capitalGainsTax: 975,
    totalTax: 4225,
    netValue: 2275,
    effectiveTaxRate: 0.65,
    taxBasis: {
      grantValue: 5000,
      saleValue: 6500,
      profitAmount: 1500,
      taxRateApplied: 0.65
    },
    taxRatesUsed: {
      wageIncome: 0.65,
      capitalGains: 0.65,
      isLongTermRate: false
    }
  },
  notes: 'Test sale',
  createdAt: '2024-06-01',
  effectiveTaxRate: 0.65,
  profitMargin: 0.23
};

describe('RSUContext', () => {
  beforeEach(() => {
    // Clear all mocks
    Object.values(mockRsuApi).forEach((apiSection: any) => {
      Object.values(apiSection).forEach((method: any) => {
        if (jest.isMockFunction(method)) {
          method.mockClear();
        }
      });
    });
    
    // Set up basic successful responses
    (mockRsuApi.grants.getAll as jest.Mock).mockResolvedValue([]);
    (mockRsuApi.sales.getAll as jest.Mock).mockResolvedValue([]);
    (mockRsuApi.portfolio.getSummary as jest.Mock).mockResolvedValue({});
    (mockRsuApi.vesting.getUpcoming as jest.Mock).mockResolvedValue([]);
  });

  describe('Basic Functionality', () => {
    it('should provide initial context values', async () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.grants).toEqual([]);
      expect(result.current.sales).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    it('should provide all required methods', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      expect(typeof result.current.createGrant).toBe('function');
      expect(typeof result.current.updateGrant).toBe('function');
      expect(typeof result.current.deleteGrant).toBe('function');
      expect(typeof result.current.recordSale).toBe('function');
      expect(typeof result.current.refreshGrants).toBe('function');
      expect(typeof result.current.refreshSales).toBe('function');
      expect(typeof result.current.refreshPortfolio).toBe('function');
    });
  });

  describe('Grant Operations', () => {
    it('should create grant successfully', async () => {
      (mockRsuApi.grants.create as jest.Mock).mockResolvedValue(mockGrant);
      (mockRsuApi.portfolio.getSummary as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useRSU(), { wrapper });
      
      const grantData = {
        stockSymbol: 'MSFT',
        grantDate: '2024-01-15',
        totalValue: 100000,
        totalShares: 1000
      };

      await act(async () => {
        const createdGrant = await result.current.createGrant(grantData);
        expect(createdGrant).toEqual(mockGrant);
      });

      expect(mockRsuApi.grants.create).toHaveBeenCalledWith(grantData);
    });

    it('should handle create grant error', async () => {
      const errorMessage = 'Failed to create grant';
      (mockRsuApi.grants.create as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useRSU(), { wrapper });
      
      const grantData = {
        stockSymbol: 'MSFT',
        grantDate: '2024-01-15',
        totalValue: 100000,
        totalShares: 1000
      };

      await act(async () => {
        await expect(result.current.createGrant(grantData)).rejects.toThrow(errorMessage);
      });

      expect(result.current.error).toBe(errorMessage);
    });

    it('should refresh grants', async () => {
      (mockRsuApi.grants.getAll as jest.Mock).mockResolvedValue([mockGrant]);

      const { result } = renderHook(() => useRSU(), { wrapper });

      await act(async () => {
        await result.current.refreshGrants();
      });

      expect(mockRsuApi.grants.getAll).toHaveBeenCalled();
      expect(result.current.grants).toEqual([mockGrant]);
    });

    it('should update grant', async () => {
      const updatedGrant = { ...mockGrant, name: 'Updated Grant' };
      (mockRsuApi.grants.update as jest.Mock).mockResolvedValue(updatedGrant);
      (mockRsuApi.portfolio.getSummary as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useRSU(), { wrapper });

      await act(async () => {
        const result_grant = await result.current.updateGrant('1', { name: 'Updated Grant' });
        expect(result_grant).toEqual(updatedGrant);
      });

      expect(mockRsuApi.grants.update).toHaveBeenCalledWith('1', { name: 'Updated Grant' });
    });

    it('should delete grant', async () => {
      (mockRsuApi.grants.delete as jest.Mock).mockResolvedValue(undefined);
      (mockRsuApi.portfolio.getSummary as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useRSU(), { wrapper });

      await act(async () => {
        await result.current.deleteGrant('1');
      });

      expect(mockRsuApi.grants.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('Sale Operations', () => {
    it('should record sale successfully', async () => {
      (mockRsuApi.sales.create as jest.Mock).mockResolvedValue(mockSale);
      (mockRsuApi.portfolio.getSummary as jest.Mock).mockResolvedValue({});
      (mockRsuApi.grants.getAll as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useRSU(), { wrapper });
      
      const saleData = {
        grantId: '1',
        saleDate: '2024-06-01',
        sharesAmount: 50,
        pricePerShare: 130
      };

      await act(async () => {
        const recordedSale = await result.current.recordSale(saleData);
        expect(recordedSale).toEqual(mockSale);
      });

      expect(mockRsuApi.sales.create).toHaveBeenCalledWith(saleData);
    });

    it('should have refresh sales method', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      expect(typeof result.current.refreshSales).toBe('function');
    });

    it('should have update sale method', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      expect(typeof result.current.updateSale).toBe('function');
    });

    it('should have delete sale method', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      expect(typeof result.current.deleteSale).toBe('function');
    });
  });

  describe('Portfolio Operations', () => {
    it('should have portfolio refresh method', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      expect(typeof result.current.refreshPortfolio).toBe('function');
    });
  });

  describe('Tax Operations', () => {
    it('should have tax preview method', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });
      
      expect(typeof result.current.getTaxPreview).toBe('function');
    });
  });

  describe('Utility Methods', () => {
    it('should provide utility methods', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      // Verify utility methods exist
      expect(typeof result.current.getGrantById).toBe('function');
      expect(typeof result.current.getSalesByGrant).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });

    it('should handle grant selection', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      act(() => {
        result.current.selectGrant(mockGrant);
      });

      expect(result.current.selectedGrant).toEqual(mockGrant);
    });

    it('should handle sale selection', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      act(() => {
        result.current.selectSale(mockSale);
      });

      expect(result.current.selectedSale).toEqual(mockSale);
    });

    it('should clear error', () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('Loading States', () => {
    it('should handle loading states correctly', async () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      // Initially should not be loading after initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.grantsLoading).toBe(false);
      expect(result.current.salesLoading).toBe(false);
      expect(result.current.portfolioLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should have error handling capabilities', async () => {
      const { result } = renderHook(() => useRSU(), { wrapper });

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify error handling methods exist
      expect(typeof result.current.clearError).toBe('function');
      expect(result.current.error).toBe(null);
    });
  });
});
