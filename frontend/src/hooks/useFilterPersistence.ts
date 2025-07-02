import { useState, useEffect } from 'react';
import { TransactionFilters } from '../services/api/types';

const FILTER_STORAGE_KEY = 'transaction-filters';

const getStoredFilters = (): Partial<TransactionFilters> => {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    };
  } catch (error) {
    console.error('Error reading stored filters:', error);
    return {};
  }
};

const storeFilters = (filters: Partial<TransactionFilters>) => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.error('Error storing filters:', error);
  }
};

export const useFilterPersistence = (
  initialFilters: Partial<TransactionFilters>
) => {
  const [filters, setFilters] = useState<Partial<TransactionFilters>>(() => ({
    ...initialFilters,
    ...getStoredFilters(),
  }));

  useEffect(() => {
    storeFilters(filters);
  }, [filters]);

  const updateFilters = (newFilters: Partial<TransactionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    localStorage.removeItem(FILTER_STORAGE_KEY);
  };

  return {
    filters,
    updateFilters,
    resetFilters,
  };
};
