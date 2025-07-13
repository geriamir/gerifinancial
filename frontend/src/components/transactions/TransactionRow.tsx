import React from 'react';
import {
  Box,
  Paper,
  Typography,
} from '@mui/material';
import { Category as CategoryIcon } from '@mui/icons-material';
import type { Transaction } from '../../services/api/types/transactions';
import { formatCurrency, formatCurrencyDisplay } from '../../utils/formatters';

interface TransactionRowProps {
  transaction: Transaction;
  'data-testid'?: string;
  onClick?: () => void;
}

const TransactionRow: React.FC<TransactionRowProps> = ({ 
  transaction, 
  'data-testid': testId,
  onClick 
}) => {
  const baseTestId = testId || `transaction-${transaction._id}`;
  
  return (
    <Paper
      data-testid={baseTestId}
      sx={{
        p: 2,
        display: 'flex',
        justifyContent: 'space-between',
        '&:hover': {
          bgcolor: 'action.hover',
          cursor: onClick ? 'pointer' : 'default'
        },
      }}
      onClick={onClick}
      elevation={0}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
        {transaction.category && (
          <CategoryIcon 
            sx={{ color: 'primary.main' }}
            data-testid={`${baseTestId}-category-icon`}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {transaction.subCategory && (
            <Typography 
              variant="caption" 
              color="primary"
              data-testid={`${baseTestId}-subcategory`}
              sx={{ mb: 0.25, display: 'block', fontSize: '0.75rem', lineHeight: 1.2, fontWeight: 'bold' }}
            >
              {transaction.subCategory.name}
            </Typography>
          )}
          <Typography 
            variant="body2"
            data-testid={`${baseTestId}-description`}
            color="text.secondary"
          >
            {transaction.description}
          </Typography>
        </Box>
        
        <Typography
          variant="subtitle1"
          data-testid={`${baseTestId}-amount`}
          sx={{ minWidth: 100, textAlign: 'right', fontFamily: 'monospace' }}
        >
          {formatCurrencyDisplay(transaction.amount, transaction.currency)}
        </Typography>
      </Box>
    </Paper>
  );
};

export default TransactionRow;
