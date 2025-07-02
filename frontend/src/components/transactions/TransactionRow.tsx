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
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatAmount = (amount: number, currency: string) => {
  const value = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return `₪${value}`;
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
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {transaction.category && (
            <Chip
              label={transaction.category.name}
              size="small"
              variant="outlined"
              data-testid={`${baseTestId}-category`}
              sx={{ bgcolor: 'background.paper' }}
            />
          )}
          {transaction.subCategory && (
            <Chip
              label={transaction.subCategory.name}
              size="small"
              variant="outlined"
              color="secondary"
              data-testid={`${baseTestId}-subcategory`}
              sx={{ bgcolor: 'background.paper' }}
            />
          )}
        </Box>
        
        <Box sx={{ textAlign: 'right', minWidth: 120 }}>
          <Typography
            variant="subtitle1"
            color={transaction.type === 'Expense' ? 'error' : 'success'}
            data-testid={`${baseTestId}-amount`}
          >
            {formatAmount(transaction.amount, transaction.currency)}
          </Typography>
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
