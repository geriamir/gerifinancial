import api from './api/base';
import {
  InvestmentTransaction,
  InvestmentTransactionListResponse,
  InvestmentTransactionSummaryResponse,
  CostBasisResponse,
  InvestmentPerformanceResponse,
  ResyncHistoryResponse,
  InvestmentTransactionFilters,
  SymbolTransactionFilters,
  TransactionSummaryFilters,
  ResyncHistoryRequest
} from '../types/investmentTransaction';

export const investmentTransactionApi = {
  /**
   * Get all investment transactions for the current user
   */
  getInvestmentTransactions: async (
    filters: InvestmentTransactionFilters = {}
  ): Promise<InvestmentTransactionListResponse> => {
    const queryParams = new URLSearchParams();

    // Add filters as query parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const url = `/investments/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get<InvestmentTransactionListResponse>(url);
    
    return response.data;
  },

  /**
   * Get investment transactions for a specific investment account
   */
  getInvestmentTransactionsByInvestment: async (
    investmentId: string,
    filters: Omit<InvestmentTransactionFilters, 'investmentId'> = {}
  ): Promise<InvestmentTransactionListResponse> => {
    const queryParams = new URLSearchParams();

    // Add filters as query parameters (excluding investmentId since it's in the URL)
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const url = `/investments/${investmentId}/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get<InvestmentTransactionListResponse>(url);
    
    return response.data;
  },

  /**
   * Get transactions for a specific symbol across all investments
   */
  getTransactionsBySymbol: async (
    symbol: string,
    filters: SymbolTransactionFilters = {}
  ): Promise<{ transactions: InvestmentTransaction[] }> => {
    const queryParams = new URLSearchParams();

    // Add filters as query parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const url = `/investments/transactions/symbol/${encodeURIComponent(symbol)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get<{ transactions: InvestmentTransaction[] }>(url);
    
    return response.data;
  },

  /**
   * Get transaction summary with analytics
   */
  getTransactionSummary: async (
    filters: TransactionSummaryFilters = {}
  ): Promise<InvestmentTransactionSummaryResponse> => {
    const queryParams = new URLSearchParams();

    // Add filters as query parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const url = `/investments/transactions/summary${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get<InvestmentTransactionSummaryResponse>(url);
    
    return response.data;
  },

  /**
   * Get cost basis information for a symbol
   */
  getCostBasisBySymbol: async (symbol: string): Promise<CostBasisResponse> => {
    const url = `/investments/cost-basis/${encodeURIComponent(symbol)}`;
    const response = await api.get<CostBasisResponse>(url);
    
    return response.data;
  },

  /**
   * Get performance metrics for an investment based on transactions
   */
  getInvestmentPerformance: async (investmentId: string): Promise<InvestmentPerformanceResponse> => {
    const url = `/investments/${investmentId}/performance`;
    const response = await api.get<InvestmentPerformanceResponse>(url);
    
    return response.data;
  },

  /**
   * Resync historical transactions for a specific investment
   */
  resyncInvestmentHistory: async (
    investmentId: string,
    options: ResyncHistoryRequest = {}
  ): Promise<ResyncHistoryResponse> => {
    const url = `/investments/${investmentId}/resync-history`;
    const response = await api.post<ResyncHistoryResponse>(url, options);
    
    return response.data;
  },

  /**
   * Resync historical transactions for all investments in a bank account
   */
  resyncBankAccountHistory: async (
    bankAccountId: string,
    options: ResyncHistoryRequest = {}
  ): Promise<ResyncHistoryResponse> => {
    const url = `/investments/resync-history/${bankAccountId}`;
    const response = await api.post<ResyncHistoryResponse>(url, options);
    
    return response.data;
  }
};

/**
 * Helper functions for formatting and processing investment transactions
 */
export const investmentTransactionHelpers = {
  /**
   * Helper method to format transaction amount for display
   */
  formatTransactionAmount: (transaction: InvestmentTransaction): {
    shares: string;
    formattedAmount: string;
    color: string;
  } => {
    const absAmount = Math.abs(transaction.amount);
    const shares = transaction.transactionType === 'DIVIDEND' 
      ? '' 
      : `${absAmount.toLocaleString()} shares`;

    let formattedAmount: string;
    let color: string;

    switch (transaction.transactionType) {
      case 'BUY':
        formattedAmount = `+${absAmount.toLocaleString()}`;
        color = '#4caf50'; // Green
        break;
      case 'SELL':
        formattedAmount = `-${absAmount.toLocaleString()}`;
        color = '#f44336'; // Red
        break;
      case 'DIVIDEND':
        formattedAmount = `${transaction.value.toLocaleString()} ${transaction.currency}`;
        color = '#2196f3'; // Blue
        break;
      default:
        formattedAmount = `${transaction.amount.toLocaleString()}`;
        color = '#ff9800'; // Orange
    }

    return { shares, formattedAmount, color };
  },

  /**
   * Helper method to format transaction value for display
   */
  formatTransactionValue: (transaction: InvestmentTransaction): {
    formattedValue: string;
    netValue: string;
  } => {
    const value = Math.abs(transaction.value);
    const formattedValue = `${value.toLocaleString()} ${transaction.currency}`;

    // Calculate net value after taxes if applicable
    const netValue = transaction.taxSum 
      ? `${(value - Math.abs(transaction.taxSum)).toLocaleString()} ${transaction.currency} (net)`
      : formattedValue;

    return { formattedValue, netValue };
  },

  /**
   * Helper method to group transactions by symbol
   */
  groupTransactionsBySymbol: (transactions: InvestmentTransaction[]): Record<string, InvestmentTransaction[]> => {
    return transactions.reduce((groups, transaction) => {
      const symbol = transaction.symbol;
      if (!groups[symbol]) {
        groups[symbol] = [];
      }
      groups[symbol].push(transaction);
      return groups;
    }, {} as Record<string, InvestmentTransaction[]>);
  },

  /**
   * Helper method to group transactions by date
   */
  groupTransactionsByDate: (transactions: InvestmentTransaction[]): Record<string, InvestmentTransaction[]> => {
    return transactions.reduce((groups, transaction) => {
      const date = new Date(transaction.executionDate).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    }, {} as Record<string, InvestmentTransaction[]>);
  },

  /**
   * Helper method to calculate basic stats for a set of transactions
   */
  calculateTransactionStats: (transactions: InvestmentTransaction[]) => {
    const stats = {
      totalTransactions: transactions.length,
      buyTransactions: 0,
      sellTransactions: 0,
      dividendTransactions: 0,
      otherTransactions: 0,
      totalValue: 0,
      totalShares: 0,
      uniqueSymbols: new Set<string>(),
      dateRange: {
        earliest: null as Date | null,
        latest: null as Date | null
      }
    };

    transactions.forEach(transaction => {
      // Count transaction types
      switch (transaction.transactionType) {
        case 'BUY':
          stats.buyTransactions++;
          stats.totalShares += Math.abs(transaction.amount);
          break;
        case 'SELL':
          stats.sellTransactions++;
          stats.totalShares -= Math.abs(transaction.amount);
          break;
        case 'DIVIDEND':
          stats.dividendTransactions++;
          break;
        default:
          stats.otherTransactions++;
      }

      // Accumulate value
      stats.totalValue += Math.abs(transaction.value);

      // Track unique symbols
      stats.uniqueSymbols.add(transaction.symbol);

      // Track date range
      const transactionDate = new Date(transaction.executionDate);
      if (!stats.dateRange.earliest || transactionDate < stats.dateRange.earliest) {
        stats.dateRange.earliest = transactionDate;
      }
      if (!stats.dateRange.latest || transactionDate > stats.dateRange.latest) {
        stats.dateRange.latest = transactionDate;
      }
    });

    return {
      ...stats,
      uniqueSymbols: stats.uniqueSymbols.size
    };
  },

  /**
   * Helper method to validate date range
   */
  validateDateRange: (startDate?: string, endDate?: string): { isValid: boolean; error?: string } => {
    if (!startDate && !endDate) {
      return { isValid: true };
    }

    if (startDate && isNaN(Date.parse(startDate))) {
      return { isValid: false, error: 'Invalid start date format' };
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      return { isValid: false, error: 'Invalid end date format' };
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return { isValid: false, error: 'Start date must be before end date' };
    }

    return { isValid: true };
  },

  /**
   * Helper method to generate date range presets
   */
  getDateRangePresets: (): Array<{ label: string; startDate: string; endDate: string }> => {
    const now = new Date();
    const presets = [];

    // Last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    presets.push({
      label: 'Last 30 days',
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    });

    // Last 3 months
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    presets.push({
      label: 'Last 3 months',
      startDate: threeMonthsAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    });

    // Last 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    presets.push({
      label: 'Last 6 months',
      startDate: sixMonthsAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    });

    // Last year
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    presets.push({
      label: 'Last year',
      startDate: oneYearAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    });

    return presets;
  }
};

// Export default as the API object for compatibility
export default investmentTransactionApi;
