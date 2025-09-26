import api from './base';
import { 
  CreditCardWithStats,
  CreditCardDetails,
  CreditCardBasicStats,
  CreditCardMonthlyStats,
  CreditCardTrend,
  CreditCardTransactionFilters,
  CreditCardTransactionsResult
} from './types/creditCard';

export const creditCardsApi = {
  getAll: async (): Promise<CreditCardWithStats[]> => {
    const response = await api.get('/credit-cards');
    return response.data;
  },

  getDetails: async (id: string): Promise<CreditCardDetails> => {
    const response = await api.get(`/credit-cards/${id}`);
    return response.data;
  },

  getBasicStats: async (id: string): Promise<CreditCardBasicStats> => {
    const response = await api.get(`/credit-cards/${id}/stats`);
    return response.data;
  },

  getMonthlyStats: async (id: string, year: number, month: number): Promise<CreditCardMonthlyStats> => {
    const response = await api.get(`/credit-cards/${id}/stats/${year}/${month}`);
    return response.data;
  },

  getTransactions: async (id: string, filters?: CreditCardTransactionFilters): Promise<CreditCardTransactionsResult> => {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.startDate) {
        params.append('startDate', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate.toISOString());
      }
      if (filters.category) {
        params.append('category', filters.category);
      }
      if (filters.subCategory) {
        params.append('subCategory', filters.subCategory);
      }
      if (filters.minAmount !== undefined) {
        params.append('minAmount', filters.minAmount.toString());
      }
      if (filters.maxAmount !== undefined) {
        params.append('maxAmount', filters.maxAmount.toString());
      }
      if (filters.description) {
        params.append('description', filters.description);
      }
      if (filters.page) {
        params.append('page', filters.page.toString());
      }
      if (filters.limit) {
        params.append('limit', filters.limit.toString());
      }
      if (filters.sortBy) {
        params.append('sortBy', filters.sortBy);
      }
      if (filters.sortOrder) {
        params.append('sortOrder', filters.sortOrder);
      }
    }

    const queryString = params.toString();
    const url = `/credit-cards/${id}/transactions${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    return response.data;
  },

  getTrend: async (id: string): Promise<CreditCardTrend> => {
    const response = await api.get(`/credit-cards/${id}/trend`);
    return response.data;
  }
};
