import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { transactionsApi } from '../../services/api/transactions';
import { Transaction, TransactionFilters } from '../../services/api/types';
import TransactionRow from './TransactionRow';

interface TransactionsListProps {
  filters: Partial<TransactionFilters>;
}

const ITEMS_PER_PAGE = 20;

const TransactionsList: React.FC<TransactionsListProps> = ({ filters }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const lastTransactionElementRef = useCallback((node: HTMLLIElement | null) => {
    if (loading) return;
    
    if (observer.current) {
      observer.current.disconnect();
    }
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setSkip(prev => prev + ITEMS_PER_PAGE);
      }
    });
    
    if (node) {
      observer.current.observe(node);
    }
  }, [loading, hasMore]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await transactionsApi.getTransactions({
        ...filters,
        limit: ITEMS_PER_PAGE,
        skip,
      });

      setTransactions(prevTransactions => {
        if (skip === 0) {
          return response.transactions;
        }
        return [...prevTransactions, ...response.transactions];
      });
      
      setHasMore(response.hasMore);
    } catch (err) {
      setError('Failed to load transactions. Please try again.');
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, skip]);

  useEffect(() => {
    setSkip(0);
    setTransactions([]);
    fetchTransactions();
  }, [filters, fetchTransactions]);

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (transactions.length === 0 && !loading) {
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
      {transactions.map((transaction, index) => {
        if (index === transactions.length - 1) {
          return (
            <li
              ref={lastTransactionElementRef}
              key={transaction._id}
              data-testid={`transaction-item-${transaction._id}`}
            >
              <TransactionRow 
                transaction={transaction} 
                data-testid={`transaction-${transaction._id}-content`}
              />
            </li>
          );
        }
        return (
          <li
            key={transaction._id}
            data-testid={`transaction-item-${transaction._id}`}
          >
            <TransactionRow 
              transaction={transaction}
              data-testid={`transaction-${transaction._id}-content`}
            />
          </li>
        );
      })}
      
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
          <CircularProgress data-testid="loading-indicator" />
        </Box>
      )}
    </Box>
  );
};

export default TransactionsList;
