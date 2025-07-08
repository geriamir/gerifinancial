import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Box,
  Typography,
  Chip,
  Alert,
  AlertTitle,
  Button
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Category as CategoryIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import type { PendingTransaction } from '../../services/api/types/transactions';
import { formatCurrency } from '../../utils/formatters';

interface TransactionVerificationListProps {
  transactions: PendingTransaction[];
  onVerify: (transactionId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  error?: string | null;
  verificationStatus?: {
    current: number;
    successful: number;
    failed: number;
  };
}

export const TransactionVerificationList: React.FC<TransactionVerificationListProps> = ({
  transactions,
  onVerify,
  onLoadMore,
  hasMore,
  loading = false,
  error,
  verificationStatus
}) => {
  return (
    <Paper>
      {verificationStatus && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Verification Progress
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip 
              icon={<CheckIcon />}
              label={`${verificationStatus.successful} Successful`}
              color="success"
              variant="outlined"
            />
            {verificationStatus.failed > 0 && (
              <Chip 
                icon={<ErrorIcon />}
                label={`${verificationStatus.failed} Failed`}
                color="error"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      )}

      {error && (
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      <List>
        {transactions.map((transaction) => (
          <ListItem
            key={transaction._id}
            divider
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <ListItemText
              primary={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" component="span">
                    {transaction.description}
                  </Typography>
                  {transaction.category && (
                    <Chip
                      size="small"
                      icon={<CategoryIcon />}
                      label={transaction.category.name}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Box>
              }
              secondary={
                <>
                  <Box component="span" display="block" sx={{ mt: 1 }}>
                    <Typography variant="body2" component="span" color="text.secondary">
                      {new Date(transaction.date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box component="span" display="block">
                    <Typography
                      variant="body2"
                      component="span"
                      color={transaction.amount < 0 ? 'error' : 'success'}
                      sx={{ fontWeight: 'bold' }}
                    >
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </Typography>
                  </Box>
                </>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                aria-label="verify"
                onClick={() => onVerify(transaction._id)}
                color="primary"
                disabled={!transaction.category}
                title={transaction.category ? 'Verify transaction' : 'Please categorize first'}
              >
                <CheckIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      {hasMore && (
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
    </Paper>
  );
};
