import React, { useState, useEffect, useRef } from 'react';
import { Box, Alert, Typography, CircularProgress } from '@mui/material';
import { format } from 'date-fns';
import { formatCurrencyDisplay } from '../../utils/formatters';
import { transactionsApi } from '../../services/api/transactions';
import type { Transaction, TransactionFilters } from '../../services/api/types/transactions';
import TransactionRow from './TransactionRow';

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
}

type TransactionsListProps<T extends Transaction> = ManagedTransactionsListProps<T> | FilteredTransactionsListProps;

function TransactionsList<T extends Transaction>(props: TransactionsListProps<T>) {
  const [fetchedTransactions, setFetchedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setHasMore] = useState(true);

  // Extract filter values for stable dependencies
  const hasFilters = 'filters' in props;
  const propsFilters = hasFilters ? props.filters : null;
  
  // Use ref to store stable filters and track changes
  const filtersRef = useRef<Partial<TransactionFilters> | null>(null);
  const filtersStringRef = useRef<string>('');
  
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
      search: propsFilters.search,
      accountId: propsFilters.accountId
    });
    
    // If the filters haven't actually changed, don't update
    if (filtersStringRef.current === currentFiltersString) {
      return;
    }
    
    // Update refs with new values
    filtersStringRef.current = currentFiltersString;
    filtersRef.current = propsFilters;
    
    // Load transactions with new filters
    const loadTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        setFetchedTransactions([]);
        
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
            // Only add ref to the last transaction of the last group
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
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress data-testid="loading-indicator" size={24} />
        </Box>
      )}
    </Box>
  );
};

export default TransactionsList;
