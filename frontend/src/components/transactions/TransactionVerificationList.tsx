import React, { useState, useEffect } from 'react';
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ListItemButton
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Category as CategoryIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  KeyboardCommandKey as KeyboardIcon
} from '@mui/icons-material';
import type { PendingTransaction } from '../../services/api/types/transactions';
import { formatCurrency } from '../../utils/formatters';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';

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
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    // Reset selection if transactions change
    setSelectedIndex(0);
  }, [transactions]);

  // Keyboard shortcuts
  useKeyboardShortcut({ key: 'e' }, () => {
    if (loading) return;
    const transaction = transactions[selectedIndex];
    if (transaction) {
      setExpandedTransactionId(prev => prev === transaction._id ? null : transaction._id);
    }
  });

  useKeyboardShortcut({ key: 'v' }, () => {
    if (loading) return;
    const transaction = transactions[selectedIndex];
    if (transaction?.category) {
      onVerify(transaction._id);
    }
  });

  useKeyboardShortcut({ key: 'n' }, () => {
    if (loading || selectedIndex >= transactions.length - 1) return;
    setSelectedIndex(prev => prev + 1);
  });

  useKeyboardShortcut({ key: 'p' }, () => {
    if (loading || selectedIndex <= 0) return;
    setSelectedIndex(prev => prev - 1);
  });

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

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
        <IconButton onClick={() => setHelpOpen(true)} aria-label="keyboard shortcuts">
          <KeyboardIcon />
        </IconButton>
      </Box>

      <List>
        {transactions.map((transaction, index) => (
          <ListItem
            key={transaction._id}
            disablePadding
            divider
            secondaryAction={
              <Box>
                <IconButton
                  edge="end"
                  aria-label="expand"
                  onClick={() => setExpandedTransactionId(prev => 
                    prev === transaction._id ? null : transaction._id
                  )}
                >
                  <ExpandIcon />
                </IconButton>
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
              </Box>
            }
          >
            <ListItemButton selected={index === selectedIndex}>
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
            </ListItemButton>
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

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)}>
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography>
              <strong>E</strong> - Expand/collapse current transaction
            </Typography>
            <Typography>
              <strong>V</strong> - Verify current transaction
            </Typography>
            <Typography>
              <strong>N</strong> - Next transaction
            </Typography>
            <Typography>
              <strong>P</strong> - Previous transaction
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>Got it</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
