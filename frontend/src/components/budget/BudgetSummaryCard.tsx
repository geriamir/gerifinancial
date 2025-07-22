import React from 'react';
import {
  Box,
  Typography,
  LinearProgress
} from '@mui/material';
import { formatCurrencyDisplay } from '../../utils/formatters';

interface BudgetSummaryCardProps {
  title: string;
  totalBudgeted: number;
  totalActual: number;
  color: 'success' | 'error';
}

const BudgetSummaryCard: React.FC<BudgetSummaryCardProps> = ({
  title,
  totalBudgeted,
  totalActual,
  color
}) => {
  const progressPercentage = totalBudgeted > 0 ? Math.min((totalActual / totalBudgeted) * 100, 100) : 0;

  return (
    <Box p={2} bgcolor={`${color}.50`} borderRadius={1} mb={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="body2" color="text.secondary">
          Budget vs Actual
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {progressPercentage.toFixed(1)}%
        </Typography>
      </Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6" color={`${color}.dark`}>
          {formatCurrencyDisplay(totalBudgeted)}
        </Typography>
        <Typography variant="body1" color={`${color}.dark`}>
          {formatCurrencyDisplay(totalActual)}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progressPercentage}
        sx={{ 
          height: 6, 
          borderRadius: 3,
          backgroundColor: `${color}.100`,
          '& .MuiLinearProgress-bar': {
            backgroundColor: `${color}.main`
          }
        }}
      />
      <Box display="flex" justifyContent="space-between" mt={1}>
        <Typography variant="caption" color="text.secondary">
          Budget
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Actual
        </Typography>
      </Box>
    </Box>
  );
};

export default BudgetSummaryCard;
