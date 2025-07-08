import React, { useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  Paper,
  Chip,
  Stack,
  Checkbox,
  ListItemIcon
} from '@mui/material';
import type { Transaction } from '../../services/api/types/transaction';

interface BatchTransactionListProps {
  transactions: Transaction[];
  mainTransaction?: Transaction;
  dense?: boolean;
  maxHeight?: number;
  selectedIds?: string[];
  focusedId?: string | null;
  onSelectionChange?: (id: string, selected: boolean) => void;
}

export const BatchTransactionList: React.FC<BatchTransactionListProps> = ({
  transactions,
  mainTransaction,
  dense = false,
  maxHeight,
  selectedIds = [],
  focusedId,
  onSelectionChange
}) => {
  useEffect(() => {
    if (focusedId) {
      const element = document.querySelector(`[data-transaction-id="${focusedId}"]`) as HTMLElement;
      if (element) {
        element.focus();
      }
    }
  }, [focusedId]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: currency
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        overflow: maxHeight ? 'auto' : undefined
      }}
    >
      <List dense={dense}>
        {transactions.map((transaction) => (
          <ListItem
            key={transaction._id}
            data-transaction-id={transaction._id}
            tabIndex={0}
            sx={{
              bgcolor: transaction._id === focusedId ? 'rgba(0, 0, 0, 0.04)' : undefined,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '-2px'
              }
            }}
          >
            <ListItemIcon>
              <Checkbox
                edge="start"
                checked={selectedIds.includes(transaction._id)}
                onChange={(e) => onSelectionChange?.(transaction._id, e.target.checked)}
                disabled={transaction._id === mainTransaction?._id && selectedIds.includes(transaction._id)}
                tabIndex={-1}
                disableRipple
              />
            </ListItemIcon>
            <Box sx={{ width: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body1">
                        {transaction.description}
                      </Typography>
                      {transaction._id === mainTransaction?._id && (
                        <Chip
                          label="Main"
                          size="small"
                          color="primary"
                        />
                      )}
                    </Stack>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(transaction.date)} • 
                      {formatAmount(transaction.amount, transaction.currency)}
                    </Typography>
                  }
                />

                {transaction.category && (
                  <Chip
                    label={`${transaction.category.name} > ${transaction.subCategory?.name}`}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                )}
              </Stack>
            </Box>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};
