import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { Transaction } from '../../services/api/types';

interface TransactionRowProps {
  transaction: Transaction;
  'data-testid'?: string;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatAmount = (amount: number, currency: string) => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
};

const getTypeColor = (type: Transaction['type']) => {
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

const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, 'data-testid': testId }) => {
  const baseTestId = testId || `transaction-${transaction._id}`;
  
  return (
    <Paper
      data-testid={baseTestId}
      sx={{
        p: 2,
        mb: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
      elevation={1}
    >
      <Box sx={{ flex: 1 }}>
        <Typography 
          variant="subtitle1"
          data-testid={`${baseTestId}-description`}
        >
          {transaction.description}
        </Typography>
        <Typography 
          variant="body2" 
          color="text.secondary"
          data-testid={`${baseTestId}-date`}
        >
          {formatDate(transaction.date)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {transaction.category && (
          <Chip
            label={transaction.category.name}
            size="small"
            variant="outlined"
            data-testid={`${baseTestId}-category`}
          />
        )}
        
        <Box sx={{ textAlign: 'right', minWidth: 120 }}>
          <Typography
            variant="subtitle1"
            color={transaction.type === 'Expense' ? 'error' : 'success'}
            data-testid={`${baseTestId}-amount`}
          >
            {formatAmount(transaction.amount, transaction.currency)}
          </Typography>
          <Chip
            label={transaction.type}
            size="small"
            color={getTypeColor(transaction.type)}
            data-testid={`${baseTestId}-type`}
          />
        </Box>

        <Tooltip title="Edit transaction">
          <IconButton 
            size="small"
            data-testid={`${baseTestId}-edit`}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};

export default TransactionRow;
