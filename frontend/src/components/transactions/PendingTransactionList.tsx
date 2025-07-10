import React, { useState } from 'react';
import { Box, Button, Paper } from '@mui/material';
import type { PendingTransaction, CategorySuggestion } from '../../services/api/types/transactions';
import type { Category, SubCategory } from '../../services/api/types';
import { CategorySelectionDialog } from './CategorySelectionDialog';
import { transactionsApi } from '../../services/api/transactions';
import TransactionsList from './TransactionsList';

interface PendingTransactionListProps {
  transactions: PendingTransaction[];
  onVerify: (transactionId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  onCategoryUpdate?: () => void;
}

interface CategoryUpdateState {
  transactionId: string;
  suggestion?: CategorySuggestion;
  description: string;
}

export const PendingTransactionList: React.FC<PendingTransactionListProps> = ({
  transactions,
  onVerify,
  onLoadMore,
  hasMore,
  loading = false,
  onCategoryUpdate
}) => {
  const [categoryUpdateState, setCategoryUpdateState] = useState<CategoryUpdateState | null>(null);

  const handleCategoryClick = async (transaction: PendingTransaction) => {
    try {
      const { suggestion } = await transactionsApi.getSuggestion(transaction._id);
      setCategoryUpdateState({
        transactionId: transaction._id,
        suggestion,
        description: transaction.description
      });
    } catch (error) {
      // If suggestion fails, open dialog without suggestion
      setCategoryUpdateState({
        transactionId: transaction._id,
        description: transaction.description
      });
      console.error('Failed to get category suggestion:', error);
    }
  };

  const handleCategorySelect = async (category: Category, subCategory?: SubCategory) => {
    if (!categoryUpdateState) return;

    try {
      await transactionsApi.categorizeTransaction(categoryUpdateState.transactionId, {
        categoryId: category._id,
        subCategoryId: subCategory?._id || ''
      });
      setCategoryUpdateState(null);
      onCategoryUpdate?.();
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  return (
    <Paper>
      <TransactionsList<PendingTransaction>
        transactions={transactions}
        onRowClick={handleCategoryClick}
      />
      {hasMore && onLoadMore && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Button
            onClick={onLoadMore}
            disabled={loading}
            variant="outlined"
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </Box>
      )}
      
      {categoryUpdateState && (
        <CategorySelectionDialog
          open={true}
          onClose={() => setCategoryUpdateState(null)}
          onSelect={handleCategorySelect}
          currentCategory={transactions.find(t => t._id === categoryUpdateState.transactionId)?.category}
          currentSubCategory={transactions.find(t => t._id === categoryUpdateState.transactionId)?.subCategory}
          suggestedCategory={categoryUpdateState.suggestion?.categoryId ? transactions.find(t => 
            t._id === categoryUpdateState.transactionId
          )?.category : undefined}
          aiConfidence={categoryUpdateState.suggestion?.confidence}
          description={categoryUpdateState.description}
        />
      )}
    </Paper>
  );
};

export default PendingTransactionList;
