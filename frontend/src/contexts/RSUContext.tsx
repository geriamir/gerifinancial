import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { rsuApi, RSUGrant, RSUSale, PortfolioSummary, CreateGrantData, CreateSaleData, TaxPreviewRequest, UpcomingVestingEvent } from '../services/api/rsus';

// State interface
interface RSUState {
  // Data
  grants: RSUGrant[];
  sales: RSUSale[];
  portfolioSummary: PortfolioSummary | null;
  upcomingVesting: UpcomingVestingEvent[];
  
  // Loading states
  loading: boolean;
  grantsLoading: boolean;
  salesLoading: boolean;
  portfolioLoading: boolean;
  refreshing: boolean;
  
  // UI states
  selectedGrant: RSUGrant | null;
  selectedSale: RSUSale | null;
  
  // Error states
  error: string | null;
}

// Action types
type RSUActionType =
  | 'SET_LOADING'
  | 'SET_GRANTS_LOADING'
  | 'SET_SALES_LOADING'
  | 'SET_PORTFOLIO_LOADING'
  | 'SET_REFRESHING'
  | 'SET_ERROR'
  | 'SET_GRANTS'
  | 'SET_SALES'
  | 'SET_PORTFOLIO_SUMMARY'
  | 'SET_UPCOMING_VESTING'
  | 'ADD_GRANT'
  | 'UPDATE_GRANT'
  | 'DELETE_GRANT'
  | 'ADD_SALE'
  | 'UPDATE_SALE'
  | 'DELETE_SALE'
  | 'SET_SELECTED_GRANT'
  | 'SET_SELECTED_SALE'
  | 'CLEAR_ERROR';

interface RSUAction {
  type: RSUActionType;
  payload?: any;
}

// Initial state
const initialState: RSUState = {
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
};

