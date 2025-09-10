import { AxiosResponse } from 'axios';
import api from './base';
import {
  Transaction,
  Tag,
  GetTransactionsResponse,
  CategorizeTransactionRequest,
  CategorizeTransactionResponse,
  TransactionSummary,
  CategorySuggestion,
  UncategorizedStats
} from './types/transactions';
import type { Category } from './types';

export const transactionsApi = {
  // Main transaction methods
  getTransactions: (filters: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    category?: string;
    subCategory?: string;
    search?: string;
    limit?: number;
    skip?: number;
    accountId?: string;
    useProcessedDate?: boolean;
  }): Promise<GetTransactionsResponse> =>
    api.get<GetTransactionsResponse>('/transactions', { params: filters })
      .then((res: AxiosResponse<GetTransactionsResponse>) => res.data),

  getTransaction: (id: string): Promise<Transaction> =>
    api.get<Transaction>(`/transactions/${id}`)
      .then((res: AxiosResponse<Transaction>) => res.data),

  // Categorization methods
  categorizeTransaction: (
    transactionId: string,
    data: CategorizeTransactionRequest,
  ): Promise<CategorizeTransactionResponse> =>
    api.post<CategorizeTransactionResponse>(`/transactions/${transactionId}/categorize`, data)
      .then((res: AxiosResponse<CategorizeTransactionResponse>) => res.data),

  getSuggestion: (transactionId: string): Promise<{
    suggestion: CategorySuggestion;
    transaction: {
      id: string;
      description: string;
      amount: number;
    };
  }> =>
    api.post<{
      suggestion: CategorySuggestion;
      transaction: {
        id: string;
        description: string;
        amount: number;
      };
    }>(`/transactions/${transactionId}/suggest-category`)
      .then((res: AxiosResponse) => res.data),

  // Transaction detail methods
  getByAccount: (accountId: string, startDate?: Date, endDate?: Date): Promise<Transaction[]> =>
    api.get<Transaction[]>(`/transactions/account/${accountId}`, {
      params: { startDate, endDate }
    }).then((res: AxiosResponse<Transaction[]>) => res.data),

  getUncategorized: (accountId: string): Promise<Transaction[]> =>
    api.get<Transaction[]>(`/transactions/uncategorized/${accountId}`)
      .then((res: AxiosResponse<Transaction[]>) => res.data),

  getSummary: (accountId: string, startDate?: Date, endDate?: Date): Promise<TransactionSummary> =>
    api.get<TransactionSummary>(`/transactions/summary/${accountId}`, {
      params: { startDate, endDate }
    }).then((res: AxiosResponse<TransactionSummary>) => res.data),


  // Categories
  getCategories: (): Promise<Category[]> =>
    api.get<Category[]>('/transactions/categories')
      .then((res: AxiosResponse<Category[]>) => res.data),

  // Uncategorized stats for dashboard
  getUncategorizedStats: (): Promise<UncategorizedStats> =>
    api.get<UncategorizedStats>('/transactions/uncategorized-stats')
      .then((res: AxiosResponse<UncategorizedStats>) => res.data),

  // Tag management
  getTags: (): Promise<Tag[]> =>
    api.get<Tag[]>('/transactions/tags')
      .then((res: AxiosResponse<Tag[]>) => res.data),

  createTag: (name: string, color?: string): Promise<Tag> =>
    api.post<Tag>('/transactions/tags', { name, color })
      .then((res: AxiosResponse<Tag>) => res.data),

  addTagsToTransaction: (transactionId: string, tagNames: string[]): Promise<Transaction> =>
    api.post<Transaction>(`/transactions/${transactionId}/tags`, { tagNames })
      .then((res: AxiosResponse<Transaction>) => res.data),

  removeTagsFromTransaction: (transactionId: string, tagIds: string[]): Promise<Transaction> =>
    api.delete<Transaction>(`/transactions/${transactionId}/tags`, { data: { tagIds } })
      .then((res: AxiosResponse<Transaction>) => res.data)
};
