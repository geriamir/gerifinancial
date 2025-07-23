/**
 * NAVIGATION SIMPLIFICATION - Updated TransactionsPage
 * 
 * Status: ✅ UPDATED
 * Phase: 1.4
 * Last Updated: July 23, 2025
 * 
 * Changes:
 * - Replaced single transactions view with tabbed interface
 * - Integrated bank management as third tab
 * - Maintains all existing functionality
 * - Added URL-based tab state persistence
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { RestartAlt as ResetIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import TransactionTabs from '../components/transactions/TransactionTabs';
import TransactionsList from '../components/transactions/TransactionsList';
import FilterPanel from '../components/transactions/FilterPanel';
import TransactionDetailDialog from '../components/transactions/TransactionDetailDialog';
import { TransactionFilters } from '../services/api/types';
import type { Transaction } from '../services/api/types/transactions';

const defaultFilters: Partial<TransactionFilters> = {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  endDate: new Date(),
};

const TransactionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Partial<TransactionFilters>>(() => {
    // Check URL params on initial load
    const categoryParam = searchParams.get('category');
    if (categoryParam === 'uncategorized') {
      return {
        category: 'uncategorized',
        startDate: undefined,
        endDate: undefined,
      };
    }
    return defaultFilters;
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Check if we're showing uncategorized transactions (legacy URL support)
  const isShowingUncategorized = filters.category === 'uncategorized';

  // Sync filters with URL parameters for backward compatibility
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    
    if (categoryParam === 'uncategorized') {
      setFilters({
        category: 'uncategorized',
        startDate: undefined,
        endDate: undefined,
      });
    } else if (!categoryParam && filters.category === 'uncategorized') {
      // If URL param is removed but filter is still uncategorized, reset to default
      setFilters(defaultFilters);
    }
  }, [searchParams, filters.category]);

  const updateFilters = (newFilters: Partial<TransactionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailDialogOpen(true);
  };

  const handleDetailDialogClose = () => {
    setDetailDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleTransactionUpdated = (updatedTransaction: Transaction) => {
    // Update the selected transaction
    setSelectedTransaction(updatedTransaction);
    // Trigger a refresh of the transaction list
    setRefreshTrigger(prev => prev + 1);
  };

  // If showing uncategorized transactions, render legacy view for backward compatibility
  if (isShowingUncategorized) {
    return (
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Uncategorized Transactions
          </Typography>
          <Button
            startIcon={<ResetIcon />}
            onClick={resetFilters}
            size="small"
          >
            Reset Filters
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Showing all transactions that need categorization. Click on any transaction to categorize it.
        </Alert>

        <FilterPanel
          startDate={filters.startDate}
          endDate={filters.endDate}
          type={filters.type}
          search={filters.search}
          onFilterChange={updateFilters}
        />

        <TransactionsList 
          filters={filters} 
          onRowClick={handleTransactionClick}
          refreshTrigger={refreshTrigger}
        />

        {/* Transaction Detail Dialog */}
        <TransactionDetailDialog
          open={detailDialogOpen}
          transaction={selectedTransaction}
          onClose={handleDetailDialogClose}
          onTransactionUpdated={handleTransactionUpdated}
        />
      </Box>
    );
  }

  // Default view - new tabbed interface
  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Transactions
      </Typography>
      
      <TransactionTabs />
    </Box>
  );
};

export default TransactionsPage;
