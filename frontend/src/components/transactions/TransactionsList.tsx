import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Alert, Typography, CircularProgress } from '@mui/material';
import { format } from 'date-fns';
import { formatCurrencyDisplay } from '../../utils/formatters';
import { transactionsApi } from '../../services/api/transactions';
import type { Transaction, TransactionFilters } from '../../services/api/types/transactions';
import TransactionRow from './TransactionRow';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

const PAGE_SIZE = 20; // Match test expectations

interface BaseTransactionsListProps<T extends Transaction> {
  onRowClick?: (transaction: T) => void;
}

interface ManagedTransactionsListProps<T extends Transaction> extends BaseTransactionsListProps<T> {
  transactions: T[];
  filters?: never;
}

interface FilteredTransactionsListProps extends BaseTransactionsListProps<Transaction> {
  filters: Partial<TransactionFilters>;
  transactions?: never;
  refreshTrigger?: number;
}

type TransactionsListProps<T extends Transaction> = ManagedTransactionsListProps<T> | FilteredTransactionsListProps;

function TransactionsList<T extends Transaction>(props: TransactionsListProps<T>) {
  const [fetchedTransactions, setFetchedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  // Extract filter values for stable dependencies
  const hasFilters = 'filters' in props;
  const propsFilters = hasFilters ? props.filters : null;
  
  // Use ref to store stable filters and track changes
  const filtersRef = useRef<Partial<TransactionFilters> | null>(null);
  const filtersStringRef = useRef<string>('');
  const refreshTriggerRef = useRef<number | undefined>(undefined);
  
  // Load more transactions function
  const loadMoreTransactions = useCallback(async () => {
    if (!hasFilters || !propsFilters || loadingMore || !hasMore) {
      console.log('Load more blocked:', { hasFilters, hasProps: !!propsFilters, loadingMore, hasMore });
      return;
    }
    
    console.log('Loading more transactions...', { currentPage, hasMore });
    
    try {
      setLoadingMore(true);
      setError(null);
      
      const nextPage = currentPage + 1;
      const response = await transactionsApi.getTransactions({
        ...propsFilters,
        limit: PAGE_SIZE,
        skip: nextPage * PAGE_SIZE
      });
      
      if (response) {
        console.log('Loaded more transactions:', response.transactions.length, 'hasMore:', response.hasMore);
        setFetchedTransactions(prev => [...prev, ...response.transactions]);
        setHasMore(response.hasMore);
        setCurrentPage(nextPage);
      }
    } catch (err) {
      setError('Failed to load more transactions');
      console.error('Error fetching more transactions:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasFilters, propsFilters, loadingMore, hasMore, currentPage]);

  // State to track scroll container for infinite scroll
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  
  // Callback ref to set scroll container when element is mounted
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setScrollContainer(node);
    }
  }, []);

  // Infinite scroll hook
  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: loadMoreTransactions,
    root: scrollContainer,
    rootMargin: '50px' // Trigger earlier for better UX
  });
  
  useEffect(() => {
    // Only process if we have filters
    if (!hasFilters || !propsFilters) {
      filtersRef.current = null;
      return;
    }
    
    // Create a stable string representation for comparison
    const currentFiltersString = JSON.stringify({
      startDate: propsFilters.startDate?.toISOString(),
      endDate: propsFilters.endDate?.toISOString(),
      type: propsFilters.type,
      category: propsFilters.category,
      subCategory: propsFilters.subCategory,
      search: propsFilters.search,
      accountId: propsFilters.accountId,
      useProcessedDate: propsFilters.useProcessedDate
    });
    
    // If the filters haven't actually changed, don't update
    if (filtersStringRef.current === currentFiltersString) {
      return;
    }
    
    // Update refs with new values
    filtersStringRef.current = currentFiltersString;
    filtersRef.current = propsFilters;
    
    // Reset state for new filters
    setCurrentPage(0);
    setFetchedTransactions([]);
    setHasMore(true);
    
    // Load transactions with new filters
    const loadTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await transactionsApi.getTransactions({
          ...propsFilters,
          limit: PAGE_SIZE,
          skip: 0
        });
        
        if (response) {
          setFetchedTransactions(response.transactions);
          setHasMore(response.hasMore);
        }
      } catch (err) {
        setError('Failed to load transactions');
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [hasFilters, propsFilters]);

  // Extract refreshTrigger to satisfy exhaustive-deps
  const refreshTrigger = hasFilters && 'refreshTrigger' in props 
    ? (props as FilteredTransactionsListProps).refreshTrigger 
    : undefined;
  
  // Handle refresh trigger - refresh all currently loaded pages
  useEffect(() => {
    if (!hasFilters || !refreshTrigger) {
      return;
    }

    const currentRefreshTrigger = refreshTrigger;
    
    // If refreshTrigger hasn't changed, don't refresh
    if (refreshTriggerRef.current === currentRefreshTrigger) {
      return;
    }
    
    // Update the ref
    refreshTriggerRef.current = currentRefreshTrigger;
    
    // Skip initial load (when ref is undefined)
    if (currentRefreshTrigger === undefined) {
      return;
    }

    // Refresh all currently displayed pages while preserving pagination
    const refreshCurrentPages = async () => {
      if (!propsFilters) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Calculate how many items to load to maintain current pagination
        const itemsToLoad = (currentPage + 1) * PAGE_SIZE;
        
        const response = await transactionsApi.getTransactions({
          ...propsFilters,
          limit: itemsToLoad,
          skip: 0
        });
        
        if (response) {
          setFetchedTransactions(response.transactions);
          setHasMore(response.hasMore);
          // Don't reset currentPage - keep user's current position
        }
      } catch (err) {
        setError('Failed to refresh transactions');
        console.error('Error refreshing transactions:', err);
      } finally {
        setLoading(false);
      }
    };

    refreshCurrentPages();
  }, [hasFilters, refreshTrigger, propsFilters, currentPage]);

  const transactions = ('transactions' in props) ? props.transactions as T[] : (fetchedTransactions as T[]);

  const groupTransactionsByDate = (transactionsList: T[]) => {
    const groups: { [key: string]: T[] } = {};
    
    transactionsList.forEach(transaction => {
      const date = new Date(transaction.date);
      const key = format(date, 'yyyy-MM-dd');
      
      if (!groups[key]) {
        groups[key] = [];
      }
      
      groups[key].push(transaction);
    });
    
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'MMMM d, yyyy');
  };

  const calculateDailyTotal = (transactions: T[]) => {
    return transactions.reduce((total, tx) => total + tx.amount, 0);
  };
  
  if (loading && !fetchedTransactions.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress data-testid="loading-indicator" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load transactions. Please try again.
      </Alert>
    );
  }

  if (transactions.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }} data-testid="no-transactions-message">
        No transactions found.
      </Alert>
    );
  }

  return (
    <Box
      ref={scrollContainerRef}
      component="ul"
      sx={{
        mt: 2,
        listStyle: 'none',
        padding: 0,
        maxHeight: '600px',
        overflow: 'auto'
      }}
      data-testid="transactions-list"
    >
      {groupTransactionsByDate(transactions).map(([date, dateTransactions], groupIndex) => (
        <Box key={date} sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
              position: 'relative',
              gap: 3
            }}
          >
            <Typography 
              variant="subtitle2"
              component="div"
              color="text.secondary"
              sx={{ 
                fontSize: '0.8rem',
                fontWeight: 500,
                width: 'auto',
                m: 0,
                lineHeight: 1
              }}
            >
              {formatDateHeader(date)}
            </Typography>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  borderBottom: '2px dotted',
                  borderColor: 'grey.400',
                  width: '100%',
                  mt: 0.5
                }}
              />
            </Box>
            <Typography
              variant="subtitle2"
              component="div"
              sx={{ 
                fontSize: '0.8rem',
                fontWeight: 500,
                width: 'auto',
                textAlign: 'right',
                m: 0,
                lineHeight: 1,
                fontFamily: 'monospace'
              }}
            >
              {formatCurrencyDisplay(calculateDailyTotal(dateTransactions), 'ILS')}
            </Typography>
          </Box>
          
          {dateTransactions.map((transaction) => {
            return (
              <li
                key={transaction._id}
                data-testid={`transaction-item-${transaction._id}`}
              >
                <TransactionRow 
                  transaction={transaction}
                  onClick={props.onRowClick && (() => props.onRowClick?.(transaction))}
                  data-testid={`transaction-${transaction._id}-content`}
                />
              </li>
            );
          })}
        </Box>
      ))}
      
      {/* Infinite scroll sentinel - only show when there are more items to load */}
      {hasFilters && hasMore && (
        <Box ref={sentinelRef} sx={{ height: '20px', width: '100%' }} />
      )}
      
      {/* Loading more indicator */}
      {loadingMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress data-testid="loading-more-indicator" size={24} />
        </Box>
      )}
      
      {/* No more data indicator */}
      {!hasMore && transactions.length > 0 && hasFilters && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No more transactions to load
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TransactionsList;
