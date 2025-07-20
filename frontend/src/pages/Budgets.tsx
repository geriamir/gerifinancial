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
  Collapse,
  ListItemButton
} from '@mui/material';
import {
  Add as AddIcon,
  DateRange as DateRangeIcon,
  TrendingUp as TrendingUpIcon,
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
import CategoryIcon from '../components/common/CategoryIcon';
import PatternDetectionDashboard from '../components/budget/PatternDetection/PatternDetectionDashboard';
import { budgetsApi } from '../services/api/budgets';
import { useNavigate } from 'react-router-dom';
import { BUDGET_STAGES, type BudgetStage } from '../constants/budgetStages';

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
  year: number;
  month: number;
}> = ({ category, subcategories, totalBudgeted, totalActual, color, year, month }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  const handleSubcategoryClick = (subcategory: any, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent expanding/collapsing the category
    if (subcategory.categoryId && subcategory.subCategoryId) {
      navigate(`/budgets/subcategory/${year}/${month}/${subcategory.categoryId}/${subcategory.subCategoryId}`);
    }
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
              <Box 
                key={index} 
                p={2} 
                mb={0.5} 
                border={1} 
                borderColor="grey.100" 
                borderRadius={1} 
                bgcolor="grey.50"
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'grey.100'
                  }
                }}
                onClick={(e) => handleSubcategoryClick(sub, e)}
              >
                <Box display="flex" alignItems="center" gap={2} width="100%">
                  {/* Subcategory Name and Budget/Actual */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        mb: 0.25, 
                        display: 'block', 
                        fontSize: '0.75rem', 
                        lineHeight: 1.2, 
                        fontWeight: 'bold'
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
    loading,
    error,
    currentYear,
    currentMonth,
    setCurrentPeriod,
    calculateMonthlyBudget,
    refreshBudgets
  } = useBudget();

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);
  const [patternRefreshTrigger, setPatternRefreshTrigger] = useState(0);
  const [budgetStage, setBudgetStage] = useState<BudgetStage>(BUDGET_STAGES.INITIAL);

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

  // Handle automated budget creation with smart workflow
  const handleAutoCalculate = async () => {
    try {
      console.log('🚀 BudgetsPage: Starting auto-calculate workflow');
      
      // If we're in the patterns-detected stage, use the reject-remaining-and-proceed endpoint
      if (budgetStage === BUDGET_STAGES.PATTERNS_DETECTED) {
        console.log('🔄 BudgetsPage: User wants to proceed - rejecting remaining patterns and calculating budget');
        
        const proceedResult = await budgetsApi.rejectRemainingPatternsAndProceed(currentYear, currentMonth, 6);
        
        if (proceedResult.success && proceedResult.step === 'budget-calculated') {
          console.log('✅ BudgetsPage: Successfully rejected remaining patterns and calculated budget');
          console.log(`📊 BudgetsPage: Auto-rejected ${proceedResult.autoRejectedPatterns || 0} patterns`);
          
          // Set stage to budget created
          setBudgetStage(BUDGET_STAGES.BUDGET_CREATED);
          
          // Force refresh to see the new budget
          await refreshBudgets();
          return;
        } else {
          console.error('❌ BudgetsPage: Failed to proceed with budget calculation:', proceedResult);
        }
        return;
      }
      
      // Otherwise, try normal smart budget calculation first
      const smartResult = await budgetsApi.smartCalculateMonthlyBudget(currentYear, currentMonth, 6);
      
      console.log('🔍 BudgetsPage: Smart budget result:', smartResult);
      
      if (smartResult.step === 'pattern-approval-required') {
        // User needs to approve existing pending patterns first
        console.log('⏸️ BudgetsPage: Pattern approval required - user should approve patterns first');
        // Force refresh to show any new patterns in the dashboard
        await refreshBudgets();
        return;
      }
      
      if (smartResult.step === 'pattern-detection-complete') {
        // New patterns were detected - show them to user
        console.log('🎯 BudgetsPage: New patterns detected:', smartResult.detectedPatterns?.length || 0);
        console.log('🎯 BudgetsPage: Pattern details:', smartResult.detectedPatterns);
        
        // Set stage to patterns detected
        setBudgetStage(BUDGET_STAGES.PATTERNS_DETECTED);
        
        // Force refresh to show the new patterns in the dashboard
        await refreshBudgets();
        
        // Trigger pattern dashboard refresh
        console.log('🔄 BudgetsPage: Setting refresh trigger from', patternRefreshTrigger, 'to', patternRefreshTrigger + 1);
        setPatternRefreshTrigger(prev => prev + 1);
        return;
      }
      
      if (smartResult.step === 'budget-calculated') {
        // Budget was calculated successfully
        console.log('✅ BudgetsPage: Smart budget calculated with pattern awareness:', smartResult.calculation);
        
        // Set stage to budget created
        setBudgetStage(BUDGET_STAGES.BUDGET_CREATED);
        
        // Force refresh to see the new budget
        await refreshBudgets();
        return;
      }
      
      console.log('❓ BudgetsPage: Unexpected smart result step:', smartResult.step);
      
    } catch (error) {
      console.error('❌ BudgetsPage: Smart budget calculation failed:', error);
      
      // Fallback to regular calculation if smart calculation fails
      try {
        console.log('🔄 BudgetsPage: Falling back to regular budget calculation');
        await calculateMonthlyBudget(currentYear, currentMonth, 6);
        await refreshBudgets();
      } catch (fallbackError) {
        console.error('❌ BudgetsPage: Failed to auto-calculate budget:', fallbackError);
      }
    }
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
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

  // Show different content based on budget stage
  // Handle API response format {success: true, data: null}
  const hasBudget = currentMonthlyBudget && (currentMonthlyBudget._id || (currentMonthlyBudget as any).data);
  if (!hasBudget) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" component="h1">
            Budget Management
          </Typography>
          {budgetStage === BUDGET_STAGES.PATTERNS_DETECTED && (
            <Button
              variant="contained"
              size="large"
              startIcon={<CalculatorIcon />}
              onClick={handleAutoCalculate}
              disabled={loading}
              sx={{ py: 1.5, px: 4 }}
            >
              Create Smart Budget
            </Button>
          )}
        </Box>


        {/* Stage 1: Initial - Show only Auto-Calculate button */}
        {budgetStage === BUDGET_STAGES.INITIAL && (
          <Card>
            <CardContent>
              <Box textAlign="center" py={8}>
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
            </CardContent>
          </Card>
        )}

        {/* Stage 2: Patterns Detected - Show pattern approval dashboard */}
        {budgetStage === BUDGET_STAGES.PATTERNS_DETECTED && (
          <>
            {/* Guidance text above patterns */}
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Box textAlign="center" py={4}>
                  <Typography variant="h6" color="primary" mb={2}>
                    Patterns Detected!
                  </Typography>
                  <Typography variant="body1" color="text.secondary" mb={2}>
                    Review and approve the spending patterns below, or click "Create Smart Budget" to proceed.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Any unapproved patterns will be automatically rejected when you create the budget.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            
            {/* Pattern Dashboard */}
            <PatternDetectionDashboard sx={{ mb: 4 }} refreshTrigger={patternRefreshTrigger} />
          </>
        )}
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
              onClick={handleMenuOpen}
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
                  year={currentYear}
                  month={currentMonth}
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
                    year={currentYear}
                    month={currentMonth}
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
                          year={currentYear}
                          month={currentMonth}
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
