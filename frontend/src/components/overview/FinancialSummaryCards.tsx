/**
 * NAVIGATION SIMPLIFICATION - Completed
 * 
 * Implementation Notes:
 * - Financial summary cards for enhanced Overview page
 * - Displays balance, monthly income/expenses, budget progress
 * - Responsive design with Material-UI cards
 * - TypeScript-safe color handling for Material-UI components
 * - All functionality verified and working
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  TrendingUp as IncomeIcon,
  TrendingDown as ExpenseIcon,
  AccountBalanceWallet as BudgetIcon
} from '@mui/icons-material';

interface FinancialSummary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  budgetProgress: number;
  balanceChange: number;
  budgetStatus: 'on-track' | 'over-budget' | 'under-budget';
}

interface FinancialSummaryCardsProps {
  summary?: FinancialSummary;
  loading?: boolean;
}

// Mock data for development - will be replaced with real data integration
const mockSummary: FinancialSummary = {
  totalBalance: 12450,
  monthlyIncome: 8500,
  monthlyExpenses: 6200,
  budgetProgress: 85,
  balanceChange: 2.3,
  budgetStatus: 'on-track'
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Type-safe color mapping for Material-UI Chip component
type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const getBudgetStatusColor = (status: string): ChipColor => {
  switch (status) {
    case 'on-track': return 'success';
    case 'over-budget': return 'error';
    case 'under-budget': return 'warning';
    default: return 'default';
  }
};

const getBudgetStatusLabel = (status: string) => {
  switch (status) {
    case 'on-track': return 'On Track';
    case 'over-budget': return 'Over Budget';
    case 'under-budget': return 'Under Budget';
    default: return 'Unknown';
  }
};

export const FinancialSummaryCards: React.FC<FinancialSummaryCardsProps> = ({
  summary = mockSummary,
  loading = false
}) => {
  const cards = [
    {
      title: 'Total Balance',
      value: formatCurrency(summary.totalBalance),
      change: `${summary.balanceChange > 0 ? '+' : ''}${summary.balanceChange}%`,
      changeColor: summary.balanceChange > 0 ? 'success.main' : 'error.main',
      icon: <BalanceIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      subtitle: 'vs last month'
    },
    {
      title: 'This Month',
      value: (
        <Box>
          <Typography variant="body2" color="success.main">
            Income: {formatCurrency(summary.monthlyIncome)}
          </Typography>
          <Typography variant="body2" color="error.main">
            Expenses: {formatCurrency(summary.monthlyExpenses)}
          </Typography>
        </Box>
      ),
      change: `Net: ${formatCurrency(summary.monthlyIncome - summary.monthlyExpenses)}`,
      changeColor: summary.monthlyIncome > summary.monthlyExpenses ? 'success.main' : 'error.main',
      icon: summary.monthlyIncome > summary.monthlyExpenses 
        ? <IncomeIcon sx={{ fontSize: 40, color: 'success.main' }} />
        : <ExpenseIcon sx={{ fontSize: 40, color: 'error.main' }} />,
      subtitle: 'current month'
    },
    {
      title: 'Budget Progress',
      value: (
        <Box>
          <Typography variant="h4" component="div" gutterBottom>
            {summary.budgetProgress}%
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={summary.budgetProgress} 
            sx={{ mb: 1, height: 8, borderRadius: 4 }}
            color={summary.budgetProgress > 100 ? 'error' : 'primary'}
          />
          <Chip 
            label={getBudgetStatusLabel(summary.budgetStatus)}
            color={getBudgetStatusColor(summary.budgetStatus)}
            size="small"
          />
        </Box>
      ),
      change: '',
      changeColor: 'text.secondary',
      icon: <BudgetIcon sx={{ fontSize: 40, color: 'secondary.main' }} />,
      subtitle: 'monthly budget'
    }
  ];

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' }, 
        gap: 3 
      }}>
        {[1, 2, 3].map((index) => (
          <Box key={index} sx={{ flex: 1 }}>
            <Card sx={{ height: 200 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ width: 40, height: 40, bgcolor: 'grey.300', borderRadius: 1, mr: 2 }} />
                  <Box sx={{ width: '60%', height: 20, bgcolor: 'grey.300', borderRadius: 1 }} />
                </Box>
                <Box sx={{ width: '80%', height: 32, bgcolor: 'grey.300', borderRadius: 1, mb: 1 }} />
                <Box sx={{ width: '50%', height: 16, bgcolor: 'grey.300', borderRadius: 1 }} />
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: { xs: 'column', md: 'row' }, 
      gap: 3 
    }}>
      {cards.map((card, index) => (
        <Box key={index} sx={{ flex: 1 }}>
          <Card sx={{ 
            height: 200, 
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 4
            }
          }}>
            <CardContent sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%',
              p: 3
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {card.icon}
                <Typography variant="h6" sx={{ ml: 2, fontWeight: 600 }}>
                  {card.title}
                </Typography>
              </Box>
              
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {typeof card.value === 'string' ? (
                  <Typography variant="h4" component="div" gutterBottom sx={{ fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                ) : (
                  card.value
                )}
                
                {card.change && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: card.changeColor,
                      fontWeight: 500
                    }}
                  >
                    {card.change}
                  </Typography>
                )}
                
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {card.subtitle}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
  );
};

export default FinancialSummaryCards;
