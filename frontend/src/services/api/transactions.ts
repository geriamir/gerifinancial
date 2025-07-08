import { AxiosResponse } from 'axios';
import api from './base';
import {
  Transaction,
  PendingTransaction,
  GetTransactionsResponse,
  GetPendingTransactionsResponse,
  ProcessingStats,
  VerifyTransactionsResponse,
  SimilarTransactionsResponse,
  CategorizeTransactionRequest,
  TransactionSummary,
  CategorySuggestion
} from './types/transactions';
import { Category } from './types/categories';

export const transactionsApi = {
  // Main transaction methods
  getTransactions: (filters: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    category?: string;
    search?: string;
    limit?: number;
    skip?: number;
    accountId?: string;
  }): Promise<GetTransactionsResponse> =>
    api.get<GetTransactionsResponse>('/transactions', { params: filters })
      .then((res: AxiosResponse<GetTransactionsResponse>) => res.data),

  getTransaction: (id: string): Promise<Transaction> =>
    api.get<Transaction>(`/transactions/${id}`)
      .then((res: AxiosResponse<Transaction>) => res.data),

  // Pending transaction methods
  getPendingTransactions: (params: { limit?: number; skip?: number; accountId?: string }): Promise<GetPendingTransactionsResponse> =>
    api.get<GetPendingTransactionsResponse>('/transactions/pending', { params })
      .then((res: AxiosResponse<GetPendingTransactionsResponse>) => res.data),

  getProcessingStats: (): Promise<ProcessingStats> =>
    api.get<ProcessingStats>('/transactions/processing-stats')
      .then((res: AxiosResponse<ProcessingStats>) => res.data),

  verifyTransaction: (transactionId: string): Promise<Transaction> =>
    api.post<Transaction>(`/transactions/${transactionId}/verify`)
      .then((res: AxiosResponse<Transaction>) => res.data),

  verifyBatch: (transactionIds: string[]): Promise<VerifyTransactionsResponse> =>
    api.post<VerifyTransactionsResponse>('/transactions/verify-batch', { transactionIds })
      .then((res: AxiosResponse<VerifyTransactionsResponse>) => res.data),

  // Categorization methods
  categorizeTransaction: (
    transactionId: string,
    data: CategorizeTransactionRequest,
  ): Promise<Transaction | PendingTransaction> =>
    api.post<Transaction | PendingTransaction>(`/transactions/${transactionId}/categorize`, data)
      .then((res: AxiosResponse<Transaction | PendingTransaction>) => res.data),

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

  // Find similar pending transactions for batch verification
  findSimilarPendingTransactions: (transactionId: string): Promise<SimilarTransactionsResponse> =>
    api.get<SimilarTransactionsResponse>(`/transactions/${transactionId}/similar`)
      .then((res: AxiosResponse<SimilarTransactionsResponse>) => res.data),

  // Categories
  getCategories: (): Promise<Category[]> =>
    api.get<Category[]>('/transactions/categories')
      .then((res: AxiosResponse<Category[]>) => res.data)
};
