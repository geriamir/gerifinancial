import { useState, useEffect, useCallback } from 'react';
import {
  InvestmentTransaction,
  InvestmentTransactionListResponse,
  InvestmentTransactionFilters,
  InvestmentTransactionError,
  DEFAULT_TRANSACTION_FILTERS
} from '../types/investmentTransaction';
import { investmentTransactionApi } from '../services/investmentTransactionService';

interface UseInvestmentTransactionsOptions {
  initialFilters?: InvestmentTransactionFilters;
  autoFetch?: boolean;
  investmentId?: string; // If provided, fetches transactions for specific investment
}

export function useInvestmentTransactions({
  initialFilters = DEFAULT_TRANSACTION_FILTERS,
  autoFetch = true,
  investmentId
}: UseInvestmentTransactionsOptions = {}) {
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<InvestmentTransactionError | null>(null);
  const [filters, setFilters] = useState<InvestmentTransactionFilters>(initialFilters);

  const fetchTransactions = useCallback(async (
    newFilters?: InvestmentTransactionFilters,
    append = false
  ) => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = newFilters || filters;
      let response: InvestmentTransactionListResponse;

      if (investmentId) {
        // Fetch transactions for specific investment
        const { investmentId: _, ...restFilters } = currentFilters;
        response = await investmentTransactionApi.getInvestmentTransactionsByInvestment(
          investmentId,
          restFilters
        );
      } else {
        // Fetch all user transactions
        response = await investmentTransactionApi.getInvestmentTransactions(currentFilters);
      }

      if (append) {
        setTransactions(prev => [...prev, ...response.transactions]);
      } else {
        setTransactions(response.transactions);
      }

      setTotalCount(response.totalCount);
      setHasMore(response.hasMore);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to fetch transactions',
        details: err
      });
    } finally {
      setLoading(false);
    }
  }, [filters, investmentId]);

  const refetch = useCallback(() => {
    return fetchTransactions(undefined, false);
  }, [fetchTransactions]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    const newFilters = {
      ...filters,
      offset: (filters.offset || 0) + (filters.limit || DEFAULT_TRANSACTION_FILTERS.limit || 50)
    };

    await fetchTransactions(newFilters, true);
  }, [fetchTransactions, filters, hasMore, loading]);

  const updateFilters = useCallback((newFilters: InvestmentTransactionFilters) => {
    const updatedFilters = {
      ...newFilters,
      offset: 0 // Reset offset when filters change
    };
    
    setFilters(updatedFilters);
    
    // Auto-fetch with new filters
    if (autoFetch) {
      fetchTransactions(updatedFilters, false);
    }
  }, [autoFetch, fetchTransactions]);

  const clearFilters = useCallback(() => {
    const clearedFilters = { ...DEFAULT_TRANSACTION_FILTERS };
    updateFilters(clearedFilters);
  }, [updateFilters]);

  // Initial fetch
  useEffect(() => {
    if (autoFetch) {
      fetchTransactions();
    }
  }, [autoFetch]); // Only depend on autoFetch to avoid infinite re-renders

  // Recalculate hasMore when transactions or filters change
  const currentOffset = filters.offset || 0;
  const currentLimit = filters.limit || DEFAULT_TRANSACTION_FILTERS.limit || 50;
  const expectedTransactionCount = currentOffset + currentLimit;
  const actualHasMore = transactions.length < totalCount && totalCount > expectedTransactionCount;

  return {
    // Data
    transactions,
    totalCount,
    hasMore: actualHasMore,
    
    // State
    loading,
    error,
    filters,
    
    // Actions
    refetch,
    loadMore,
    setFilters: updateFilters,
    clearFilters,
    
    // Manual fetch (when autoFetch is false)
    fetchTransactions: () => fetchTransactions(undefined, false)
  };
}

export default useInvestmentTransactions;
