import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import {
  Block as ExcludeIcon,
} from '@mui/icons-material';
import type { Transaction } from '../../services/api/types/transactions';
import { formatCurrencyDisplay } from '../../utils/formatters';
import CategoryIcon from '../common/CategoryIcon';
import { getCategoryIconTheme } from '../../constants/categoryIconSystem';

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
  
  // Get category theme for text color
  const categoryTheme = transaction.category 
    ? getCategoryIconTheme(transaction.category.name)
    : null;
  
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
            categoryName={transaction.category.name}
            subcategoryName={transaction.subCategory?.name}
            size="small"
            variant="plain"
            showTooltip={false}
            data-testid={`${baseTestId}-category-icon`}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Show category/subcategory info based on transaction type */}
          {transaction.category && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
              <Typography 
                variant="caption" 
                data-testid={`${baseTestId}-category`}
                sx={{ 
                  fontSize: '0.75rem', 
                  lineHeight: 1.2, 
                  fontWeight: 'bold',
                  color: categoryTheme?.primary || 'primary.main'
                }}
              >
                {transaction.category.type === 'Expense' && transaction.subCategory 
                  ? transaction.subCategory.name 
                  : transaction.category.name}
              </Typography>
              
              {/* Budget exclusion indicator */}
              {transaction.excludeFromBudgetCalculation && (
                <Chip
                  icon={<ExcludeIcon />}
                  label="Excluded"
                  color="warning"
                  size="small"
                  sx={{ 
                    height: '18px',
                    fontSize: '0.65rem',
                    '& .MuiChip-icon': {
                      fontSize: '12px'
                    }
                  }}
                  data-testid={`${baseTestId}-excluded-indicator`}
                />
              )}
            </Box>
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
