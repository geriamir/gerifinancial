import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { RSUGrant } from '../../services/api/rsus';
import { useRSU } from '../../contexts/RSUContext';

interface DeleteGrantConfirmDialogProps {
  open: boolean;
  grant: RSUGrant | null;
  onClose: () => void;
}

const DeleteGrantConfirmDialog: React.FC<DeleteGrantConfirmDialogProps> = ({
  open,
  grant,
  onClose
}) => {
  const { deleteGrant, sales } = useRSU();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleDelete = async () => {
    if (!grant) return;

    setDeleting(true);
    setError('');

    try {
      await deleteGrant(grant._id);
      onClose();
    } catch (error) {
      console.error('Error deleting grant:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete grant');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) {
      onClose();
    }
  };

  if (!grant) return null;

  // Calculate grant-related sales
  const grantSales = sales.filter(sale => {
    const saleGrantId = typeof sale.grantId === 'string' ? sale.grantId : (sale.grantId as any)?._id;
    return saleGrantId === grant._id;
  });

  const totalSoldShares = grantSales.reduce((total, sale) => total + sale.sharesAmount, 0);
  const totalSaleValue = grantSales.reduce((total, sale) => total + sale.totalSaleValue, 0);
  const hasActiveSales = grantSales.length > 0;

  const isPositiveGainLoss = grant.gainLoss >= 0;
  const vestingProgress = Math.round(grant.vestingProgress);

  // Calculate unvested value that will be lost
  const unvestedValue = grant.unvestedShares * grant.currentPrice;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { minHeight: 400 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          <Typography variant="h6" color="error">
            Delete RSU Grant
          </Typography>
        </Box>
        <IconButton onClick={handleClose} disabled={deleting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Warning Message */}
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body1" fontWeight="medium" gutterBottom>
              This action cannot be undone!
            </Typography>
            <Typography variant="body2">
              Deleting this grant will permanently remove all associated data, including vesting schedules and sale records.
            </Typography>
          </Alert>

          {/* Grant Information */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              Grant to be deleted:
            </Typography>
            
            <Box sx={{ 
              p: 2, 
              bgcolor: 'action.hover', 
              borderRadius: 1,
              border: 1,
              borderColor: 'error.light'
            }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6">
                    {grant.stockSymbol}
                    {grant.name && ` • ${grant.name}`}
                  </Typography>
                  <Chip
                    size="small"
                    label={grant.status}
                    color={grant.status === 'active' ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Box>
              </Box>

              {grant.company && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {grant.company}
                </Typography>
              )}

              {/* Key Metrics */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 2,
                mt: 2
              }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Shares
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {grant.totalShares.toLocaleString()}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Current Value
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" color="primary">
                    ${grant.currentValue.toLocaleString()}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Gain/Loss
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {isPositiveGainLoss ? (
                      <TrendingUpIcon fontSize="small" color="success" />
                    ) : (
                      <TrendingDownIcon fontSize="small" color="error" />
                    )}
                    <Typography 
                      variant="body1" 
                      fontWeight="medium"
                      color={isPositiveGainLoss ? 'success.main' : 'error.main'}
                    >
                      {isPositiveGainLoss ? '+' : ''}${grant.gainLoss.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Vesting Progress
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon fontSize="small" color="info" />
                    <Typography variant="body1" fontWeight="medium" color="info.main">
                      {vestingProgress}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Impact Warning */}
          {hasActiveSales && (
            <Box sx={{ mb: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="body1" fontWeight="medium" gutterBottom>
                  This grant has {grantSales.length} associated sale record{grantSales.length !== 1 ? 's' : ''}!
                </Typography>
                <Typography variant="body2">
                  • {totalSoldShares.toLocaleString()} shares sold for ${totalSaleValue.toLocaleString()}
                  <br />
                  • All sale records and tax calculations will be permanently deleted
                  <br />
                  • This may affect your tax reporting and portfolio history
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Unvested Value Warning */}
          {grant.unvestedShares > 0 && (
            <Box sx={{ mb: 3 }}>
              <Alert severity="warning">
                <Typography variant="body1" fontWeight="medium" gutterBottom>
                  Unvested Value Loss: ${unvestedValue.toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  This grant has {grant.unvestedShares.toLocaleString()} unvested shares worth ${unvestedValue.toLocaleString()} 
                  at current market price. Make sure you want to delete this valuable equity position.
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Confirmation */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'error.light', 
            borderRadius: 1,
            textAlign: 'center'
          }}>
            <Typography variant="body1" fontWeight="medium" color="error.dark">
              Are you absolutely sure you want to delete this RSU grant?
            </Typography>
            <Typography variant="body2" color="error.dark" sx={{ mt: 1 }}>
              Type the stock symbol "{grant.stockSymbol}" to confirm deletion
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button 
          onClick={handleClose} 
          disabled={deleting}
          variant="outlined"
          size="large"
          sx={{ flex: 1 }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleDelete}
          disabled={deleting}
          variant="contained"
          color="error"
          size="large"
          startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          sx={{ flex: 1 }}
        >
          {deleting ? 'Deleting...' : `Delete ${grant.stockSymbol}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteGrantConfirmDialog;
