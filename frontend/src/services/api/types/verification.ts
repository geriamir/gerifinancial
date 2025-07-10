export interface BatchProgress {
  total: number;
  current: number;
  successful: number;
  failed: number;
}

export interface VerificationResult {
  success: boolean;
  error?: string;
  timestamp: string;
}

export interface BatchVerificationResult extends VerificationResult {
  progress: BatchProgress;
  details: {
    transactionId: string;
    success: boolean;
    error?: string;
  }[];
}

export interface GetVerificationStatsResponse {
  count: number;
  value: number;
}

export interface ApiVerificationStats {
  totalVerified: GetVerificationStatsResponse;
  totalPending: GetVerificationStatsResponse;
  avgVerificationTime: GetVerificationStatsResponse;
  batchVerificationRate: GetVerificationStatsResponse;
  needs_verification: boolean;
}

export interface VerificationStats {
  totalVerified: number;
  totalPending: number;
  avgVerificationTime: number; // Keep for backward compatibility
  averageVerificationTime: number; // New standardized name
  batchVerificationRate: number;
  successRate: number;
  needs_verification?: boolean;
}

// Pagination types that support both offset and page-based pagination
export interface OffsetPaginationParams {
  limit?: number;
  offset?: number;
  skip?: number; // Alias for offset, used in some APIs
}

export interface PagePaginationParams {
  page?: number;
  pageSize?: number;
}

export type PaginationParams = OffsetPaginationParams | PagePaginationParams;

export interface SortingParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface GetUnverifiedTransactionsParams extends 
  DateRangeParams,
  SortingParams {
  accountId?: string;
  status?: string;
  // Support both pagination styles
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  skip?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
  offset?: number;
  hasMore: boolean;
}

// Helper function to convert from API response to standardized stats
export const normalizeVerificationStats = (
  response: ApiVerificationStats
): VerificationStats => ({
  totalVerified: response.totalVerified.count,
  totalPending: response.totalPending.count,
  avgVerificationTime: response.avgVerificationTime.value,
  averageVerificationTime: response.avgVerificationTime.value,
  batchVerificationRate: response.batchVerificationRate.value,
  successRate: response.totalVerified.count / 
    (response.totalVerified.count + response.totalPending.count) * 100,
  needs_verification: response.needs_verification
});

// Helper function to calculate stats with default values
export const createEmptyVerificationStats = (): VerificationStats => ({
  totalVerified: 0,
  totalPending: 0,
  avgVerificationTime: 0,
  averageVerificationTime: 0,
  batchVerificationRate: 0,
  successRate: 0,
  needs_verification: false
});

// Helper function to convert between pagination styles
export const normalizePaginationParams = (params: GetUnverifiedTransactionsParams) => {
  const normalized: GetUnverifiedTransactionsParams = { ...params };

  // Convert page-based to offset-based if needed
  if (params.page !== undefined && params.pageSize !== undefined) {
    normalized.offset = params.page * params.pageSize;
    normalized.limit = params.pageSize;
    delete normalized.page;
    delete normalized.pageSize;
  }

  // Handle skip alias
  if (params.skip !== undefined) {
    normalized.offset = params.skip;
    delete normalized.skip;
  }

  return normalized;
};
