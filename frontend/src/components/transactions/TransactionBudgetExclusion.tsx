import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Block as ExcludeIcon,
  CheckCircle as IncludeIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { Transaction } from '../../services/api/types/transactions';
import { budgetsApi } from '../../services/api/budgets';
import { formatCurrencyDisplay } from '../../utils/formatters';
import { useBudget } from '../../contexts/BudgetContext';

interface TransactionBudgetExclusionProps {
  transaction: Transaction;
  onTransactionUpdated?: (updatedTransaction: Transaction) => void;
  compact?: boolean;
}

const TransactionBudgetExclusion: React.FC<TransactionBudgetExclusionProps> = ({
  transaction,
  onTransactionUpdated,
  compact = false,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const { refreshBudgets } = useBudget();

  const isExcluded = transaction.excludeFromBudgetCalculation === true;

  const handleToggleExclusion = async () => {
    if (!isExcluded) {
      // If not excluded, show dialog to get reason
      setDialogOpen(true);
      return;
    }

    // If already excluded, include it back without dialog
    try {
      setLoading(true);
      setError(null);

      const result = await budgetsApi.includeTransactionInBudget(transaction._id);
      
      const updatedTransaction: Transaction = {
        ...transaction,
        excludeFromBudgetCalculation: false,
        exclusionReason: undefined,
        excludedAt: undefined,
      };

      onTransactionUpdated?.(updatedTransaction);
      
      // Show success message if budget was recalculated
      if (result.budgetRecalculation) {
        console.log('Budget automatically recalculated after including transaction');
        // Refresh budgets to show updated amounts
        await refreshBudgets();
      }
      
    } catch (err) {
      console.error('Failed to include transaction in budget:', err);
      setError('Failed to include transaction in budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcludeConfirm = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await budgetsApi.excludeTransactionFromBudget(transaction._id, reason.trim() || 'No reason provided');
      
      const updatedTransaction: Transaction = {
        ...transaction,
        excludeFromBudgetCalculation: true,
        exclusionReason: reason.trim(),
        excludedAt: new Date().toISOString(),
      };

      onTransactionUpdated?.(updatedTransaction);
      
      // Show success message if budget was recalculated
      if (result.budgetRecalculation) {
        console.log('Budget automatically recalculated after excluding transaction');
        // Refresh budgets to show updated amounts
        await refreshBudgets();
      }
      
      setDialogOpen(false);
      setReason('');
      
    } catch (err) {
      console.error('Failed to exclude transaction from budget:', err);
      setError('Failed to exclude transaction from budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setReason('');
    setError(null);
  };

  if (compact) {
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isExcluded ? (
            <Chip
              icon={<ExcludeIcon />}
              label="Excluded from budget"
              color="warning"
              size="small"
              onClick={handleToggleExclusion}
              disabled={loading}
              sx={{ cursor: 'pointer' }}
            />
          ) : (
            <Tooltip title="Exclude from budget calculation">
              <IconButton
                size="small"
                onClick={handleToggleExclusion}
                disabled={loading}
                sx={{ color: 'text.secondary' }}
              >
                {loading ? <CircularProgress size={16} /> : <ExcludeIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle>Exclude from Budget</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              This transaction will be excluded from budget calculations. This is useful for 
              one-time expenses that shouldn't affect your regular budget planning.
            </DialogContentText>
            
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Transaction Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatCurrencyDisplay(transaction.amount, transaction.currency)} • {transaction.description}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {format(new Date(transaction.date), 'MMM d, yyyy')}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              autoFocus
              label="Reason for exclusion"
              fullWidth
              multiline
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., One-time home repair, vacation expense, medical emergency..."
              helperText="Optional: Provide a brief explanation for why this transaction should be excluded"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleExcludeConfirm} 
              variant="contained" 
              color="warning"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <ExcludeIcon />}
            >
              Exclude from Budget
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <InfoIcon sx={{ color: 'grey.600', fontSize: 20, mt: 0.25 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Budget Calculation
          </Typography>
          
          {isExcluded ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={<ExcludeIcon />}
                  label="Excluded from budget"
                  color="warning"
                  size="small"
                />
                <Button
                  size="small"
                  startIcon={<IncludeIcon />}
                  onClick={handleToggleExclusion}
                  disabled={loading}
                >
                  {loading ? 'Including...' : 'Include in budget'}
                </Button>
              </Box>
              
              {transaction.exclusionReason && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Reason: {transaction.exclusionReason}
                </Typography>
              )}
              
              {transaction.excludedAt && (
                <Typography variant="caption" color="text.secondary">
                  Excluded on {format(new Date(transaction.excludedAt), 'MMM d, yyyy \'at\' h:mm a')}
                </Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={<IncludeIcon />}
                label="Included in budget"
                color="success"
                size="small"
              />
              <Button
                size="small"
                startIcon={<ExcludeIcon />}
                onClick={handleToggleExclusion}
                disabled={loading}
                color="warning"
              >
                {loading ? 'Excluding...' : 'Exclude from budget'}
              </Button>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Exclude from Budget</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This transaction will be excluded from budget calculations. This is useful for 
            one-time expenses that shouldn't affect your regular budget planning.
          </DialogContentText>
          
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Transaction Details
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatCurrencyDisplay(transaction.amount, transaction.currency)} • {transaction.description}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {format(new Date(transaction.date), 'MMM d, yyyy')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            autoFocus
            label="Reason for exclusion"
            fullWidth
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., One-time home repair, vacation expense, medical emergency..."
            helperText="Optional: Provide a brief explanation for why this transaction should be excluded"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={loading}>
            Cancel
          </Button>
            <Button 
              onClick={handleExcludeConfirm} 
              variant="contained" 
              color="warning"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <ExcludeIcon />}
            >
              Exclude from Budget
            </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TransactionBudgetExclusion;
