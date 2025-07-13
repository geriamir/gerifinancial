import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, Button, Alert } from '@mui/material';
import { RestartAlt as ResetIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import TransactionsList from '../components/transactions/TransactionsList';
import FilterPanel from '../components/transactions/FilterPanel';
import { TransactionDetailDialog } from '../components/transactions';
import { TransactionFilters } from '../services/api/types';
import type { Transaction } from '../services/api/types/transactions';
import { useFilterPersistence } from '../hooks/useFilterPersistence';

const defaultFilters: Partial<TransactionFilters> = {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  endDate: new Date(),
};

const TransactionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, updateFilters, resetFilters } = useFilterPersistence(defaultFilters);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Handle URL parameters on component mount
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    
    if (categoryParam === 'uncategorized') {
      // Set filters to show only uncategorized transactions
      updateFilters({
        category: 'uncategorized', // Special value to indicate uncategorized filter
        startDate: undefined, // Remove date filter to show all uncategorized
        endDate: undefined,
      });
      
      // Clear the URL parameter after setting the filter
      setSearchParams({});
    }
  }, [searchParams, updateFilters, setSearchParams]);

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailDialogOpen(true);
  };

  const handleDetailDialogClose = () => {
    setDetailDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleTransactionUpdated = (updatedTransaction: Transaction) => {
    // Optionally refresh the transaction list or update local state
    setSelectedTransaction(updatedTransaction);
  };

  const isShowingUncategorized = filters.category === 'uncategorized';

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            {isShowingUncategorized ? 'Uncategorized Transactions' : 'Transactions'}
          </Typography>
          <Button
            startIcon={<ResetIcon />}
            onClick={resetFilters}
            size="small"
          >
            Reset Filters
          </Button>
        </Box>

        {isShowingUncategorized && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Showing all transactions that need categorization. Click on any transaction to categorize it.
          </Alert>
        )}

        <FilterPanel
          startDate={filters.startDate}
          endDate={filters.endDate}
          type={filters.type}
          search={filters.search}
          onFilterChange={updateFilters}
        />
        {/* TransactionsSummary will go here */}
        <TransactionsList 
          filters={filters} 
          onRowClick={handleTransactionClick}
        />
      </Box>

      {/* Transaction Detail Dialog */}
      <TransactionDetailDialog
        open={detailDialogOpen}
        transaction={selectedTransaction}
        onClose={handleDetailDialogClose}
        onTransactionUpdated={handleTransactionUpdated}
      />
    </Container>
  );
};

export default TransactionsPage;
