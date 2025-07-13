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
  Grid,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Category as CategoryIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { Transaction } from '../../services/api/types/transactions';
import { formatCurrency } from '../../utils/formatters';
import CategorySelectionDialog from './CategorySelectionDialog';
import { transactionsApi } from '../../services/api/transactions';

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

  const handleCategoryUpdate = async (categoryId: string, subCategoryId: string) => {
    if (!transaction) return;
    
    try {
      setUpdating(true);
      setError(null);
      
      await transactionsApi.categorizeTransaction(transaction._id, {
        categoryId,
        subCategoryId,
      });
      
      const updatedTransaction: Transaction = {
        ...transaction,
        category: { _id: categoryId, name: 'Updated Category', type: transaction.type || 'Expense' },
        subCategory: { _id: subCategoryId, name: 'Updated SubCategory' },
        categorizationMethod: 'manual',
        categorizationReasoning: `Manual categorization: User manually selected category for transaction with description: "${transaction.description}"`,
      };
      
      onTransactionUpdated?.(updatedTransaction);
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
        maxWidth="md"
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

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <MoneyIcon color="primary" />
                  <Typography variant="h5" component="div">
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </Typography>
                  {transaction.type && (
                    <Chip 
                      label={transaction.type} 
                      color={getTransactionTypeColor(transaction.type)}
                      size="small"
                    />
                  )}
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <DescriptionIcon sx={{ color: 'grey.600', fontSize: 20 }} />
                  <Typography variant="body1" fontWeight="medium">
                    {transaction.description}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarIcon sx={{ color: 'grey.600', fontSize: 20 }} />
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(transaction.date)}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CategoryIcon color="primary" />
                    <Typography variant="h6">
                      Category
                    </Typography>
                  </Box>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={handleCategoryEdit}
                    disabled={updating}
                    size="small"
                  >
                    {updating ? <CircularProgress size={16} /> : 'Edit'}
                  </Button>
                </Box>

                {transaction.category && transaction.subCategory ? (
                  <Box>
                    <Typography variant="body1" fontWeight="medium" gutterBottom>
                      {transaction.category.name} → {transaction.subCategory.name}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Uncategorized
                    </Typography>
                    <Chip label="Needs Categorization" color="warning" size="small" />
                  </Box>
                )}

                {transaction.categorizationReasoning && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium" display="block" gutterBottom>
                      Categorization Reasoning
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {transaction.categorizationReasoning}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <CategorySelectionDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        onCategorySelect={handleCategoryUpdate}
        transaction={transaction}
      />
    </>
  );
};

export default TransactionDetailDialog;
