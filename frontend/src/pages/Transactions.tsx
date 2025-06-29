import React from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import { RestartAlt as ResetIcon } from '@mui/icons-material';
import TransactionsList from '../components/transactions/TransactionsList';
import FilterPanel from '../components/transactions/FilterPanel';
import { TransactionFilters } from '../services/api/types';
import { useFilterPersistence } from '../hooks/useFilterPersistence';

const defaultFilters: Partial<TransactionFilters> = {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  endDate: new Date(),
};

const TransactionsPage: React.FC = () => {

  const { filters, updateFilters, resetFilters } = useFilterPersistence(defaultFilters);

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Transactions
          </Typography>
          <Button
            startIcon={<ResetIcon />}
            onClick={resetFilters}
            size="small"
          >
            Reset Filters
          </Button>
        </Box>
        <FilterPanel
          startDate={filters.startDate}
          endDate={filters.endDate}
          type={filters.type}
          search={filters.search}
          onFilterChange={updateFilters}
        />
        {/* TransactionsSummary will go here */}
        <TransactionsList filters={filters} />
      </Box>
    </Container>
  );
};

export default TransactionsPage;
