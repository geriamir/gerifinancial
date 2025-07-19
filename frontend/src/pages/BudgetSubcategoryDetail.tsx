import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Alert,
  Chip,
  Skeleton,
  Divider,
  Tabs,
  Tab,
  IconButton,
  Menu,
  MenuItem,
  ListItemText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  TrendingUp as TrendingUpIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CalendarMonth as CalendarMonthIcon
} from '@mui/icons-material';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrencyDisplay } from '../utils/formatters';
import { getCategoryIconTheme } from '../constants/categoryIconSystem';
import TransactionsList from '../components/transactions/TransactionsList';
import TransactionDetailDialog from '../components/transactions/TransactionDetailDialog';
import CategoryIconComponent from '../components/common/CategoryIcon';
import type { Transaction } from '../services/api/types/transactions';

// Month names for display
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface SubcategoryBudgetData {
  category: string;
  subcategory: string;
  budgetedAmount: number;
  actualAmount: number;
  transactionCount: number;
  progressPercentage: number;
}

interface SubcategoryTab {
  id: string;
  name: string;
  actualAmount: number;
  budgetedAmount: number;
}

const BudgetSubcategoryDetail: React.FC = () => {
  const { year, month, categoryId, subcategoryId } = useParams<{
    year: string;
    month: string;
    categoryId: string;
    subcategoryId: string;
  }>();
  
  const navigate = useNavigate();
  const { currentMonthlyBudget, loading: budgetLoading, refreshBudgets, setCurrentPeriod } = useBudget();
  
  const [subcategoryData, setSubcategoryData] = useState<SubcategoryBudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [subcategoryTabs, setSubcategoryTabs] = useState<SubcategoryTab[]>([]);
  const [monthMenuAnchor, setMonthMenuAnchor] = useState<null | HTMLElement>(null);

  // Convert params to numbers
  const yearNum = parseInt(year || '0');
  const monthNum = parseInt(month || '0');

  // Validate parameters
  useEffect(() => {
    if (!year || !month || !categoryId || !subcategoryId) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      setError('Invalid year or month');
      setLoading(false);
      return;
    }
  }, [year, month, categoryId, subcategoryId, yearNum, monthNum]);

  // Sync budget context with URL parameters
  useEffect(() => {
    if (yearNum && monthNum) {
      setCurrentPeriod(yearNum, monthNum);
    }
  }, [yearNum, monthNum, setCurrentPeriod]);

  // Trigger transaction list refresh when subcategory changes
  useEffect(() => {
    if (subcategoryId) {
      setRefreshTrigger(prev => prev + 1);
    }
  }, [subcategoryId]);

  // Extract subcategory data from budget
  useEffect(() => {
    if (!currentMonthlyBudget || !categoryId || !subcategoryId) {
      return;
    }

    try {
      // Find the expense budget for this category/subcategory
      const expenseBudget = currentMonthlyBudget.expenseBudgets?.find(expense => {
        const expenseCategoryId = typeof expense.categoryId === 'object' 
          ? (expense.categoryId as any)?._id 
          : expense.categoryId;
        const expenseSubCategoryId = typeof expense.subCategoryId === 'object'
          ? (expense.subCategoryId as any)?._id
          : expense.subCategoryId;
        
        return expenseCategoryId === categoryId && expenseSubCategoryId === subcategoryId;
      });

      if (!expenseBudget) {
        setError('Budget not found for this category/subcategory');
        setLoading(false);
        return;
      }

      // Extract category and subcategory names
      const categoryName = typeof expenseBudget.categoryId === 'object' 
        ? (expenseBudget.categoryId as any)?.name || 'Unknown Category'
        : expenseBudget.categoryId || 'Unknown Category';
      
      const subcategoryName = typeof expenseBudget.subCategoryId === 'object'
        ? (expenseBudget.subCategoryId as any)?.name || 'Unknown Subcategory'
        : expenseBudget.subCategoryId || 'Unknown Subcategory';

      const budgetedAmount = expenseBudget.budgetedAmount || 0;
      const actualAmount = expenseBudget.actualAmount || 0;
      const progressPercentage = budgetedAmount > 0 ? (actualAmount / budgetedAmount) * 100 : 0;

      setSubcategoryData({
        category: categoryName,
        subcategory: subcategoryName,
        budgetedAmount,
        actualAmount,
        transactionCount: 0, // Will be updated when transactions load
        progressPercentage
      });

      setLoading(false);
    } catch (err) {
      console.error('Error extracting subcategory data:', err);
      setError('Failed to load subcategory data');
      setLoading(false);
    }
  }, [currentMonthlyBudget, categoryId, subcategoryId]);

  // Extract subcategory tabs for the same category
  useEffect(() => {
    if (!currentMonthlyBudget || !categoryId) {
      return;
    }

    try {
      // Find all subcategories for this category
      const categorySubcategories = currentMonthlyBudget.expenseBudgets?.filter(expense => {
        const expenseCategoryId = typeof expense.categoryId === 'object' 
          ? (expense.categoryId as any)?._id 
          : expense.categoryId;
        return expenseCategoryId === categoryId;
      }) || [];

      const tabs: SubcategoryTab[] = categorySubcategories.map(expense => {
        const subCategoryId = typeof expense.subCategoryId === 'object'
          ? (expense.subCategoryId as any)?._id
          : expense.subCategoryId;
        const subCategoryName = typeof expense.subCategoryId === 'object'
          ? (expense.subCategoryId as any)?.name || 'Unknown'
          : expense.subCategoryId || 'Unknown';

        return {
          id: subCategoryId,
          name: subCategoryName,
          actualAmount: expense.actualAmount || 0,
          budgetedAmount: expense.budgetedAmount || 0
        };
      });

      setSubcategoryTabs(tabs);
    } catch (err) {
      console.error('Error extracting subcategory tabs:', err);
    }
  }, [currentMonthlyBudget, categoryId]);

  // Calculate date range for the month
  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);

  // Transaction filters for this subcategory
  const transactionFilters = React.useMemo(() => ({
    startDate,
    endDate,
    category: categoryId,
    subCategory: subcategoryId,
    type: 'Expense',
    useProcessedDate: true // Use processedDate for budget views to match budget calculations
  }), [startDate, endDate, categoryId, subcategoryId]);

  // Navigation handlers
  const handleBack = () => {
    navigate('/budgets');
  };

  const handleSubcategoryChange = (newSubcategoryId: string) => {
    navigate(`/budgets/subcategory/${year}/${month}/${categoryId}/${newSubcategoryId}`);
  };

  const handleMonthChange = (newYear: number, newMonth: number) => {
    navigate(`/budgets/subcategory/${newYear}/${newMonth}/${categoryId}/${subcategoryId}`);
    setMonthMenuAnchor(null);
  };

  const handleMonthMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMonthMenuAnchor(event.currentTarget);
  };

  const handleMonthMenuClose = () => {
    setMonthMenuAnchor(null);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentDate = new Date(yearNum, monthNum - 1);
    const newDate = new Date(currentDate);
    
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    
    handleMonthChange(newDate.getFullYear(), newDate.getMonth() + 1);
  };

  // Generate month options for the menu
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    // Show 6 months before and after current month
    for (let i = -6; i <= 6; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i);
      options.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        label: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`,
        isCurrent: date.getFullYear() === yearNum && date.getMonth() + 1 === monthNum
      });
    }
    
    return options;
  };

  // Transaction dialog handlers
  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailDialogOpen(true);
  };

  const handleDetailDialogClose = () => {
    setDetailDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleTransactionUpdated = async (updatedTransaction: Transaction) => {
    // Update the selected transaction
    setSelectedTransaction(updatedTransaction);
    // Trigger a refresh of the transaction list
    setRefreshTrigger(prev => prev + 1);
    // Refresh budget data to update the summary
    try {
      await refreshBudgets();
    } catch (error) {
      console.error('Error refreshing budget data:', error);
    }
  };

  // Get category theme for styling
  const categoryTheme = subcategoryData ? getCategoryIconTheme(subcategoryData.category) : null;

  if (loading || budgetLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" width={400} height={40} />
          <Skeleton variant="text" width={200} height={20} />
        </Box>
        <Card>
          <CardContent>
            <Skeleton variant="rectangular" height={200} />
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          variant="outlined"
        >
          Back to Budgets
        </Button>
      </Container>
    );
  }

  if (!subcategoryData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          No data available for this subcategory
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          variant="outlined"
        >
          Back to Budgets
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* New Header Design */}
      <Box sx={{ mb: 3 }}>
        {/* Top Row - Back Button and Month Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            variant="outlined"
            size="small"
          >
            Back to Budgets
          </Button>

          {/* Month Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => navigateMonth('prev')}
              size="small"
              sx={{ 
                border: 1, 
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
            
            <Button
              onClick={handleMonthMenuOpen}
              endIcon={<CalendarMonthIcon />}
              variant="outlined"
              sx={{ 
                minWidth: 160,
                justifyContent: 'space-between'
              }}
            >
              {MONTH_NAMES[monthNum - 1]} {yearNum}
            </Button>
            
            <IconButton
              onClick={() => navigateMonth('next')}
              size="small"
              sx={{ 
                border: 1, 
                borderColor: 'divider',
                borderRadius: 1
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Category Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <CategoryIconComponent
            categoryName={subcategoryData.category}
            size="large"
            variant="plain"
            showTooltip={false}
          />
          <Typography variant="h4" component="h1">
            {subcategoryData.category}
          </Typography>
        </Box>

        {/* Subcategory Tabs */}
        {subcategoryTabs.length > 1 && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={subcategoryId}
              onChange={(_, newValue) => handleSubcategoryChange(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 60,
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: 2
                }
              }}
            >
              {subcategoryTabs.map((tab) => (
                <Tab
                  key={tab.id}
                  value={tab.id}
                  label={
                    <Box>
                      <Typography variant="subtitle1" component="div">
                        {tab.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatCurrencyDisplay(tab.actualAmount)} / {formatCurrencyDisplay(tab.budgetedAmount)}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Tabs>
          </Box>
        )}

        {/* Single subcategory title if no tabs */}
        {subcategoryTabs.length <= 1 && (
          <Typography variant="h5" color="text.secondary" sx={{ mt: 1 }}>
            {subcategoryData.subcategory}
          </Typography>
        )}
      </Box>

      {/* Month Selection Menu */}
      <Menu
        anchorEl={monthMenuAnchor}
        open={Boolean(monthMenuAnchor)}
        onClose={handleMonthMenuClose}
        PaperProps={{
          sx: { maxHeight: 400 }
        }}
      >
        {generateMonthOptions().map((option) => (
          <MenuItem
            key={`${option.year}-${option.month}`}
            onClick={() => handleMonthChange(option.year, option.month)}
            selected={option.isCurrent}
          >
            <ListItemText
              primary={option.label}
              secondary={option.isCurrent ? 'Current' : undefined}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Summary Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            {/* Remaining/Overspent Amount */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {subcategoryData.budgetedAmount - subcategoryData.actualAmount >= 0 ? 'Remaining' : 'Overspent'}
              </Typography>
              <Typography 
                variant="h4" 
                color={subcategoryData.budgetedAmount - subcategoryData.actualAmount >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrencyDisplay(Math.abs(subcategoryData.budgetedAmount - subcategoryData.actualAmount))}
              </Typography>
            </Box>
          </Box>

          {/* Progress Bar */}
          <Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(subcategoryData.progressPercentage, 100)}
              sx={{ 
                height: 12, 
                borderRadius: 6,
                backgroundColor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: subcategoryData.progressPercentage > 100 ? 'error.main' : (categoryTheme?.primary || 'primary.main'),
                  borderRadius: 6
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {formatCurrencyDisplay(subcategoryData.actualAmount)} / {formatCurrencyDisplay(subcategoryData.budgetedAmount)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Transactions Section */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Transactions</Typography>
            <Typography variant="body2" color="text.secondary">
              {MONTH_NAMES[monthNum - 1]} {yearNum}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Transactions List */}
          <TransactionsList
            filters={transactionFilters}
            refreshTrigger={refreshTrigger}
            onRowClick={handleTransactionClick}
          />
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <TransactionDetailDialog
        open={detailDialogOpen}
        transaction={selectedTransaction}
        onClose={handleDetailDialogClose}
        onTransactionUpdated={handleTransactionUpdated}
      />
    </Container>
  );
};

export default BudgetSubcategoryDetail;
