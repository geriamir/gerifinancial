import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { investmentApi } from '../services/api/investments';
import {
  Investment,
  PortfolioSummary,
  PortfolioTrend,
  PerformanceMetrics,
  InvestmentContextState,
  InvestmentFilters
} from '../services/api/types/investment';

interface InvestmentContextType extends InvestmentContextState {
  // Data fetching
  refreshInvestments: (filters?: InvestmentFilters) => Promise<void>;
  getInvestmentById: (id: string) => Promise<Investment>;
  refreshPortfolioSummary: () => Promise<void>;
  getPortfolioTrends: (days?: number) => Promise<void>;
  getPerformanceMetrics: (days?: number) => Promise<void>;
  
  // Investment management
  syncInvestments: (bankAccountId: string, options?: any) => Promise<void>;
  updatePrices: (priceUpdates: Record<string, number>) => Promise<void>;
  deleteInvestment: (investmentId: string) => Promise<void>;
  
  // Utility functions
  clearError: () => void;
  getInvestmentsByBankAccount: (bankAccountId: string) => Investment[];
  getTotalPortfolioValue: () => number;
}

type InvestmentAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_INVESTMENTS'; payload: Investment[] }
  | { type: 'SET_PORTFOLIO_SUMMARY'; payload: PortfolioSummary }
  | { type: 'SET_PORTFOLIO_TRENDS'; payload: PortfolioTrend[] }
  | { type: 'SET_PERFORMANCE_METRICS'; payload: PerformanceMetrics }
  | { type: 'UPDATE_INVESTMENT'; payload: Investment }
  | { type: 'REMOVE_INVESTMENT'; payload: string };

const initialState: InvestmentContextState = {
  investments: [],
  portfolioSummary: null,
  portfolioTrends: [],
  performanceMetrics: null,
  loading: false,
  error: null
};

function investmentReducer(state: InvestmentContextState, action: InvestmentAction): InvestmentContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_INVESTMENTS':
      return { ...state, investments: action.payload, loading: false, error: null };
    
    case 'SET_PORTFOLIO_SUMMARY':
      return { ...state, portfolioSummary: action.payload, loading: false, error: null };
    
    case 'SET_PORTFOLIO_TRENDS':
      return { ...state, portfolioTrends: action.payload, loading: false, error: null };
    
    case 'SET_PERFORMANCE_METRICS':
      return { ...state, performanceMetrics: action.payload, loading: false, error: null };
    
    case 'UPDATE_INVESTMENT':
      return {
        ...state,
        investments: state.investments.map(inv => 
          inv._id === action.payload._id ? action.payload : inv
        ),
        loading: false,
        error: null
      };
    
    case 'REMOVE_INVESTMENT':
      return {
        ...state,
        investments: state.investments.filter(inv => inv._id !== action.payload),
        loading: false,
        error: null
      };
    
    default:
      return state;
  }
}

const InvestmentContext = createContext<InvestmentContextType | undefined>(undefined);

export const useInvestment = (): InvestmentContextType => {
  const context = useContext(InvestmentContext);
  if (!context) {
    throw new Error('useInvestment must be used within an InvestmentProvider');
  }
  return context;
};

interface InvestmentProviderProps {
  children: ReactNode;
}

export const InvestmentProvider: React.FC<InvestmentProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(investmentReducer, initialState);

  const handleError = useCallback((error: any, action: string) => {
    console.error(`Investment ${action} error:`, error);
    const message = error?.response?.data?.error || error?.message || `Failed to ${action}`;
    dispatch({ type: 'SET_ERROR', payload: message });
  }, []);

  const refreshInvestments = useCallback(async (filters?: InvestmentFilters) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const investments = await investmentApi.getUserInvestments(filters);
      dispatch({ type: 'SET_INVESTMENTS', payload: investments });
    } catch (error) {
      handleError(error, 'refresh investments');
    }
  }, [handleError]);

  const getInvestmentById = useCallback(async (id: string): Promise<Investment> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const investment = await investmentApi.getInvestmentById(id);
      dispatch({ type: 'UPDATE_INVESTMENT', payload: investment });
      return investment;
    } catch (error) {
      handleError(error, 'get investment');
      throw error;
    }
  }, [handleError]);

  const refreshPortfolioSummary = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const summary = await investmentApi.getPortfolioSummary();
      dispatch({ type: 'SET_PORTFOLIO_SUMMARY', payload: summary });
    } catch (error) {
      handleError(error, 'refresh portfolio summary');
    }
  }, [handleError]);

  const getPortfolioTrends = useCallback(async (days: number = 30) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const trends = await investmentApi.getPortfolioTrends(days);
      dispatch({ type: 'SET_PORTFOLIO_TRENDS', payload: trends });
    } catch (error) {
      handleError(error, 'get portfolio trends');
    }
  }, [handleError]);

  const getPerformanceMetrics = useCallback(async (days: number = 30) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const metrics = await investmentApi.getPerformanceMetrics(days);
      dispatch({ type: 'SET_PERFORMANCE_METRICS', payload: metrics });
    } catch (error) {
      handleError(error, 'get performance metrics');
    }
  }, [handleError]);

  const syncInvestments = useCallback(async (bankAccountId: string, options?: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await investmentApi.syncInvestments(bankAccountId, options);
      // Refresh data after sync
      await refreshInvestments();
      await refreshPortfolioSummary();
    } catch (error) {
      handleError(error, 'sync investments');
    }
  }, [handleError, refreshInvestments, refreshPortfolioSummary]);

  const updatePrices = useCallback(async (priceUpdates: Record<string, number>) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await investmentApi.updatePrices(priceUpdates);
      // Refresh data after price update
      await refreshInvestments();
      await refreshPortfolioSummary();
    } catch (error) {
      handleError(error, 'update prices');
    }
  }, [handleError, refreshInvestments, refreshPortfolioSummary]);

  const deleteInvestment = useCallback(async (investmentId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await investmentApi.deleteInvestment(investmentId);
      dispatch({ type: 'REMOVE_INVESTMENT', payload: investmentId });
      // Refresh portfolio summary after deletion
      await refreshPortfolioSummary();
    } catch (error) {
      handleError(error, 'delete investment');
    }
  }, [handleError, refreshPortfolioSummary]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const getInvestmentsByBankAccount = useCallback((bankAccountId: string): Investment[] => {
    return state.investments.filter(inv => inv.bankAccountId === bankAccountId);
  }, [state.investments]);

  const getTotalPortfolioValue = useCallback((): number => {
    return state.portfolioSummary?.totalValue || 0;
  }, [state.portfolioSummary]);

  const contextValue: InvestmentContextType = {
    ...state,
    refreshInvestments,
    getInvestmentById,
    refreshPortfolioSummary,
    getPortfolioTrends,
    getPerformanceMetrics,
    syncInvestments,
    updatePrices,
    deleteInvestment,
    clearError,
    getInvestmentsByBankAccount,
    getTotalPortfolioValue
  };

  return (
    <InvestmentContext.Provider value={contextValue}>
      {children}
    </InvestmentContext.Provider>
  );
};
