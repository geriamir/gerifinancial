import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  AccountBalance as MoneyIcon,
  CalendarToday as CalendarIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { Transaction } from '../../services/api/types/transactions';
import { formatCurrencyDisplay } from '../../utils/formatters';
import { EnhancedCategorizationDialog } from './EnhancedCategorizationDialog';
import { transactionsApi } from '../../services/api/transactions';
import { useCategories } from '../../hooks/useCategories';
import CategoryIcon from '../common/CategoryIcon';
import TransactionBudgetExclusion from './TransactionBudgetExclusion';

interface TransactionDetailDialogProps {
  open: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onTransactionUpdated?: (updatedTransaction: Transaction) => void;
}

const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = ({
  open,
  transaction,
  onClose,
  onTransactionUpdated,
}) => {
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { categories } = useCategories();

  useEffect(() => {
    if (!open) {
      setError(null);
      setUpdating(false);
    }
  }, [open]);

  if (!transaction) {
    return null;
  }

  const handleCategoryEdit = () => {
    setCategoryDialogOpen(true);
  };


  const handleCategoryUpdate = async (categoryId: string, subCategoryId: string, saveAsManual?: boolean, matchingFields?: any) => {
    if (!transaction) return;
    
    try {
      setUpdating(true);
      setError(null);
      
      const response = await transactionsApi.categorizeTransaction(transaction._id, {
        categoryId,
        subCategoryId,
        saveAsManual,
        matchingFields,
      });
      
      // The response now always has the new format: { transaction: Transaction, historicalUpdates?: ... }
      const updatedTransaction = response.transaction;
      const historicalUpdates = response.historicalUpdates;
      
      // Update with the actual response from the server which includes populated category/subcategory
      onTransactionUpdated?.(updatedTransaction);
      
      // Show notification if historical transactions were updated
      if (historicalUpdates && historicalUpdates.updatedCount > 0) {
        setError(null); // Clear any existing errors first
        // Use a success message instead of error for this notification
        setTimeout(() => {
          alert(`✅ Successfully categorized this transaction and ${historicalUpdates.updatedCount} similar historical transactions!`);
        }, 500);
      }
      
      setCategoryDialogOpen(false);
      
    } catch (err) {
      console.error('Failed to update transaction category:', err);
      setError('Failed to update category. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const getTransactionTypeColor = (type?: string) => {
    switch (type) {
      case 'Expense':
        return 'error';
      case 'Income':
        return 'success';
      case 'Transfer':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy \'at\' h:mm a');
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" component="div">
            Transaction Details
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{ color: 'grey.500' }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Main Transaction Info */}
            <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <MoneyIcon color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Amount
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h5" component="div" sx={{ fontFamily: 'monospace' }}>
                      {formatCurrencyDisplay(transaction.amount, transaction.currency)}
                    </Typography>
                    {transaction.type && (
                      <Chip 
                        label={transaction.type} 
                        color={getTransactionTypeColor(transaction.type)}
                        size="small"
                      />
                    )}
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1 }}>
                <DescriptionIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Description
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {transaction.description}
                  </Typography>
                </Box>
              </Box>

              {/* Category Information */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 2, 
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1
                  },
                }}
                onClick={handleCategoryEdit}
              >
                <CategoryIcon 
                  categoryName={transaction.category?.name}
                  subcategoryName={transaction.subCategory?.name}
                  size="small"
                  variant="plain"
                  showTooltip={false}
                />
                <Box sx={{ flex: 1 }}>
                  {transaction.category ? (
                    <>
                      {/* For Expense transactions: show category → subcategory */}
                      {transaction.category.type === 'Expense' && transaction.subCategory ? (
                        <>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {transaction.category.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {transaction.subCategory.name}
                          </Typography>
                        </>
                      ) : transaction.category.type !== 'Expense' ? (
                        /* For Income/Transfer transactions: show transaction type → category name */
                        <>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {transaction.category.type}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {transaction.category.name}
                          </Typography>
                        </>
                      ) : (
                        /* Expense transaction without subcategory - show incomplete */
                        <>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Category
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {transaction.category.name} (incomplete)
                            </Typography>
                            <Chip label="Add subcategory" color="warning" size="small" />
                          </Box>
                        </>
                      )}
                    </>
                  ) : (
                    /* No category at all */
                    <>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Category
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Uncategorized
                        </Typography>
                        <Chip label="Click to categorize" color="warning" size="small" />
                      </Box>
                    </>
                  )}
                  {updating && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <CircularProgress size={12} />
                      <Typography variant="caption" color="text.secondary">
                        Updating...
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <CalendarIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Date
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(transaction.date)}
                  </Typography>
                </Box>
              </Box>
              
              {(transaction.memo || transaction.rawData?.memo) && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mt: 1 }}>
                  <DescriptionIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Additional Details
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {transaction.memo || transaction.rawData?.memo}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>

            {/* Budget Exclusion Section - Only show for categorized expense transactions */}
            {transaction.category && (transaction.category.type === 'Expense' || transaction.category.type === 'Income') && (
              <Paper sx={{ p: 3, bgcolor: 'blue.50', border: '1px solid', borderColor: 'blue.200' }}>
                <TransactionBudgetExclusion
                  transaction={transaction}
                  onTransactionUpdated={onTransactionUpdated}
                />
              </Paper>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <EnhancedCategorizationDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        transaction={transaction}
        categories={categories}
        onCategorize={handleCategoryUpdate}
        isLoading={updating}
      />
    </>
  );
};

export default TransactionDetailDialog;