// Reducer
const rsuReducer = (state: RSUState, action: RSUAction): RSUState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_GRANTS_LOADING':
      return { ...state, grantsLoading: action.payload };
    case 'SET_SALES_LOADING':
      return { ...state, salesLoading: action.payload };
    case 'SET_PORTFOLIO_LOADING':
      return { ...state, portfolioLoading: action.payload };
    case 'SET_REFRESHING':
      return { ...state, refreshing: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_GRANTS':
      // Sort grants by grant date (newest first), then by creation date
      const sortedGrants = [...action.payload].sort((a, b) => {
        const dateA = new Date(a.grantDate).getTime();
        const dateB = new Date(b.grantDate).getTime();
        if (dateA !== dateB) {
          return dateB - dateA; // Newer first
        }
        // If grant dates are the same, sort by creation date
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      return { ...state, grants: sortedGrants, grantsLoading: false };
    case 'SET_SALES':
      return { ...state, sales: action.payload, salesLoading: false };
    case 'SET_PORTFOLIO_SUMMARY':
      return { ...state, portfolioSummary: action.payload, portfolioLoading: false };
    case 'SET_UPCOMING_VESTING':
      return { ...state, upcomingVesting: action.payload };
    case 'ADD_GRANT':
      // Add the new grant and maintain sorted order (newest first)
      const newGrants = [...state.grants, action.payload].sort((a, b) => {
        const dateA = new Date(a.grantDate).getTime();
        const dateB = new Date(b.grantDate).getTime();
        if (dateA !== dateB) {
          return dateB - dateA; // Newer first
        }
        // If grant dates are the same, sort by creation date
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      return { ...state, grants: newGrants };
    case 'UPDATE_GRANT':
      return {
        ...state,
        grants: state.grants.map(grant =>
          grant._id === action.payload._id ? action.payload : grant
        ),
        selectedGrant: state.selectedGrant?._id === action.payload._id ? action.payload : state.selectedGrant
      };
    case 'DELETE_GRANT':
      return {
        ...state,
        grants: state.grants.filter(grant => grant._id !== action.payload),
        selectedGrant: state.selectedGrant?._id === action.payload ? null : state.selectedGrant
      };
    case 'ADD_SALE':
      return { ...state, sales: [action.payload, ...state.sales] };
    case 'UPDATE_SALE':
      return {
        ...state,
        sales: state.sales.map(sale =>
          sale._id === action.payload._id ? action.payload : sale
        ),
        selectedSale: state.selectedSale?._id === action.payload._id ? action.payload : state.selectedSale
      };
    case 'DELETE_SALE':
      return {
        ...state,
        sales: state.sales.filter(sale => sale._id !== action.payload),
        selectedSale: state.selectedSale?._id === action.payload ? null : state.selectedSale
      };
    case 'SET_SELECTED_GRANT':
      return { ...state, selectedGrant: action.payload };
    case 'SET_SELECTED_SALE':
      return { ...state, selectedSale: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

// Context interface
interface RSUContextType extends RSUState {
  // Grant operations
  createGrant: (grantData: CreateGrantData) => Promise<RSUGrant>;
  updateGrant: (grantId: string, updates: Partial<CreateGrantData>) => Promise<RSUGrant>;
  deleteGrant: (grantId: string) => Promise<void>;
  selectGrant: (grant: RSUGrant | null) => void;
  
  // Sale operations
  recordSale: (saleData: CreateSaleData) => Promise<RSUSale>;
  updateSale: (saleId: string, updates: Partial<CreateSaleData>) => Promise<RSUSale>;
  deleteSale: (saleId: string) => Promise<void>;
  selectSale: (sale: RSUSale | null) => void;
  
  // Data refresh
  refreshPortfolio: () => Promise<void>;
  refreshGrants: () => Promise<void>;
  refreshSales: () => Promise<void>;
  refreshUpcomingVesting: (days?: number) => Promise<void>;
  
  // Utilities
  getTaxPreview: (request: TaxPreviewRequest) => Promise<any>;
  getGrantById: (grantId: string) => RSUGrant | undefined;
  getSalesByGrant: (grantId: string) => RSUSale[];
  clearError: () => void;
}

// Create context
const RSUContext = createContext<RSUContextType | undefined>(undefined);

// Provider component
interface RSUProviderProps {
  children: ReactNode;
}

export const RSUProvider: React.FC<RSUProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(rsuReducer, initialState);

  // Error handler
  const handleError = (error: any) => {
    const errorMessage = error.response?.data?.error || error.message || 'An error occurred';
    dispatch({ type: 'SET_ERROR', payload: errorMessage });
    console.error('RSU Error:', error);
  };

  // Grant operations
  const createGrant = async (grantData: CreateGrantData): Promise<RSUGrant> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const grant = await rsuApi.grants.create(grantData);
      dispatch({ type: 'ADD_GRANT', payload: grant });
      
      // Refresh portfolio summary after adding grant
      refreshPortfolio();
      
      return grant;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateGrant = async (grantId: string, updates: Partial<CreateGrantData>): Promise<RSUGrant> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const grant = await rsuApi.grants.update(grantId, updates);
      dispatch({ type: 'UPDATE_GRANT', payload: grant });
      
      // Refresh portfolio summary after updating grant
      refreshPortfolio();
      
      return grant;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteGrant = async (grantId: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await rsuApi.grants.delete(grantId);
      dispatch({ type: 'DELETE_GRANT', payload: grantId });
      
      // Remove associated sales
      const associatedSales = state.sales.filter(sale => sale.grantId === grantId);
      associatedSales.forEach(sale => {
        dispatch({ type: 'DELETE_SALE', payload: sale._id });
      });
      
      // Refresh portfolio summary after deleting grant
      refreshPortfolio();
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const selectGrant = (grant: RSUGrant | null) => {
    dispatch({ type: 'SET_SELECTED_GRANT', payload: grant });
  };

  // Sale operations
  const recordSale = async (saleData: CreateSaleData): Promise<RSUSale> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const sale = await rsuApi.sales.create(saleData);
      dispatch({ type: 'ADD_SALE', payload: sale });
      
      // Refresh portfolio summary and grants after recording sale
      refreshPortfolio();
      refreshGrants();
      
      return sale;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateSale = async (saleId: string, updates: Partial<CreateSaleData>): Promise<RSUSale> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const sale = await rsuApi.sales.update(saleId, updates);
      dispatch({ type: 'UPDATE_SALE', payload: sale });
      
      // Refresh portfolio summary after updating sale
      refreshPortfolio();
      
      return sale;
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteSale = async (saleId: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await rsuApi.sales.delete(saleId);
      dispatch({ type: 'DELETE_SALE', payload: saleId });
      
      // Refresh portfolio summary after deleting sale
      refreshPortfolio();
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const selectSale = (sale: RSUSale | null) => {
    dispatch({ type: 'SET_SELECTED_SALE', payload: sale });
  };

  // Data refresh functions
  const refreshPortfolio = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_PORTFOLIO_LOADING', payload: true });
      const summary = await rsuApi.portfolio.getSummary();
      dispatch({ type: 'SET_PORTFOLIO_SUMMARY', payload: summary });
    } catch (error) {
      handleError(error);
    } finally {
      dispatch({ type: 'SET_PORTFOLIO_LOADING', payload: false });
    }
  };

  const refreshGrants = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_GRANTS_LOADING', payload: true });
      const grants = await rsuApi.grants.getAll();
      dispatch({ type: 'SET_GRANTS', payload: grants });
    } catch (error) {
      handleError(error);
    } finally {
      dispatch({ type: 'SET_GRANTS_LOADING', payload: false });
    }
  };

  const refreshSales = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_SALES_LOADING', payload: true });
      const sales = await rsuApi.sales.getAll();
      dispatch({ type: 'SET_SALES', payload: sales });
    } catch (error) {
      handleError(error);
    } finally {
      dispatch({ type: 'SET_SALES_LOADING', payload: false });
    }
  };

  const refreshUpcomingVesting = async (days: number = 30): Promise<void> => {
    try {
      const upcomingVesting = await rsuApi.vesting.getUpcoming(days);
      dispatch({ type: 'SET_UPCOMING_VESTING', payload: upcomingVesting });
    } catch (error) {
      handleError(error);
    }
  };

  // Utilities
  const getTaxPreview = async (request: TaxPreviewRequest): Promise<any> => {
    try {
      return await rsuApi.tax.preview(request);
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  const getGrantById = (grantId: string): RSUGrant | undefined => {
    return state.grants.find(grant => grant._id === grantId);
  };

  const getSalesByGrant = (grantId: string): RSUSale[] => {
    return state.sales.filter(sale => {
      const saleGrantId = typeof sale.grantId === 'string' ? sale.grantId : (sale.grantId as any)?._id;
      return saleGrantId === grantId;
    });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Initial data load - load all data together to prevent double renders
  useEffect(() => {
    const loadInitialData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Load all data in parallel to prevent sequential loading re-renders
        // Set upcoming vesting to 3 months (90 days)
        await Promise.all([
          refreshGrants(),
          refreshSales(),    // Load sales with grants to prevent double render
          refreshPortfolio(),
          refreshUpcomingVesting(90)
        ]);
      } catch (error) {
        handleError(error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadInitialData();
  }, []);

  // Context value
  const contextValue: RSUContextType = {
    // State
    ...state,
    
    // Grant operations
    createGrant,
    updateGrant,
    deleteGrant,
    selectGrant,
    
    // Sale operations
    recordSale,
    updateSale,
    deleteSale,
    selectSale,
    
    // Data refresh
    refreshPortfolio,
    refreshGrants,
    refreshSales,
    refreshUpcomingVesting,
    
    // Utilities
    getTaxPreview,
    getGrantById,
    getSalesByGrant,
    clearError,
  };

  return (
    <RSUContext.Provider value={contextValue}>
      {children}
    </RSUContext.Provider>
  );
};

// Hook to use RSU context
export const useRSU = (): RSUContextType => {
  const context = useContext(RSUContext);
  if (!context) {
    throw new Error('useRSU must be used within an RSUProvider');
  }
  return context;
};

export default RSUContext;
