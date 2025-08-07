import api from './base';
import {
  Investment,
  PortfolioSummary,
  PortfolioTrend,
  PerformanceMetrics,
  HoldingHistory,
  InvestmentSnapshot,
  SyncResult,
  InvestmentFilters
} from './types/investment';

// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  details?: any[];
}

export const investmentApi = {
  // Get user's investments
  getUserInvestments: async (filters?: InvestmentFilters): Promise<Investment[]> => {
    const params = new URLSearchParams();
    if (filters?.bankAccountId) params.append('bankAccountId', filters.bankAccountId);
    if (filters?.accountType) params.append('accountType', filters.accountType);
    if (filters?.status) params.append('status', filters.status);
    
    const response = await api.get<{ investments: Investment[] }>(`/investments?${params.toString()}`);
    return response.data.investments;
  },

  // Get investment by ID
  getInvestmentById: async (investmentId: string): Promise<Investment> => {
    const response = await api.get<{ investment: Investment }>(`/investments/${investmentId}`);
    return response.data.investment;
  },

  // Get portfolio summary
  getPortfolioSummary: async (): Promise<PortfolioSummary> => {
    const response = await api.get<{ portfolio: PortfolioSummary }>('/investments/portfolio/summary');
    return response.data.portfolio;
  },

  // Get investments by bank account
  getInvestmentsByBankAccount: async (bankAccountId: string): Promise<Investment[]> => {
    const response = await api.get<{ investments: Investment[] }>(`/investments/by-bank/${bankAccountId}`);
    return response.data.investments;
  },

  // Historical data endpoints
  getInvestmentHistory: async (investmentId: string, days: number = 30): Promise<InvestmentSnapshot[]> => {
    const response = await api.get<{ history: InvestmentSnapshot[] }>(`/investments/${investmentId}/history?days=${days}`);
    return response.data.history;
  },

  getPortfolioTrends: async (days: number = 30): Promise<PortfolioTrend[]> => {
    const response = await api.get<{ trends: PortfolioTrend[] }>(`/investments/portfolio/trends?days=${days}`);
    return response.data.trends;
  },

  getPerformanceMetrics: async (days: number = 30): Promise<PerformanceMetrics> => {
    const response = await api.get<{ performance: PerformanceMetrics }>(`/investments/portfolio/performance?days=${days}`);
    return response.data.performance;
  },

  getHoldingsHistory: async (symbol: string, days: number = 90): Promise<HoldingHistory[]> => {
    const response = await api.get<{ history: HoldingHistory[] }>(`/investments/holdings/${symbol}/history?days=${days}`);
    return response.data.history;
  },

  // Sync operations
  syncInvestments: async (bankAccountId: string, options?: any): Promise<SyncResult> => {
    const response = await api.post<{ result: SyncResult }>(`/investments/sync/${bankAccountId}`, { options });
    return response.data.result;
  },

  syncAllData: async (bankAccountId: string, options?: any): Promise<any> => {
    const response = await api.post<any>(`/investments/sync-all/${bankAccountId}`, { options });
    return response.data;
  },

  getSyncStatus: async (bankAccountId: string): Promise<any> => {
    const response = await api.get<{ status: any }>(`/investments/sync/status/${bankAccountId}`);
    return response.data.status;
  },

  // Price updates
  updatePrices: async (priceUpdates: Record<string, number>): Promise<{ updatedCount: number }> => {
    const response = await api.post<{ updatedCount: number }>('/investments/prices/update', { priceUpdates });
    return { updatedCount: response.data.updatedCount };
  },

  // Delete investment
  deleteInvestment: async (investmentId: string): Promise<Investment> => {
    const response = await api.delete<{ investment: Investment }>(`/investments/${investmentId}`);
    return response.data.investment;
  }
};
