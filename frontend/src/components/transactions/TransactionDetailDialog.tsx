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
  Category as CategoryIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { Transaction } from '../../services/api/types/transactions';
import { formatCurrency } from '../../utils/formatters';
import { CategorySelectionDialog } from './CategorySelectionDialog';
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

  const handleCategorySelect = (category: any, subCategory?: any) => {
    if (!transaction || !category) return;
    
    const categoryId = category._id;
    const subCategoryId = subCategory?._id;
    
    if (!categoryId || !subCategoryId) return;
    
    handleCategoryUpdate(categoryId, subCategoryId);
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
      
      // Just update the current transaction state optimistically
      onTransactionUpdated?.({
        ...transaction,
        categorizationMethod: 'manual',
        categorizationReasoning: `Manual categorization: User manually selected category for transaction with description: "${transaction.description}"`,
      });
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
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
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
              
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
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
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1 }}>
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

              {/* Category Information */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 1, 
                  mt: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                    borderRadius: 1
                  },
                  p: 1,
                  ml: -1,
                  mr: -1
                }}
                onClick={handleCategoryEdit}
              >
                <CategoryIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
                <Box sx={{ flex: 1 }}>
                  {transaction.category && transaction.subCategory ? (
                    <>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {transaction.category.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {transaction.subCategory.name}
                      </Typography>
                    </>
                  ) : (
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
            </Paper>
          </Box>
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
        onSelect={handleCategorySelect}
        description={transaction.description}
      />
    </>
  );
};

export default TransactionDetailDialog;
