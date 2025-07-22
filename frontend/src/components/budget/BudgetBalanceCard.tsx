import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography
} from '@mui/material';
import { formatCurrencyDisplay } from '../../utils/formatters';

interface BudgetBalanceCardProps {
  budgetBalance: number;
}

const BudgetBalanceCard: React.FC<BudgetBalanceCardProps> = ({
  budgetBalance
}) => {
  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Budget Balance
          </Typography>
          <Typography 
            variant="h5" 
            color={budgetBalance >= 0 ? 'success.main' : 'error.main'}
          >
            {formatCurrencyDisplay(budgetBalance)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BudgetBalanceCard;
