import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Skeleton,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  DateRange as DateRangeIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as ProjectIcon,
  Calculate as CalculatorIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  AutoGraph as AutoGraphIcon
} from '@mui/icons-material';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency } from '../utils/formatters';

// Month names for display
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const BudgetsPage: React.FC = () => {
  const {
    currentMonthlyBudget,
    projectBudgets,
    budgetSummary,
    loading,
    error,
    currentYear,
    currentMonth,
    setCurrentPeriod,
    createMonthlyBudget,
    calculateMonthlyBudget
  } = useBudget();

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  // Handle period navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentPeriod(currentYear - 1, 12);
    } else {
      setCurrentPeriod(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentPeriod(currentYear + 1, 1);
    } else {
      setCurrentPeriod(currentYear, currentMonth + 1);
    }
  };

  // Handle budget creation
  const handleCreateBudget = async () => {
    try {
      await createMonthlyBudget({
        year: currentYear,
        month: currentMonth,
        status: 'draft'
      });
    } catch (error) {
      console.error('Failed to create budget:', error);
    }
  };

  const handleAutoCalculate = async () => {
    try {
      await calculateMonthlyBudget(currentYear, currentMonth, 3);
    } catch (error) {
      console.error('Failed to auto-calculate budget:', error);
    }
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, budgetId: string) => {
    setMenuAnchor(event.currentTarget);
    setSelectedBudgetId(budgetId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedBudgetId(null);
  };

  // Calculate progress percentage for budget vs actual
  const calculateProgress = (actual: number, budgeted: number) => {
    if (budgeted === 0) return 0;
    return Math.min((actual / budgeted) * 100, 100);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'planning': return 'warning';
      case 'on-hold': return 'error';
      default: return 'default';
    }
  };

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Budget Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateBudget}
          disabled={loading}
        >
          Create Budget
        </Button>
      </Box>

      {/* Month Navigation */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button onClick={handlePrevMonth} disabled={loading}>
              ← Previous
            </Button>
            <Box display="flex" alignItems="center" gap={1}>
              <DateRangeIcon />
              <Typography variant="h6">
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </Typography>
            </Box>
            <Button onClick={handleNextMonth} disabled={loading}>
              Next →
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Box sx={{
        display: 'flex', 
        flexDirection: { xs: 'column', lg: 'row' }, 
        gap: 3 
      }}>
        {/* Monthly Budget Section */}
        <Box sx={{ flex: 2 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Monthly Budget</Typography>
                {currentMonthlyBudget && (
                  <Box display="flex" gap={1}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, currentMonthlyBudget._id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                )}
              </Box>

              {loading && !currentMonthlyBudget ? (
                <Box>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="rectangular" height={60} sx={{ mt: 1 }} />
                </Box>
              ) : currentMonthlyBudget ? (
                <Box>
                  {/* Budget Status */}
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Chip
                      label={currentMonthlyBudget.status}
                      color={getStatusColor(currentMonthlyBudget.status) as any}
                      size="small"
                    />
                    {currentMonthlyBudget.isAutoCalculated && (
                      <Chip
                        label="Auto-calculated"
                        color="info"
                        size="small"
                        icon={<AutoGraphIcon />}
                      />
                    )}
                  </Box>

                  {/* Income vs Expenses */}
                  <Box sx={{
                    display: 'flex', 
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 2,
                    mb: 2
                  }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Income
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(currentMonthlyBudget.totalBudgetedIncome)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Total Expenses
                      </Typography>
                      <Typography variant="h6" color="error.main">
                        {formatCurrency(currentMonthlyBudget.totalBudgetedExpenses)}
                      </Typography>
                      <Box mt={1}>
                        <LinearProgress
                          variant="determinate"
                          value={calculateProgress(
                            currentMonthlyBudget.totalActualExpenses,
                            currentMonthlyBudget.totalBudgetedExpenses
                          )}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {formatCurrency(currentMonthlyBudget.totalActualExpenses)} spent
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Budget Balance */}
                  <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
                    <Typography variant="body2" color="text.secondary">
                      Budget Balance
                    </Typography>
                    <Typography variant="h6" color={currentMonthlyBudget.budgetBalance >= 0 ? 'success.main' : 'error.main'}>
                      {formatCurrency(currentMonthlyBudget.budgetBalance)}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <Typography variant="body1" color="text.secondary" mb={2}>
                    No budget found for {MONTH_NAMES[currentMonth - 1]} {currentYear}
                  </Typography>
                  <Stack direction="row" spacing={2} justifyContent="center">
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={handleCreateBudget}
                      disabled={loading}
                    >
                      Create Budget
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CalculatorIcon />}
                      onClick={handleAutoCalculate}
                      disabled={loading}
                    >
                      Auto-Calculate
                    </Button>
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Quick Actions & Summary */}
        <Box sx={{ flex: 1, minWidth: { lg: 300 } }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" mb={2}>Quick Actions</Typography>
              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<TrendingUpIcon />}
                  fullWidth
                  disabled={loading}
                >
                  View Analytics
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ProjectIcon />}
                  fullWidth
                  disabled={loading}
                >
                  Manage Projects
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  fullWidth
                  disabled={loading}
                >
                  Edit Categories
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Summary Card */}
          {budgetSummary && (
            <Card>
              <CardContent>
                <Typography variant="h6" mb={2}>Summary</Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Active Projects
                    </Typography>
                    <Typography variant="h6">
                      {budgetSummary.activeProjects?.length || 0}
                    </Typography>
                  </Box>
                  {budgetSummary.monthly && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        This Month Balance
                      </Typography>
                      <Typography
                        variant="h6"
                        color={budgetSummary.monthly.actualBalance >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(budgetSummary.monthly.actualBalance)}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      {/* Project Budgets Section */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Active Projects</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              size="small"
              disabled={loading}
            >
              New Project
            </Button>
          </Box>

          {loading && (!projectBudgets || projectBudgets.length === 0) ? (
            <Box>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} variant="rectangular" height={60} sx={{ mb: 1 }} />
              ))}
            </Box>
          ) : projectBudgets && projectBudgets.length > 0 ? (
            <Box>
              {projectBudgets.slice(0, 5).map((project) => (
                <Box
                  key={project._id}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  p={2}
                  border={1}
                  borderColor="grey.200"
                  borderRadius={1}
                  mb={1}
                >
                  <Box>
                    <Typography variant="subtitle1">{project.name}</Typography>
                    <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                      <Chip
                        label={project.status}
                        color={getStatusColor(project.status) as any}
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {project.daysRemaining} days remaining
                      </Typography>
                    </Box>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="body2" color="text.secondary">
                      {project.progressPercentage.toFixed(1)}% complete
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={project.progressPercentage}
                      sx={{ width: 100, mt: 0.5 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatCurrency(project.remainingBudget)} remaining
                    </Typography>
                  </Box>
                </Box>
              ))}
              {projectBudgets && projectBudgets.length > 5 && (
                <Button variant="text" fullWidth sx={{ mt: 1 }}>
                  View All Projects ({projectBudgets.length})
                </Button>
              )}
            </Box>
          ) : (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" color="text.secondary" mb={2}>
                No active projects
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                disabled={loading}
              >
                Create Your First Project
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit Budget
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <TrendingUpIcon sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <CalculatorIcon sx={{ mr: 1 }} fontSize="small" />
          Recalculate
        </MenuItem>
      </Menu>
    </Container>
  );
};

export default BudgetsPage;
