import api from './base';
import { Transaction, TransactionFilters, Category } from './types';

export interface TransactionApiResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

export const transactionsApi = {
  getCategories: async (): Promise<Category[]> => {
    const response = await api.get('/transactions/categories');
    return response.data;
  },

  getTransactions: async (
    filters: Partial<TransactionFilters>
  ): Promise<TransactionApiResponse> => {
    const {
      startDate,
      endDate,
      type,
      category,
      search,
      limit = 20,
      skip = 0,
      accountId,
      userId,
    } = filters;

    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    if (type) params.append('type', type); // Only add if type is a valid TransactionType
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    if (accountId) params.append('accountId', accountId);
    if (userId) params.append('userId', userId);
    params.append('limit', limit.toString());
    params.append('skip', skip.toString());

    const response = await api.get(`/transactions?${params}`);
    return response.data;
  },

  getUncategorized: async (accountId: string): Promise<Transaction[]> => {
    const response = await api.get(`/transactions/uncategorized/${accountId}`);
    return response.data;
  },

  getSummary: async (
    accountId: string,
  startDate: Date | undefined,
  endDate: Date | undefined
  ) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());

    const response = await api.get(`/transactions/summary/${accountId}?${params}`);
    return response.data;
  },

  categorizeTransaction: async (
    transactionId: string,
    categoryId: string,
    subCategoryId: string
  ): Promise<Transaction> => {
    const response = await api.post(`/transactions/${transactionId}/categorize`, {
      categoryId,
      subCategoryId,
    });
    return response.data;
  },
};
