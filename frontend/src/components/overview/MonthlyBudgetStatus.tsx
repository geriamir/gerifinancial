import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Skeleton,
  Alert,
  useTheme,
  alpha,
  Chip,
} from '@mui/material';
import {
  TrendingUp as IncomeIcon,
  TrendingDown as ExpenseIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { budgetsApi } from '../../services/api/budgets';
import { formatCurrencyDisplay } from '../../utils/formatters';

// ---------- Types ----------

interface BudgetCategory {
  name: string;
  categoryId?: string;
  subCategoryId?: string;
  budgeted: number;
  actual: number;
  percentage: number;
}

interface MonthlyData {
  income: number;
  budgetedIncome: number;
  expenses: number;
  budgetedExpenses: number;
  budgetProgress: number;
  topCategories: BudgetCategory[];
  daysRemaining: number;
  daysTotal: number;
  daysPassed: number;
  hasBudget: boolean;
}

// ---------- Main component ----------

const MonthlyBudgetStatus: React.FC = () => {
  const theme = useTheme();
  const mode = theme.palette.mode;
  const navigate = useNavigate();
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const daysTotal = new Date(year, month, 0).getDate();
        const daysPassed = now.getDate();
        const daysRemaining = daysTotal - daysPassed;

        const [summaryResult, budgetResult] = await Promise.allSettled([
          budgetsApi.getBudgetSummary(year, month),
          budgetsApi.getMonthlyBudget(year, month),
        ]);

        if (cancelled) return;

        let income = 0;
        let budgetedIncome = 0;
        let expenses = 0;
        let budgetedExpenses = 0;
        let topCategories: BudgetCategory[] = [];
        let hasBudget = false;

        // Try budget summary first
        if (summaryResult.status === 'fulfilled') {
          const resp = summaryResult.value as any;
          const d = resp.data || resp;
          if (d.monthly) {
            income = d.monthly.totalActualIncome || 0;
            budgetedIncome = d.monthly.totalBudgetedIncome || 0;
            expenses = d.monthly.totalActualExpenses || 0;
            budgetedExpenses = d.monthly.totalBudgetedExpenses || 0;
            hasBudget = budgetedExpenses > 0;
          }
        }

        // Fall back to monthly budget for category details
        if (budgetResult.status === 'fulfilled') {
          const resp = budgetResult.value as any;
          const budget = resp.data || resp;

          if (!hasBudget && budget.totalBudgetedExpenses > 0) {
            income = budget.totalActualIncome || income;
            budgetedIncome = budget.totalBudgetedIncome || budgetedIncome;
            expenses = budget.totalActualExpenses || expenses;
            budgetedExpenses = budget.totalBudgetedExpenses || budgetedExpenses;
            hasBudget = true;
          }

          // Extract top spending categories
          if (budget.expenseBudgets && Array.isArray(budget.expenseBudgets)) {
            topCategories = budget.expenseBudgets
              .filter((cat: any) => (cat.budgetedAmount || 0) > 0 || (cat.actualAmount || 0) > 0)
              .map((cat: any) => ({
                name: cat.subCategoryId?.name || cat.categoryId?.name || 'Other',
                categoryId: cat.categoryId?._id || cat.categoryId,
                subCategoryId: cat.subCategoryId?._id || cat.subCategoryId,
                budgeted: cat.budgetedAmount || 0,
                actual: cat.actualAmount || 0,
                percentage: cat.budgetedAmount
                  ? Math.round(((cat.actualAmount || 0) / cat.budgetedAmount) * 100)
                  : 0,
              }))
              .sort((a: BudgetCategory, b: BudgetCategory) => b.actual - a.actual)
              .slice(0, 4);
          }
        }

        const budgetProgress = budgetedExpenses > 0
          ? Math.round((expenses / budgetedExpenses) * 100)
          : 0;

        setData({
          income,
          budgetedIncome,
          expenses,
          budgetedExpenses,
          budgetProgress,
          topCategories,
          daysRemaining,
          daysTotal,
          daysPassed,
          hasBudget,
        });
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load budget data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card sx={{ height: '100%', minHeight: 420 }}>
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="text" width="60%" height={28} />
          <Box sx={{ mt: 3 }}>
            <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
          </Box>
          <Box sx={{ mt: 3 }}>
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ mt: 2 }}>
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 1, mt: 0.5 }} />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ height: '100%', minHeight: 420 }}>
        <CardContent sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const timeProgress = Math.round((data.daysPassed / data.daysTotal) * 100);
  const isOverBudget = data.budgetProgress > 100;
  const isAheadOfTime = data.budgetProgress < timeProgress;
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const budgetsUrl = '/budgets';

  return (
    <Card sx={{ height: '100%', minHeight: 420 }}>
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => navigate(budgetsUrl)}
          >
            {monthName} Budget
          </Typography>
          <Chip
            icon={<CalendarIcon sx={{ fontSize: '14px !important' }} />}
            label={`${data.daysRemaining}d left`}
            size="small"
            variant="outlined"
            sx={{ height: 24, '& .MuiChip-label': { px: 1, fontSize: '0.7rem' } }}
          />
        </Box>

        {!data.hasBudget ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Typography color="text.secondary" textAlign="center">
              No budget set for {monthName}.<br />
              <Typography
                component="span"
                variant="body2"
                color="primary"
                sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigate('/budgets')}
              >
                Create one →
              </Typography>
            </Typography>
          </Box>
        ) : (
          <>
            {/* Income vs Expenses summary */}
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                mb: 2.5,
              }}
            >
              {/* Income */}
              <Box
                sx={{
                  flex: 1,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.success.main, mode === 'dark' ? 0.1 : 0.06),
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.85 },
                }}
                onClick={() => navigate(budgetsUrl)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <IncomeIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    Income
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={700} color="success.main">
                  {formatCurrencyDisplay(data.income)}
                </Typography>
                {data.budgetedIncome > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    of {formatCurrencyDisplay(data.budgetedIncome)}
                  </Typography>
                )}
              </Box>

              {/* Expenses */}
              <Box
                sx={{
                  flex: 1,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.error.main, mode === 'dark' ? 0.1 : 0.06),
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.85 },
                }}
                onClick={() => navigate(budgetsUrl)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <ExpenseIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  <Typography variant="caption" color="text.secondary">
                    Expenses
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight={700} color="error.main">
                  {formatCurrencyDisplay(data.expenses)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  of {formatCurrencyDisplay(data.budgetedExpenses)}
                </Typography>
              </Box>
            </Box>

            {/* Overall budget progress */}
            <Box sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Budget used
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color={isOverBudget ? 'error.main' : isAheadOfTime ? 'success.main' : 'warning.main'}
                >
                  {data.budgetProgress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(data.budgetProgress, 100)}
                color={isOverBudget ? 'error' : isAheadOfTime ? 'success' : 'warning'}
                sx={{ height: 8, borderRadius: 4 }}
              />
              {/* Time progress marker */}
              <Box sx={{ position: 'relative', mt: 0.3 }}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${timeProgress}%`,
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderBottom: `5px solid ${theme.palette.text.secondary}`,
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {timeProgress}% of month elapsed
              </Typography>
            </Box>

            {/* Top categories */}
            {data.topCategories.length > 0 && (
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                  Top Categories
                </Typography>
                {data.topCategories.map((cat) => (
                  <Box
                    key={cat.name}
                    sx={{ mb: 1.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                    onClick={() => {
                      if (cat.categoryId && cat.subCategoryId) {
                        navigate(`/budgets/subcategory/${year}/${month}/${cat.categoryId}/${cat.subCategoryId}`);
                      } else {
                        navigate(budgetsUrl);
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                      <Typography variant="caption" noWrap sx={{ maxWidth: '50%' }}>
                        {cat.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatCurrencyDisplay(cat.actual)} / {formatCurrencyDisplay(cat.budgeted)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(cat.percentage, 100)}
                      color={cat.percentage > 100 ? 'error' : cat.percentage > 80 ? 'warning' : 'primary'}
                      sx={{ height: 5, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyBudgetStatus;
