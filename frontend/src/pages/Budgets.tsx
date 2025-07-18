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
  Stack,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemButton
} from '@mui/material';
import {
  Add as AddIcon,
  DateRange as DateRangeIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as ProjectIcon,
  Calculate as CalculatorIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  AutoGraph as AutoGraphIcon,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrencyDisplay } from '../utils/formatters';
import { getCategoryIconTheme } from '../constants/categoryIconSystem';
import MonthlyBudgetEditor from '../components/budget/MonthlyBudgetEditor';
import InlineBudgetEditor from '../components/budget/InlineBudgetEditor';
import CategoryIcon from '../components/common/CategoryIcon';

// Month names for display
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Reusable component for both income and expense categories
const BudgetCategoryItem: React.FC<{
  category: string;
  subcategories: Array<{
    name: string;
    budgeted: number;
    actual: number;
    categoryId?: string;
    subCategoryId?: string;
  }>;
  totalBudgeted: number;
  totalActual: number;
  color: string;
}> = ({ category, subcategories, totalBudgeted, totalActual, color }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  // Get category theme for consistent styling
  const categoryTheme = getCategoryIconTheme(category);

  return (
    <Box>
      <ListItemButton onClick={handleToggle} sx={{ border: 1, borderColor: 'grey.200', borderRadius: 1, mb: 1, p: 2 }}>
        <Box display="flex" alignItems="center" gap={2} width="100%">
          {/* Category Icon */}
          <CategoryIcon 
            categoryName={category}
            size="small"
            variant="plain"
            showTooltip={false}
          />
          
          {/* Category Name and Budget/Actual */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="caption" 
              sx={{ 
                mb: 0.25, 
                display: 'block', 
                fontSize: '0.75rem', 
                lineHeight: 1.2, 
                fontWeight: 'bold',
                color: categoryTheme?.primary || `${color}.main`
              }}
            >
              {category}
            </Typography>
            <Typography 
              variant="body2" 
              color={color === 'error' && totalActual > totalBudgeted ? 'error.main' : 'text.secondary'}
            >
              {formatCurrencyDisplay(totalActual)}/{formatCurrencyDisplay(totalBudgeted)}
            </Typography>
          </Box>
          
          {/* Collapse Button */}
          {subcategories.length > 0 && (
            <Box sx={{ ml: 'auto' }}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </Box>
          )}
        </Box>
      </ListItemButton>
      
      {subcategories.length > 0 && (
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box ml={4}>
            {subcategories.map((sub, index) => (
              <Box key={index} p={2} mb={0.5} border={1} borderColor="grey.100" borderRadius={1} bgcolor="grey.50">
                <Box display="flex" alignItems="center" gap={2} width="100%">
                  {/* Subcategory Icon */}
                  <CategoryIcon 
                    categoryName={category}
                    subcategoryName={sub.name}
                    size="small"
                    variant="plain"
                    showTooltip={false}
                  />
                  
                  {/* Subcategory Name and Budget/Actual */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        mb: 0.25, 
                        display: 'block', 
                        fontSize: '0.75rem', 
                        lineHeight: 1.2, 
                        fontWeight: 'bold',
                        color: categoryTheme?.primary || `${color}.main`
                      }}
                    >
                      {sub.name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={color === 'error' && sub.actual > sub.budgeted ? 'error.main' : 'text.secondary'}
                    >
                      {formatCurrencyDisplay(sub.actual)}/{formatCurrencyDisplay(sub.budgeted)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

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
    calculateMonthlyBudget,
    updateMonthlyBudget,
    refreshBudgets
  } = useBudget();

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);

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

  // Handle automated budget creation
  const handleAutoCalculate = async () => {
    try {
      await calculateMonthlyBudget(currentYear, currentMonth, 3);
      // Force refresh to ensure we see the updated budget immediately
      await refreshBudgets();
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

  // Budget editor handlers
  const handleEditBudget = () => {
    setBudgetEditorOpen(true);
    handleMenuClose();
  };

  const handleBudgetSaved = () => {
    // Context will automatically refresh
    setBudgetEditorOpen(false);
  };

  // Inline budget update handlers
  const handleUpdateSalaryBudget = async (newAmount: number) => {
    if (!currentMonthlyBudget) return;
    
    await updateMonthlyBudget(currentMonthlyBudget._id, {
      salaryBudget: newAmount
    });
  };

  const handleUpdateOtherIncomeBudget = async (index: number, newAmount: number) => {
    if (!currentMonthlyBudget?.otherIncomeBudgets) return;
    
    const updatedOtherIncome = [...currentMonthlyBudget.otherIncomeBudgets];
    updatedOtherIncome[index] = { ...updatedOtherIncome[index], amount: newAmount };
    
    await updateMonthlyBudget(currentMonthlyBudget._id, {
      otherIncomeBudgets: updatedOtherIncome
    });
  };

  const handleUpdateExpenseBudget = async (categoryId: string, subCategoryId: string, newAmount: number) => {
    if (!currentMonthlyBudget?.expenseBudgets) return;
    
    const updatedExpenses = currentMonthlyBudget.expenseBudgets.map(expense => {
      const expenseCategoryId = typeof expense.categoryId === 'object' 
        ? (expense.categoryId as any)?._id 
        : expense.categoryId;
      const expenseSubCategoryId = typeof expense.subCategoryId === 'object'
        ? (expense.subCategoryId as any)?._id
        : expense.subCategoryId;
        
      if (expenseCategoryId === categoryId && expenseSubCategoryId === subCategoryId) {
        return { ...expense, budgetedAmount: newAmount };
      }
      return expense;
    });
    
    await updateMonthlyBudget(currentMonthlyBudget._id, {
      expenseBudgets: updatedExpenses
    });
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

  // Show loading state
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    );
  }

  // Show simplified empty state when no budget exists
  // Handle API response format {success: true, data: null}
  const hasBudget = currentMonthlyBudget && (currentMonthlyBudget._id || (currentMonthlyBudget as any).data);
  if (!hasBudget) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, mb: 4 }}>
        <Box textAlign="center" py={8}>
          <Typography variant="h4" component="h1" gutterBottom>
            Budget Management
          </Typography>
          <Typography variant="h6" color="text.secondary" mb={1}>
            {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            Create your first budget to start tracking your income and expenses
          </Typography>
          
          <Button
            variant="contained"
            size="large"
            startIcon={<CalculatorIcon />}
            onClick={handleAutoCalculate}
            disabled={loading}
            sx={{ py: 1.5, px: 4 }}
          >
            Auto-Calculate Budget
          </Button>
        </Box>
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
          startIcon={<CalculatorIcon />}
          onClick={handleAutoCalculate}
          disabled={loading}
        >
          Auto-Calculate Budget
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

      {/* Budget Status */}
      {currentMonthlyBudget && (
        <Box display="flex" alignItems="center" gap={2} mb={3}>
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
          <Box ml="auto" display="flex" gap={1}>
            <IconButton
              size="small"
              onClick={(e) => handleMenuOpen(e, currentMonthlyBudget._id)}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Main Content - Two Column Layout */}
      <Box sx={{
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' }, 
        gap: 3 
      }}>
        {/* Income Column */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main" gutterBottom>
                Income
              </Typography>
              
              {/* Income Summary */}
              <Box p={2} bgcolor="success.50" borderRadius={1} mb={3}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Budget vs Actual
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentMonthlyBudget ? 
                      `${((currentMonthlyBudget.totalActualIncome || 0) / currentMonthlyBudget.totalBudgetedIncome * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" color="success.dark">
                    {formatCurrencyDisplay(currentMonthlyBudget?.totalBudgetedIncome || 0)}
                  </Typography>
                  <Typography variant="body1" color="success.dark">
                    {formatCurrencyDisplay(currentMonthlyBudget?.totalActualIncome || 0)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={currentMonthlyBudget ? 
                    Math.min(((currentMonthlyBudget.totalActualIncome || 0) / currentMonthlyBudget.totalBudgetedIncome) * 100, 100)
                    : 0
                  }
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    backgroundColor: 'success.100',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: 'success.main'
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

              {/* Column Headers */}
              <Box display="flex" justifyContent="space-between" alignItems="center" px={2} py={1} bgcolor="grey.100" borderRadius={1} mb={2}>
                <Typography variant="body2" fontWeight="bold" color="text.secondary">
                  Category
                </Typography>
              </Box>

              {/* Income Categories */}
              <Box>
                {/* Salary */}
                <BudgetCategoryItem
                  category="Salary"
                  subcategories={[]}
                  totalBudgeted={currentMonthlyBudget?.salaryBudget || 0}
                  totalActual={0} // TODO: Get actual salary from transactions
                  color="success"
                />

                {/* Other Income Categories */}
                {currentMonthlyBudget?.otherIncomeBudgets?.map((income, index) => (
                  <BudgetCategoryItem
                    key={index}
                    category={typeof income.categoryId === 'object' ? (income.categoryId as any)?.name || 'Other Income' : income.categoryId || 'Other Income'}
                    subcategories={[]}
                    totalBudgeted={income.amount}
                    totalActual={0} // TODO: Get actual from transactions
                    color="success"
                  />
                ))}
                
                {(!currentMonthlyBudget?.otherIncomeBudgets || currentMonthlyBudget.otherIncomeBudgets.length === 0) && (
                  <Box p={2} textAlign="center" color="text.secondary">
                    <Typography variant="body2">
                      No additional income sources
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Expenses Column */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error.main" gutterBottom>
                Expenses
              </Typography>
              
              {/* Expenses Summary */}
              <Box p={2} bgcolor="error.50" borderRadius={1} mb={3}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Budget vs Actual
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentMonthlyBudget ? 
                      `${((currentMonthlyBudget.totalActualExpenses || 0) / currentMonthlyBudget.totalBudgetedExpenses * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" color="error.dark">
                    {formatCurrencyDisplay(currentMonthlyBudget?.totalBudgetedExpenses || 0)}
                  </Typography>
                  <Typography variant="body1" color="error.dark">
                    {formatCurrencyDisplay(currentMonthlyBudget?.totalActualExpenses || 0)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={currentMonthlyBudget ? 
                    Math.min(((currentMonthlyBudget.totalActualExpenses || 0) / currentMonthlyBudget.totalBudgetedExpenses) * 100, 100)
                    : 0
                  }
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    backgroundColor: 'error.100',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: 'error.main'
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

              {/* Column Headers */}
              <Box display="flex" justifyContent="space-between" alignItems="center" px={2} py={1} bgcolor="grey.100" borderRadius={1} mb={2}>
                <Typography variant="body2" fontWeight="bold" color="text.secondary">
                  Category
                </Typography>
              </Box>

              {/* Expense Categories */}
              <Box>
                {currentMonthlyBudget?.expenseBudgets?.length ? (
                  (() => {
                    // Group expenses by category
                    const groupedExpenses = currentMonthlyBudget.expenseBudgets.reduce((acc, expense) => {
                      const categoryName = typeof expense.categoryId === 'object' 
                        ? (expense.categoryId as any)?.name || 'Uncategorized'
                        : expense.categoryId || 'Uncategorized';
                      if (!acc[categoryName]) {
                        acc[categoryName] = [];
                      }
                      acc[categoryName].push(expense);
                      return acc;
                    }, {} as Record<string, typeof currentMonthlyBudget.expenseBudgets>);

                    return Object.entries(groupedExpenses).map(([categoryName, expenses]) => {
                      const totalBudgeted = expenses.reduce((sum, exp) => sum + exp.budgetedAmount, 0);
                      const totalActual = expenses.reduce((sum, exp) => sum + (exp.actualAmount || 0), 0);
                      
                      const subcategories = expenses.map(exp => ({
                        name: typeof exp.subCategoryId === 'object' 
                          ? (exp.subCategoryId as any)?.name || 'General'
                          : exp.subCategoryId || 'General',
                        budgeted: exp.budgetedAmount,
                        actual: exp.actualAmount || 0,
                        categoryId: typeof exp.categoryId === 'object' 
                          ? (exp.categoryId as any)?._id 
                          : exp.categoryId,
                        subCategoryId: typeof exp.subCategoryId === 'object'
                          ? (exp.subCategoryId as any)?._id
                          : exp.subCategoryId
                      }));

                      return (
                        <BudgetCategoryItem
                          key={categoryName}
                          category={categoryName}
                          subcategories={subcategories}
                          totalBudgeted={totalBudgeted}
                          totalActual={totalActual}
                          color="error"
                        />
                      );
                    });
                  })()
                ) : (
                  <Box p={2} textAlign="center" color="text.secondary">
                    <Typography variant="body2">
                      No expense budgets set
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Budget Balance Summary */}
      {currentMonthlyBudget && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Budget Balance
              </Typography>
              <Typography 
                variant="h5" 
                color={currentMonthlyBudget.budgetBalance >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrencyDisplay(currentMonthlyBudget.budgetBalance)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Project Budgets Section */}
      {projectBudgets && projectBudgets.length > 0 && (
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
                      {formatCurrencyDisplay(project.remainingBudget)} remaining
                    </Typography>
                  </Box>
                </Box>
              ))}
              {projectBudgets.length > 5 && (
                <Button variant="text" fullWidth sx={{ mt: 1 }}>
                  View All Projects ({projectBudgets.length})
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditBudget}>
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

      {/* Monthly Budget Editor Dialog */}
      <MonthlyBudgetEditor
        open={budgetEditorOpen}
        budget={currentMonthlyBudget}
        year={currentYear}
        month={currentMonth}
        onClose={() => setBudgetEditorOpen(false)}
        onSave={handleBudgetSaved}
      />
    </Container>
  );
};

export default BudgetsPage;
