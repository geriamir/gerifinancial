import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDebounce } from './useDebounce';
import type {
  PaginationParams,
  PaginatedResponse
} from '../services/api/types/verification';
import {
  UsePaginationOptions,
  createPagination,
  isPaginationComplete,
  getNextPageParams,
  DEFAULT_PAGE_SIZE,
  isOffsetPagination,
  isPagePagination
} from '../utils/pagination';

interface UsePaginationReturn<T> {
  // Current state
  items: T[];
  total: number;
  loading: boolean;
  error: Error | null;
  hasMore: boolean;

  // Pagination params
  params: PaginationParams;
  pageSize: number;
  currentPage: number;

  // Actions
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
  reset: () => void;
  setPageSize: (size: number) => void;
  goToPage: (page: number) => Promise<void>;

  // State flags
  isFirstPage: boolean;
  isLastPage: boolean;
}

export function usePagination<T>(
  fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [params, setParams] = useState<PaginationParams>(() => createPagination(options));
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const debouncedPage = useDebounce(pendingPage, 300);

  const pageSize = useMemo(() => {
    if (isPagePagination(params)) {
      return params.pageSize || DEFAULT_PAGE_SIZE;
    }
    return isOffsetPagination(params) 
      ? params.limit || DEFAULT_PAGE_SIZE 
      : DEFAULT_PAGE_SIZE;
  }, [params]);

  const currentPage = useMemo(() => {
    if (isPagePagination(params)) {
      return params.page || 0;
    }
    if (isOffsetPagination(params)) {
      const offset = params.offset || params.skip || 0;
      return Math.floor(offset / pageSize);
    }
    return 0;
  }, [params, pageSize]);

  const fetchPage = useCallback(async (nextParams: PaginationParams) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchFn(nextParams);
      setTotal(response.total);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  const loadMore = useCallback(async () => {
    if (loading || isPaginationComplete({ total, items, hasMore: true }, params)) {
      return;
    }

    const nextParams = getNextPageParams(params, total);
    if (nextParams === params) return; // No more pages

    const response = await fetchPage(nextParams);
    setItems(prevItems => [...prevItems, ...response.items]);
    setParams(nextParams);
  }, [loading, total, items, params, fetchPage]);

  const reload = useCallback(async () => {
    setItems([]);
    const initialParams = createPagination(options);
    const response = await fetchPage(initialParams);
    setItems(response.items);
    setParams(initialParams);
  }, [options, fetchPage]);

  const reset = useCallback(() => {
    setItems([]);
    setTotal(0);
    setError(null);
    setParams(createPagination(options));
  }, [options]);

  const setPageSize = useCallback((newSize: number) => {
    if (isPagePagination(params)) {
      setParams({ ...params, pageSize: newSize });
    } else if (isOffsetPagination(params)) {
      setParams({ ...params, limit: newSize });
    }
  }, [params]);

  const goToPage = useCallback((page: number): Promise<void> => {
    setPendingPage(page);
    return Promise.resolve();
  }, []);

  useEffect(() => {
    if (debouncedPage === null) return;

    let mounted = true;

    const handlePageChange = async () => {
      try {
        const updatedParams: PaginationParams = isPagePagination(params)
          ? { ...params, page: debouncedPage }
          : { ...params, offset: debouncedPage * pageSize };

        if (!mounted) return;
        setLoading(true);
        setError(null);

        const response = await fetchPage(updatedParams);
        
        if (!mounted) return;

        setItems(response.items);
        setParams(updatedParams);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof Error) {
          setError(error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    handlePageChange();

    return () => {
      mounted = false;
    };
  }, [debouncedPage, params, pageSize, fetchPage]);

  const hasMore = !isPaginationComplete({ total, items, hasMore: true }, params);
  const isFirstPage = currentPage === 0;
  const isLastPage = !hasMore;

  return {
    // Current state
    items,
    total,
    loading,
    error,
    hasMore,

    // Pagination params
    params,
    pageSize,
    currentPage,

    // Actions
    loadMore,
    reload,
    reset,
    setPageSize,
    goToPage,

    // State flags
    isFirstPage,
    isLastPage
  };
}
