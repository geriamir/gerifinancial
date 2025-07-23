import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUrlParams } from '../hooks/useUrlParams';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Alert,
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
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CalendarMonth as CalendarMonthIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrencyDisplay } from '../utils/formatters';
import { getCategoryIconTheme } from '../constants/categoryIconSystem';
import { MONTH_NAMES } from '../constants/dateConstants';
import TransactionsList from '../components/transactions/TransactionsList';
import TransactionDetailDialog from '../components/transactions/TransactionDetailDialog';
import CategoryIconComponent from '../components/common/CategoryIcon';
import BudgetEditor from '../components/budget/BudgetEditor';
import { categoriesApi } from '../services/api/categories';
import { transactionsApi } from '../services/api/transactions';
import type { Transaction } from '../services/api/types/transactions';

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
  const urlParams = useParams<{
    year: string;
    month: string;
    categoryId: string;
    subcategoryId?: string;
  }>();
  
  const location = useLocation();
  const navigate = useNavigate();
  const { getParam } = useUrlParams();
  const { currentMonthlyBudget, loading: budgetLoading, refreshBudgets, setCurrentPeriod } = useBudget();

  // Support both URL formats: legacy path-based and new query-based
  const isNewFormat = location.pathname === '/budgets/detail';
  
  // Get parameters from either URL path or query parameters
  const year = isNewFormat ? getParam('year', new Date().getFullYear().toString()) : urlParams.year;
  const month = isNewFormat ? getParam('month', (new Date().getMonth() + 1).toString()) : urlParams.month;
  const categoryId = isNewFormat ? getParam('category', '') : urlParams.categoryId;
  const subcategoryId = isNewFormat ? getParam('subcategory', '') : urlParams.subcategoryId;
  // urlType could be used for future income category detection in new format
  // const urlType = isNewFormat ? getParam('type', '') : '';
  
  const [subcategoryData, setSubcategoryData] = useState<SubcategoryBudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [subcategoryTabs, setSubcategoryTabs] = useState<SubcategoryTab[]>([]);
  const [monthMenuAnchor, setMonthMenuAnchor] = useState<null | HTMLElement>(null);
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);

  // Convert params to numbers
  const yearNum = parseInt(year || '0');
  const monthNum = parseInt(month || '0');
  
  // Determine if this is an income category view (no subcategoryId) or expense subcategory view
  const isIncomeView = !subcategoryId;

  // Validate parameters
  useEffect(() => {
    if (!year || !month || !categoryId || (!subcategoryId && !isIncomeView)) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      setError('Invalid year or month');
      setLoading(false);
      return;
    }
  }, [year, month, categoryId, subcategoryId, yearNum, monthNum, isIncomeView]);

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

  // Extract category/subcategory data from budget
  useEffect(() => {
    if (!currentMonthlyBudget || !categoryId) {
      return;
    }

    const loadSubcategoryData = async () => {
      try {
        let budgetedAmount = 0;
        let actualAmount = 0;
        let categoryName = '';
        let subcategoryName = '';

        if (isIncomeView) {
          // Handle income category (all income categories treated the same)
          const incomeCategory = currentMonthlyBudget.otherIncomeBudgets?.find(income => {
            const incomeCategoryId = typeof income.categoryId === 'object' 
              ? (income.categoryId as any)?._id 
              : income.categoryId;
            return incomeCategoryId === categoryId;
          });

          if (incomeCategory) {
            categoryName = typeof incomeCategory.categoryId === 'object' 
              ? (incomeCategory.categoryId as any)?.name || 'Unknown Income'
              : incomeCategory.categoryId || 'Unknown Income';
            subcategoryName = 'Income';
            budgetedAmount = incomeCategory.amount || 0;
            // Income budgets don't store actualAmount, need to calculate from transactions
            actualAmount = 0;
          } else {
            // No income budget exists, get category name from API
            try {
              const userCategories = await categoriesApi.getUserCategories();
              const category = userCategories.find(cat => cat._id === categoryId);
              
              if (category) {
                categoryName = category.name;
                subcategoryName = 'Income';
                budgetedAmount = 0;
                actualAmount = 0;
              } else {
                setError('Income category not found');
                setLoading(false);
                return;
              }
            } catch (err) {
              console.error('Error fetching income category data:', err);
              setError('Failed to load income category information');
              setLoading(false);
              return;
            }
          }

          // Always calculate actual amount from transactions for income categories
          try {
            const startDate = new Date(yearNum, monthNum - 1, 1);
            const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
            
            const transactionsResult = await transactionsApi.getTransactions({
              startDate,
              endDate,
              category: categoryId,
              type: 'Income',
              limit: 1000
            });
            
            // Sum all transaction amounts for this income category
            actualAmount = transactionsResult.transactions.reduce((sum, transaction) => {
              return sum + Math.abs(transaction.amount || 0);
            }, 0);
          } catch (transactionError) {
            console.error('Error fetching transactions for income actual amount:', transactionError);
            // Keep actualAmount as 0 if transaction fetching fails
          }
        } else {
          // Handle expense subcategory
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
            // No budget exists yet - fetch category/subcategory names from API and create default structure
            try {
              const userCategories = await categoriesApi.getUserCategories();
              const category = userCategories.find(cat => cat._id === categoryId);
              const subcategory = category?.subCategories?.find(sub => sub._id === subcategoryId);
              
              if (category && subcategory) {
                categoryName = category.name;
                subcategoryName = subcategory.name;
                budgetedAmount = 0;
                
                // Calculate actual amount from transactions for this month
                try {
                  const startDate = new Date(yearNum, monthNum - 1, 1);
                  const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
                  
                  const transactionsResult = await transactionsApi.getTransactions({
                    startDate,
                    endDate,
                    category: categoryId,
                    type: 'Expense',
                    limit: 1000 // Get all transactions for the month
                  });
                  
                  // Filter transactions by subcategory on the client side
                  const filteredTransactions = transactionsResult.transactions.filter(transaction => {
                    const transactionSubCategoryId = typeof transaction.subCategory === 'object'
                      ? (transaction.subCategory as any)?._id
                      : transaction.subCategory;
                    return transactionSubCategoryId === subcategoryId;
                  });
                  
                  // Sum up filtered transaction amounts
                  actualAmount = filteredTransactions.reduce((sum, transaction) => {
                    return sum + Math.abs(transaction.amount || 0);
                  }, 0);
                } catch (transactionError) {
                  console.error('Error fetching transactions for actual amount:', transactionError);
                  actualAmount = 0;
                }
              } else {
                setError('Category or subcategory not found');
                setLoading(false);
                return;
              }
            } catch (err) {
              console.error('Error fetching category data:', err);
              setError('Failed to load category information');
              setLoading(false);
              return;
            }
          } else {
            // Existing budget found
            categoryName = typeof expenseBudget.categoryId === 'object' 
              ? (expenseBudget.categoryId as any)?.name || 'Unknown Category'
              : expenseBudget.categoryId || 'Unknown Category';
            
            subcategoryName = typeof expenseBudget.subCategoryId === 'object'
              ? (expenseBudget.subCategoryId as any)?.name || 'Unknown Subcategory'
              : expenseBudget.subCategoryId || 'Unknown Subcategory';

            budgetedAmount = expenseBudget.budgetedAmount || 0;
            actualAmount = expenseBudget.actualAmount || 0;
          }
        }

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
        console.error('Error extracting category data:', err);
        setError('Failed to load category data');
        setLoading(false);
      }
    };

    loadSubcategoryData();
  }, [currentMonthlyBudget, categoryId, subcategoryId, isIncomeView, monthNum, yearNum]);

  // Extract subcategory tabs for the same category (or all income categories for income view)
  useEffect(() => {
    if (!categoryId) {
      return;
    }

    const loadSubcategoryTabs = async () => {
      try {
        if (isIncomeView) {
          // For income categories, show all income categories as tabs
          const [defaultCategories, userCategories] = await Promise.all([
            categoriesApi.getDefaultOrder(),
            categoriesApi.getUserCategories()
          ]);

          // Get all income categories from user categories
          const incomeCategories = userCategories.filter(cat => cat.type === 'Income');
          
          // Get default income categories for ordering
          const defaultIncomeCategories = defaultCategories.categories.filter(cat => cat.type === 'Income');
          
          // Order income categories by default ordering
          let orderedIncomeCategories = incomeCategories;
          if (defaultIncomeCategories.length > 0) {
            orderedIncomeCategories = [];
            
            // First add categories in default order
            defaultIncomeCategories.forEach(defaultCat => {
              const matchingUserCat = incomeCategories.find(userCat => 
                userCat.name === defaultCat.name
              );
              if (matchingUserCat) {
                orderedIncomeCategories.push(matchingUserCat);
              }
            });
            
            // Then add any remaining user categories that don't have default ordering
            incomeCategories.forEach(userCat => {
              if (!orderedIncomeCategories.find(ordered => ordered._id === userCat._id)) {
                orderedIncomeCategories.push(userCat);
              }
            });
          }

          // Create tabs for all income categories
          const tabs: SubcategoryTab[] = await Promise.all(
            orderedIncomeCategories.map(async (incomeCat) => {
              // Try to find existing budget data for this income category
              const existingBudget = currentMonthlyBudget?.otherIncomeBudgets?.find(income => {
                const incomeCategoryId = typeof income.categoryId === 'object'
                  ? (income.categoryId as any)?._id
                  : income.categoryId;
                return incomeCategoryId === incomeCat._id;
              });

              let actualAmount = 0; // Income budgets don't store actualAmount, need to calculate
              const budgetedAmount = existingBudget?.amount || 0;

              // If no existing budget, calculate actual amount from transactions
              if (!existingBudget) {
                try {
                  const startDate = new Date(yearNum, monthNum - 1, 1);
                  const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
                  
                  const transactionsResult = await transactionsApi.getTransactions({
                    startDate,
                    endDate,
                    category: incomeCat._id,
                    type: 'Income',
                    limit: 1000
                  });
                  
                  // Sum all transaction amounts for this income category
                  actualAmount = transactionsResult.transactions.reduce((sum, transaction) => {
                    return sum + Math.abs(transaction.amount || 0);
                  }, 0);
                } catch (transactionError) {
                  console.error(`Error fetching transactions for income category ${incomeCat.name}:`, transactionError);
                  actualAmount = 0;
                }
              }

              return {
                id: incomeCat._id,
                name: incomeCat.name,
                actualAmount,
                budgetedAmount
              };
            })
          );

          setSubcategoryTabs(tabs);
        } else {
          // For expense categories, show subcategories as before
          const [defaultCategories, userCategories] = await Promise.all([
            categoriesApi.getDefaultOrder(),
            categoriesApi.getUserCategories()
          ]);

          const userCategory = userCategories.find(cat => cat._id === categoryId);
          
          if (!userCategory || !userCategory.subCategories) {
            setSubcategoryTabs([]);
            return;
          }

          // Find the default category to get the correct subcategory ordering
          const defaultCategory = defaultCategories.categories.find(cat => 
            cat.name === userCategory.name && cat.type === 'Expense'
          );

          let orderedSubcategories = userCategory.subCategories;

          // Apply default ordering if available
          if (defaultCategory && defaultCategory.subCategories) {
            orderedSubcategories = [];
            
            // First add subcategories in default order
            defaultCategory.subCategories.forEach(defaultSub => {
              const matchingUserSub = userCategory.subCategories.find(userSub => 
                userSub.name === defaultSub.name
              );
              if (matchingUserSub) {
                orderedSubcategories.push(matchingUserSub);
              }
            });
            
            // Then add any remaining user subcategories that don't have default ordering
            userCategory.subCategories.forEach(userSub => {
              if (!orderedSubcategories.find(ordered => ordered._id === userSub._id)) {
                orderedSubcategories.push(userSub);
              }
            });
          }

          // Create tabs for all subcategories, merging with existing budget data
          const tabs: SubcategoryTab[] = await Promise.all(
            orderedSubcategories.map(async (subCat) => {
              // Try to find existing budget data for this subcategory
              const existingBudget = currentMonthlyBudget?.expenseBudgets?.find(expense => {
                const expenseSubCategoryId = typeof expense.subCategoryId === 'object'
                  ? (expense.subCategoryId as any)?._id
                  : expense.subCategoryId;
                return expenseSubCategoryId === subCat._id;
              });

              let actualAmount = existingBudget?.actualAmount || 0;
              const budgetedAmount = existingBudget?.budgetedAmount || 0;

              // If no existing budget, calculate actual amount from transactions
              if (!existingBudget) {
                try {
                  const startDate = new Date(yearNum, monthNum - 1, 1);
                  const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
                  
                  const transactionsResult = await transactionsApi.getTransactions({
                    startDate,
                    endDate,
                    category: categoryId,
                    type: 'Expense',
                    limit: 1000
                  });
                  
                  // Filter transactions by this specific subcategory
                  const filteredTransactions = transactionsResult.transactions.filter(transaction => {
                    const transactionSubCategoryId = typeof transaction.subCategory === 'object'
                      ? (transaction.subCategory as any)?._id
                      : transaction.subCategory;
                    return transactionSubCategoryId === subCat._id;
                  });
                  
                  // Sum filtered transaction amounts
                  actualAmount = filteredTransactions.reduce((sum, transaction) => {
                    return sum + Math.abs(transaction.amount || 0);
                  }, 0);
                } catch (transactionError) {
                  console.error(`Error fetching transactions for subcategory ${subCat.name}:`, transactionError);
                  actualAmount = 0;
                }
              }

              return {
                id: subCat._id,
                name: subCat.name,
                actualAmount,
                budgetedAmount
              };
            })
          );

          setSubcategoryTabs(tabs);
        }
      } catch (err) {
        console.error('Error loading subcategory tabs:', err);
        setSubcategoryTabs([]);
      }
    };

    loadSubcategoryTabs();
  }, [currentMonthlyBudget, categoryId, yearNum, monthNum, isIncomeView]);

  // Transaction filters for this category/subcategory
  const transactionFilters = React.useMemo(() => {
    const startDate = new Date(yearNum, monthNum - 1, 1);
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59);
    
    return {
      startDate,
      endDate,
      category: categoryId,
      subCategory: isIncomeView ? undefined : subcategoryId,
      type: isIncomeView ? 'Income' : 'Expense',
      useProcessedDate: true // Use processedDate for budget views to match budget calculations
    };
  }, [yearNum, monthNum, categoryId, subcategoryId, isIncomeView]);

  // Navigation handlers
  const handleBack = () => {
    navigate('/budgets');
  };

  const handleSubcategoryChange = (newSubcategoryId: string) => {
    if (isNewFormat) {
      // Use new query-based format
      if (isIncomeView) {
        // For income categories, navigate to another income category
        navigate(`/budgets/detail?year=${year}&month=${month}&category=${newSubcategoryId}&type=income`);
      } else {
        // For expense categories, navigate to another subcategory within the same category
        navigate(`/budgets/detail?year=${year}&month=${month}&category=${categoryId}&subcategory=${newSubcategoryId}`);
      }
    } else {
      // Use legacy path-based format for backward compatibility
      if (isIncomeView) {
        navigate(`/budgets/income/${year}/${month}/${newSubcategoryId}`);
      } else {
        navigate(`/budgets/subcategory/${year}/${month}/${categoryId}/${newSubcategoryId}`);
      }
    }
  };

  const handleMonthChange = (newYear: number, newMonth: number) => {
    if (isNewFormat) {
      // Use new query-based format
      if (isIncomeView) {
        navigate(`/budgets/detail?year=${newYear}&month=${newMonth}&category=${categoryId}&type=income`);
      } else {
        navigate(`/budgets/detail?year=${newYear}&month=${newMonth}&category=${categoryId}&subcategory=${subcategoryId}`);
      }
    } else {
      // Use legacy path-based format for backward compatibility
      if (isIncomeView) {
        navigate(`/budgets/income/${newYear}/${newMonth}/${categoryId}`);
      } else {
        navigate(`/budgets/subcategory/${newYear}/${newMonth}/${categoryId}/${subcategoryId}`);
      }
    }
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

  // Budget editor handlers
  const handleEditBudget = () => {
    setBudgetEditorOpen(true);
  };

  const handleBudgetEditorClose = () => {
    setBudgetEditorOpen(false);
  };

  const handleBudgetUpdated = async () => {
    try {
      await refreshBudgets();
      setRefreshTrigger(prev => prev + 1);
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
              value={isIncomeView ? categoryId : subcategoryId}
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
            {/* Remaining/Overspent/Exceeded Amount */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {isIncomeView 
                  ? (subcategoryData.actualAmount >= subcategoryData.budgetedAmount ? 'Exceeded Budget' : 'Below Budget')
                  : (subcategoryData.budgetedAmount - subcategoryData.actualAmount >= 0 ? 'Remaining' : 'Overspent')
                }
              </Typography>
              <Typography 
                variant="h4" 
                color={isIncomeView
                  ? (subcategoryData.actualAmount >= subcategoryData.budgetedAmount ? 'success.main' : 'warning.main')
                  : (subcategoryData.budgetedAmount - subcategoryData.actualAmount >= 0 ? 'success.main' : 'error.main')
                }
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
                  backgroundColor: isIncomeView
                    ? (subcategoryData.progressPercentage > 100 ? 'success.main' : (categoryTheme?.primary || 'primary.main'))
                    : (subcategoryData.progressPercentage > 100 ? 'error.main' : (categoryTheme?.primary || 'primary.main')),
                  borderRadius: 6
                }
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {formatCurrencyDisplay(subcategoryData.actualAmount)} / {formatCurrencyDisplay(subcategoryData.budgetedAmount)}
              </Typography>
              
              {/* Edit Budget Button */}
              <Button
                startIcon={<EditIcon />}
                onClick={handleEditBudget}
                size="small"
                variant="outlined"
                sx={{ ml: 2 }}
              >
                Edit Budget
              </Button>
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

      {/* Budget Editor Dialog */}
      {subcategoryData && (
        <BudgetEditor
          open={budgetEditorOpen}
          onClose={handleBudgetEditorClose}
          categoryId={categoryId || ''}
          subCategoryId={subcategoryId}
          categoryName={subcategoryData.category}
          subcategoryName={isIncomeView ? undefined : subcategoryData.subcategory}
          onBudgetUpdated={handleBudgetUpdated}
        />
      )}
    </Container>
  );
};

export default BudgetSubcategoryDetail;
