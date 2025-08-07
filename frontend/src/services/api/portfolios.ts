import api from './base';
import {
  Portfolio,
  PortfolioSummary,
  PortfolioTrend,
  PortfolioPerformanceMetrics,
  InvestmentHistory,
  PortfolioFilters
} from './types/portfolio';

export const portfolioApi = {
  // Get all portfolios for user
  getUserPortfolios: async (filters?: PortfolioFilters): Promise<Portfolio[]> => {
    const params = new URLSearchParams();
    if (filters?.bankAccountId) params.append('bankAccountId', filters.bankAccountId);
    if (filters?.portfolioType) params.append('portfolioType', filters.portfolioType);
    if (filters?.status) params.append('status', filters.status);
    
    const response = await api.get<Portfolio[]>(`/portfolios?${params.toString()}`);
    return response.data;
  },

  // Get portfolio by ID
  getPortfolioById: async (portfolioId: string): Promise<Portfolio> => {
    const response = await api.get<Portfolio>(`/portfolios/${portfolioId}`);
    return response.data;
  },

  // Get portfolio summary
  getPortfolioSummary: async (): Promise<PortfolioSummary> => {
    const response = await api.get<PortfolioSummary>('/portfolios/summary/overview');
    return response.data;
  },

  // Get portfolio performance metrics
  getPerformanceMetrics: async (days: number = 30): Promise<PortfolioPerformanceMetrics> => {
    const response = await api.get<PortfolioPerformanceMetrics>(`/portfolios/metrics/performance?days=${days}`);
    return response.data;
  },

  // Get portfolio trends
  getPortfolioTrends: async (days: number = 30): Promise<PortfolioTrend[]> => {
    const response = await api.get<PortfolioTrend[]>(`/portfolios/trends/history?days=${days}`);
    return response.data;
  },

  // Get portfolio history for specific portfolio
  getPortfolioHistory: async (portfolioId: string, days: number = 30): Promise<any[]> => {
    const response = await api.get<any[]>(`/portfolios/${portfolioId}/history?days=${days}`);
    return response.data;
  },

  // Get investment history by symbol across all portfolios
  getInvestmentHistory: async (symbol: string, days: number = 90): Promise<InvestmentHistory[]> => {
    const response = await api.get<InvestmentHistory[]>(`/portfolios/investments/${symbol}/history?days=${days}`);
    return response.data;
  },

  // Update portfolio prices
  updatePortfolioPrices: async (priceUpdates: Record<string, number>): Promise<{ updatedPortfolios: number }> => {
    const response = await api.put<{ updatedPortfolios: number }>('/portfolios/prices/update', { priceUpdates });
    return { updatedPortfolios: response.data.updatedPortfolios };
  },

  // Delete/close portfolio
  deletePortfolio: async (portfolioId: string): Promise<Portfolio> => {
    const response = await api.delete<{ portfolio: Portfolio }>(`/portfolios/${portfolioId}`);
    return response.data.portfolio;
  },

  // Get portfolios by bank account
  getPortfoliosByBankAccount: async (bankAccountId: string): Promise<Portfolio[]> => {
    const response = await api.get<Portfolio[]>(`/portfolios/bank-account/${bankAccountId}`);
    return response.data;
  }
};
