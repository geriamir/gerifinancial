import type { Category, SubCategory } from '../types';

export interface Transaction {
  _id: string;
  identifier: string;
  accountId: string;
  amount: number;
  currency: string;
  date: string;
  type?: 'Expense' | 'Income' | 'Transfer';
  description: string;
  memo?: string;
  category?: Category;
  subCategory?: SubCategory;
  categorizationMethod: 'manual' | 'previous_data' | 'ai';
  categorizationReasoning?: string;
  rawData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userId: string;
  status: 'verified' | 'deleted';
}

export interface GetTransactionsResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

export interface CategorizeTransactionRequest {
  categoryId: string;
  subCategoryId: string;
  saveAsManual?: boolean;
  matchingFields?: {
    description?: string;
    memo?: string;
  };
}

export interface CategorySuggestion {
  categoryId: string;
  subCategoryId: string;
  confidence: number;
  reasoning: string;
}

export interface TransactionSummary {
  expenses: Array<{
    _id: {
      category: string;
      currency: string;
    };
    total: number;
    count: number;
    categoryDetails: Category[];
  }>;
  income: Array<{
    _id: {
      category: string;
      currency: string;
    };
    total: number;
    count: number;
    categoryDetails: Category[];
  }>;
  totalExpenses: number;
  totalIncome: number;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  type?: string;
  category?: string;
  subCategory?: string;
  search?: string;
  accountId?: string;
  useProcessedDate?: boolean;
}

export interface UncategorizedStats {
  total: number;
}

export interface CategorizeTransactionResponse {
  transaction: Transaction;
  historicalUpdates?: {
    updatedCount: number;
  };
}
