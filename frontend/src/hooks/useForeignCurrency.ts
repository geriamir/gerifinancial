import { useState, useEffect, useCallback, useMemo } from 'react';
import { foreignCurrencyApi } from '../services/api/foreignCurrency';
import {
  ForeignCurrencyAccount,
  ForeignCurrencyAccountSummary,
  CurrencySummary,
  Transaction,
  ForeignCurrencyAccountFilters,
  ForeignCurrencyTransactionFilters,
  formatCurrency,
  getCurrencySymbol
} from '../types/foreignCurrency';

// Hook for managing foreign currency accounts
export function useForeignCurrencyAccounts(filters?: ForeignCurrencyAccountFilters) {
  const [accounts, setAccounts] = useState<ForeignCurrencyAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract individual filter values to avoid object reference issues
  const bankAccountId = filters?.bankAccountId;
  const currency = filters?.currency;

  // Memoize filters to stabilize object reference and prevent infinite loops
  const memoizedFilters = useMemo(() => {
    if (!bankAccountId && !currency) return undefined;
    return {
      bankAccountId,
      currency
    };
  }, [bankAccountId, currency]);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedAccounts = await foreignCurrencyApi.getAccounts(memoizedFilters);
      setAccounts(fetchedAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch foreign currency accounts');
      console.error('Error fetching foreign currency accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [memoizedFilters]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const refetch = useCallback(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    refetch
  };
}

// Hook for a specific foreign currency account
export function useForeignCurrencyAccount(accountId: string | null) {
  const [account, setAccount] = useState<ForeignCurrencyAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!accountId) {
      setAccount(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const fetchedAccount = await foreignCurrencyApi.getAccount(accountId);
      setAccount(fetchedAccount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch account details');
      console.error('Error fetching foreign currency account:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const refetch = useCallback(() => {
    fetchAccount();
  }, [fetchAccount]);

  return {
    account,
    loading,
    error,
    refetch
  };
}

// Hook for foreign currency transactions with pagination
export function useForeignCurrencyTransactions(
  accountId: string | null,
  filters?: ForeignCurrencyTransactionFilters
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 25,
    offset: 0,
    hasMore: false
  });
  const [account, setAccount] = useState<{
    id: string;
    currency: string;
    displayName: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const fetchTransactions = useCallback(async (reset: boolean = false) => {
    if (!accountId) {
      setTransactions([]);
      setPagination({ total: 0, limit: 25, offset: 0, hasMore: false });
      setAccount(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : pagination.offset;
      const result = await foreignCurrencyApi.getAccountTransactions(accountId, {
        ...filters,
        offset: currentOffset
      });

      if (reset || currentOffset === 0) {
        setTransactions(result.transactions);
      } else {
        setTransactions(prev => [...prev, ...result.transactions]);
      }

      setPagination(result.pagination);
      setAccount(result.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      console.error('Error fetching foreign currency transactions:', err);
    } finally {
      setLoading(false);
      if (initialLoad) {
        setInitialLoad(false);
      }
    }
  }, [accountId, filters, pagination.offset, initialLoad]);

  // Initial load
  useEffect(() => {
    if (initialLoad) {
      fetchTransactions(true);
    }
  }, [accountId, filters, fetchTransactions, initialLoad]);

  // Load more transactions
  const loadMore = useCallback(() => {
    if (!loading && pagination.hasMore) {
      setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
      fetchTransactions(false);
    }
  }, [loading, pagination.hasMore, fetchTransactions]);

  // Refresh (reset to first page)
  const refresh = useCallback(() => {
    setInitialLoad(true);
    setPagination(prev => ({ ...prev, offset: 0 }));
    fetchTransactions(true);
  }, [fetchTransactions]);

  return {
    transactions,
    pagination,
    account,
    loading,
    error,
    loadMore,
    refresh,
    hasMore: pagination.hasMore
  };
}

// Hook for currency summary
export function useCurrencySummary() {
  const [summary, setSummary] = useState<CurrencySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedSummary = await foreignCurrencyApi.getCurrencySummary();
      setSummary(fetchedSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch currency summary');
      console.error('Error fetching currency summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const refetch = useCallback(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refetch
  };
}

// Hook for account statistics
export function useForeignCurrencyAccountStats(accountId: string | null) {
  const [stats, setStats] = useState<{
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    averageTransactionAmount: number;
    currency: string;
    dateRange: {
      earliest: Date | null;
      latest: Date | null;
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!accountId) {
      setStats(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const fetchedStats = await foreignCurrencyApi.getAccountStatistics(accountId);
      setStats(fetchedStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch account statistics');
      console.error('Error fetching account statistics:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refetch = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch
  };
}

// Hook for currency conversion
export function useCurrencyConverter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertCurrency = useCallback(async (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    date?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const result = await foreignCurrencyApi.convertCurrency({
        amount,
        fromCurrency,
        toCurrency,
        date
      });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert currency');
      console.error('Error converting currency:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    convertCurrency,
    loading,
    error
  };
}

// Helper hooks for formatting and utilities

// Hook for formatting foreign currency data
export function useForeignCurrencyFormatters() {
  const formatTransactionAmount = useCallback((transaction: Transaction) => {
    const amount = transaction.amount;
    const absAmount = Math.abs(amount);
    const isIncome = amount > 0;
    const formattedAmount = formatCurrency(absAmount, transaction.currency);
    const color = isIncome ? '#4caf50' : '#f44336';

    return {
      formattedAmount: `${isIncome ? '+' : '-'}${formattedAmount}`,
      color,
      isIncome
    };
  }, []);

  const formatAccountBalance = useCallback((account: ForeignCurrencyAccountSummary) => {
    const primaryBalance = formatCurrency(account.balance, account.currency);
    let convertedBalance: string | null = null;
    let exchangeRate: string | null = null;

    if (account.currency !== 'ILS' && account.balanceILS && account.lastExchangeRate) {
      convertedBalance = formatCurrency(account.balanceILS, 'ILS');
      exchangeRate = `1 ${account.currency} = ${account.lastExchangeRate.toFixed(4)} ILS`;
    }

    return {
      primaryBalance,
      convertedBalance,
      exchangeRate
    };
  }, []);

  const formatAccountDisplayName = useCallback((account: ForeignCurrencyAccountSummary) => {
    const symbol = getCurrencySymbol(account.currency);
    return `${symbol} ${account.currency} Account (${account.transactionCount} transactions)`;
  }, []);

  const getAccountStatusColor = useCallback((status: 'active' | 'inactive' | 'closed') => {
    switch (status) {
      case 'active':
        return '#4caf50'; // Green
      case 'inactive':
        return '#ff9800'; // Orange
      case 'closed':
        return '#f44336'; // Red
      default:
        return '#9e9e9e'; // Grey
    }
  }, []);

  return {
    formatTransactionAmount,
    formatAccountBalance,
    formatAccountDisplayName,
    getAccountStatusColor
  };
}

// Hook for grouping and filtering transactions
export function useForeignCurrencyTransactionUtils() {
  const groupByCurrency = useCallback((transactions: Transaction[]) => {
    return transactions.reduce((groups, transaction) => {
      const currency = transaction.currency;
      if (!groups[currency]) {
        groups[currency] = [];
      }
      groups[currency].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);
  }, []);

  const groupByDate = useCallback((transactions: Transaction[]) => {
    return transactions.reduce((groups, transaction) => {
      const date = new Date(transaction.date).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    }, {} as Record<string, Transaction[]>);
  }, []);

  const filterByDateRange = useCallback((
    transactions: Transaction[],
    startDate?: string,
    endDate?: string
  ) => {
    if (!startDate && !endDate) return transactions;

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      if (startDate && transactionDate < new Date(startDate)) return false;
      if (endDate && transactionDate > new Date(endDate)) return false;
      return true;
    });
  }, []);

  const filterByAmount = useCallback((
    transactions: Transaction[],
    minAmount?: number,
    maxAmount?: number
  ) => {
    if (minAmount === undefined && maxAmount === undefined) return transactions;

    return transactions.filter(transaction => {
      const absAmount = Math.abs(transaction.amount);
      if (minAmount !== undefined && absAmount < minAmount) return false;
      if (maxAmount !== undefined && absAmount > maxAmount) return false;
      return true;
    });
  }, []);

  return {
    groupByCurrency,
    groupByDate,
    filterByDateRange,
    filterByAmount
  };
}

const useForeignCurrencyHooks = {
  useForeignCurrencyAccounts,
  useForeignCurrencyAccount,
  useForeignCurrencyTransactions,
  useCurrencySummary,
  useForeignCurrencyAccountStats,
  useCurrencyConverter,
  useForeignCurrencyFormatters,
  useForeignCurrencyTransactionUtils
};

export default useForeignCurrencyHooks;
