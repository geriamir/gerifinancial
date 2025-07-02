import { Category, SubCategory } from './category';

export type TransactionType = 'Expense' | 'Income' | 'Transfer';
export type TransactionStatus = 'pending' | 'processed' | 'error';

export enum CategorizationMethod {
  Manual = 'manual',
  PreviousData = 'previous_data',
  AI = 'ai'
}

export interface Transaction {
  _id: string;
  userId: string;
  accountId: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  type: TransactionType;
  category?: Category;
  subCategory?: SubCategory;
  status: TransactionStatus;
  memo?: string;
  processedDate?: string;
  categorizationMethod?: CategorizationMethod;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

export interface TransactionFilters {
  startDate: Date;
  endDate: Date;
  type?: TransactionType;
  category?: string;
  search?: string;
  limit?: number;
  skip?: number;
  accountId?: string;
  userId?: string;
}
