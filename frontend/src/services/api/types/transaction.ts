import type { Category, SubCategory } from '../types';

export type { Category, SubCategory };

export type TransactionStatus = 'pending' | 'needs_verification' | 'verified' | 'processed' | 'error';
export type TransactionType = 'Expense' | 'Income' | 'Transfer';
export type CategorizationMethod = 'manual' | 'previous_data' | 'ai';

export interface Transaction {
  _id: string;
  identifier: string;
  accountId: string;
  userId: string;
  amount: number;
  currency: string;
  date: string;
  type: TransactionType;
  description: string;
  memo?: string;
  category?: Category;
  subCategory?: SubCategory;
  categorizationMethod?: CategorizationMethod;
  status: TransactionStatus;
  rawData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

export interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  type?: TransactionType;
  category?: string;
  search?: string;
  accountId?: string;
  limit?: number;
  skip?: number;
}

export interface VerificationStats {
  pending: number;
  needs_verification: number;
  verified: number;
  processed: number;
  error: number;
}

export interface CategorySuggestion {
  categoryId: string;
  subCategoryId: string;
  confidence: number;
  reasoning: string;
}

export interface TransactionVerification {
  message: string;
  transaction: Transaction;
}

export interface BatchVerificationResult {
  message: string;
  successful: Array<{ id: string; success: true }>;
  failed: Array<{ id: string; success: false; error: string }>;
}

export interface SimilarTransactionsResponse {
  transactions: Transaction[];
  similarity: number;
}
