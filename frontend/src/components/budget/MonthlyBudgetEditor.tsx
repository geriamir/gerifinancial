import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Grid,
  Divider,
  Alert,
  Chip,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Calculate as CalculatorIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { MonthlyBudget, CreateMonthlyBudgetData } from '../../services/api/budgets';
import { formatCurrency } from '../../utils/formatters';
import { useBudget } from '../../contexts/BudgetContext';

interface MonthlyBudgetEditorProps {
  open: boolean;
  budget: MonthlyBudget | null;
  year: number;
  month: number;
  onClose: () => void;
  onSave: (budget: MonthlyBudget) => void;
}

// Month names for display
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Mock categories - in real app, these would come from API
const EXPENSE_CATEGORIES = [
  { id: '1', name: 'Food & Dining', subCategories: [
    { id: '1a', name: 'Groceries' },
    { id: '1b', name: 'Restaurants' },
    { id: '1c', name: 'Coffee & Cafes' }
  ]},
  { id: '2', name: 'Transportation', subCategories: [
    { id: '2a', name: 'Gas & Fuel' },
    { id: '2b', name: 'Public Transportation' },
    { id: '2c', name: 'Parking' }
  ]},
  { id: '3', name: 'Shopping', subCategories: [
    { id: '3a', name: 'Clothing' },
    { id: '3b', name: 'Electronics' },
    { id: '3c', name: 'Home & Garden' }
  ]},
  { id: '4', name: 'Bills & Utilities', subCategories: [
    { id: '4a', name: 'Electric Bill' },
    { id: '4b', name: 'Water Bill' },
    { id: '4c', name: 'Internet & Phone' }
  ]},
  { id: '5', name: 'Entertainment', subCategories: [
    { id: '5a', name: 'Movies & Shows' },
    { id: '5b', name: 'Sports & Recreation' },
    { id: '5c', name: 'Subscriptions' }
  ]}
];

const INCOME_CATEGORIES = [
  { id: 'salary', name: 'Salary' },
  { id: 'bonus', name: 'Bonus' },
  { id: 'freelance', name: 'Freelance' },
  { id: 'investment', name: 'Investment Income' },
  { id: 'other', name: 'Other Income' }
];

const MonthlyBudgetEditor: React.FC<MonthlyBudgetEditorProps> = ({
  open,
  budget,
  year,
  month,
  onClose,
  onSave
}) => {
  const { updateMonthlyBudget, calculateMonthlyBudget, loading } = useBudget();
  
  const [activeStep, setActiveStep] = useState(0);
  const [budgetData, setBudgetData] = useState<{
    salaryBudget: number;
    otherIncomeBudgets: Array<{ categoryId: string; amount: number; }>;
    expenseBudgets: Array<{ categoryId: string; subCategoryId: string; budgetedAmount: number; }>;
    notes: string;
    status: 'draft' | 'active' | 'completed';
  }>({
    salaryBudget: 0,
    otherIncomeBudgets: [],
    expenseBudgets: [],
    notes: '',
    status: 'draft'
  });

  const [error, setError] = useState<string | null>(null);
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);

  // Initialize budget data when budget prop changes
  useEffect(() => {
    if (budget) {
      setBudgetData({
        salaryBudget: budget.salaryBudget || 0,
        otherIncomeBudgets: budget.otherIncomeBudgets || [],
        expenseBudgets: budget.expenseBudgets || [],
        notes: budget.notes || '',
        status: budget.status || 'draft'
      });
    } else {
      // Reset for new budget
      setBudgetData({
        salaryBudget: 0,
        otherIncomeBudgets: [],
        expenseBudgets: [],
        notes: '',
        status: 'draft'
      });
    }
  }, [budget]);

  const steps = ['Income Setup', 'Expense Budgets', 'Review & Save'];

  // Calculate totals
  const totalIncome = budgetData.salaryBudget + budgetData.otherIncomeBudgets.reduce((sum, income) => sum + income.amount, 0);
  const totalExpenses = budgetData.expenseBudgets.reduce((sum, expense) => sum + expense.budgetedAmount, 0);
  const budgetBalance = totalIncome - totalExpenses;

  // Handle salary budget change
  const handleSalaryChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    setBudgetData(prev => ({ ...prev, salaryBudget: amount }));
  };

  // Handle other income
  const addOtherIncome = () => {
    setBudgetData(prev => ({
      ...prev,
      otherIncomeBudgets: [...prev.otherIncomeBudgets, { categoryId: '', amount: 0 }]
    }));
  };

  const updateOtherIncome = (index: number, field: 'categoryId' | 'amount', value: string | number) => {
    setBudgetData(prev => ({
      ...prev,
      otherIncomeBudgets: prev.otherIncomeBudgets.map((income, i) => 
        i === index ? { ...income, [field]: value } : income
      )
    }));
  };

  const removeOtherIncome = (index: number) => {
    setBudgetData(prev => ({
      ...prev,
      otherIncomeBudgets: prev.otherIncomeBudgets.filter((_, i) => i !== index)
    }));
  };

  // Handle expense budgets
  const addExpenseBudget = (categoryId: string, subCategoryId: string) => {
    // Check if already exists
    const exists = budgetData.expenseBudgets.some(
      expense => expense.categoryId === categoryId && expense.subCategoryId === subCategoryId
    );
    
    if (!exists) {
      setBudgetData(prev => ({
        ...prev,
        expenseBudgets: [...prev.expenseBudgets, { categoryId, subCategoryId, budgetedAmount: 0 }]
      }));
    }
  };

  const updateExpenseBudget = (categoryId: string, subCategoryId: string, amount: number) => {
    setBudgetData(prev => ({
      ...prev,
      expenseBudgets: prev.expenseBudgets.map(expense =>
        expense.categoryId === categoryId && expense.subCategoryId === subCategoryId
          ? { ...expense, budgetedAmount: amount }
          : expense
      )
    }));
  };

  const removeExpenseBudget = (categoryId: string, subCategoryId: string) => {
    setBudgetData(prev => ({
      ...prev,
      expenseBudgets: prev.expenseBudgets.filter(
        expense => !(expense.categoryId === categoryId && expense.subCategoryId === subCategoryId)
      )
    }));
  };

  // Auto-calculate budget from history
  const handleAutoCalculate = async () => {
    try {
      setIsAutoCalculating(true);
      setError(null);
      
      const calculatedBudget = await calculateMonthlyBudget(year, month, 6); // Use 6 months history
      
      setBudgetData({
        salaryBudget: calculatedBudget.salaryBudget || 0,
        otherIncomeBudgets: calculatedBudget.otherIncomeBudgets || [],
        expenseBudgets: calculatedBudget.expenseBudgets || [],
        notes: calculatedBudget.notes || 'Auto-calculated from 6 months of transaction history',
        status: 'draft'
      });
      
    } catch (error: any) {
      setError(error.message || 'Failed to auto-calculate budget');
    } finally {
      setIsAutoCalculating(false);
    }
  };

  // Save budget
  const handleSave = async () => {
    try {
      setError(null);
      
      if (!budget) {
        throw new Error('No budget to update');
      }

      const updatedBudget = await updateMonthlyBudget(budget._id, budgetData);
      onSave(updatedBudget);
      onClose();
      
    } catch (error: any) {
      setError(error.message || 'Failed to save budget');
    }
  };

  // Navigation
  const handleNext = () => {
    setActiveStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  };

  const getCategoryName = (categoryId: string) => {
    const category = EXPENSE_CATEGORIES.find(c => c.id === categoryId);
    return category?.name || categoryId;
  };

  const getSubCategoryName = (categoryId: string, subCategoryId: string) => {
    const category = EXPENSE_CATEGORIES.find(c => c.id === categoryId);
    const subCategory = category?.subCategories.find(sc => sc.id === subCategoryId);
    return subCategory?.name || subCategoryId;
  };

  const renderIncomeStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Set up your income for {MONTH_NAMES[month - 1]} {year}
      </Typography>

      {/* Auto-calculate option */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">
            Want to save time? Auto-calculate from your transaction history.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CalculatorIcon />}
            onClick={handleAutoCalculate}
            disabled={isAutoCalculating}
          >
            {isAutoCalculating ? 'Calculating...' : 'Auto-Calculate'}
          </Button>
        </Box>
      </Alert>

      {/* Salary Budget */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Monthly Salary
          </Typography>
          <TextField
            fullWidth
            type="number"
            value={budgetData.salaryBudget}
            onChange={(e) => handleSalaryChange(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">₪</InputAdornment>,
            }}
            placeholder="Enter your monthly salary"
          />
        </CardContent>
      </Card>

      {/* Other Income */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1">
              Other Income Sources
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={addOtherIncome}
            >
              Add Income
            </Button>
          </Box>

          {budgetData.otherIncomeBudgets.map((income, index) => (
            <Box key={index} display="flex" gap={2} mb={2} alignItems="center">
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Income Type</InputLabel>
                <Select
                  value={income.categoryId}
                  onChange={(e) => updateOtherIncome(index, 'categoryId', e.target.value)}
                  label="Income Type"
                >
                  {INCOME_CATEGORIES.map(category => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                type="number"
                value={income.amount}
                onChange={(e) => updateOtherIncome(index, 'amount', parseFloat(e.target.value) || 0)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₪</InputAdornment>,
                }}
                placeholder="Amount"
                sx={{ minWidth: 150 }}
              />
              
              <IconButton
                color="error"
                onClick={() => removeOtherIncome(index)}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          {budgetData.otherIncomeBudgets.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No additional income sources added
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Income Summary */}
      <Card sx={{ mt: 3, bgcolor: 'success.50' }}>
        <CardContent>
          <Typography variant="subtitle1" color="success.dark">
            Total Monthly Income: {formatCurrency(totalIncome)}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  const renderExpenseStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Set up your expense budgets
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Add budget amounts for the categories you want to track. You can always add more later.
      </Typography>

      {EXPENSE_CATEGORIES.map((category) => (
        <Accordion key={category.id}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{category.name}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: 2 
            }}>
              {category.subCategories.map((subCategory) => {
                const existingBudget = budgetData.expenseBudgets.find(
                  expense => expense.categoryId === category.id && expense.subCategoryId === subCategory.id
                );

                return (
                  <Card variant="outlined" key={subCategory.id}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        {subCategory.name}
                      </Typography>
                      
                      {existingBudget ? (
                        <Box display="flex" alignItems="center" gap={1}>
                          <TextField
                            size="small"
                            type="number"
                            value={existingBudget.budgetedAmount}
                            onChange={(e) => updateExpenseBudget(
                              category.id,
                              subCategory.id,
                              parseFloat(e.target.value) || 0
                            )}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">₪</InputAdornment>,
                            }}
                            sx={{ flexGrow: 1 }}
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeExpenseBudget(category.id, subCategory.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => addExpenseBudget(category.id, subCategory.id)}
                          fullWidth
                        >
                          Add Budget
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Expense Summary */}
      <Card sx={{ mt: 3, bgcolor: 'error.50' }}>
        <CardContent>
          <Typography variant="subtitle1" color="error.dark">
            Total Monthly Expenses: {formatCurrency(totalExpenses)}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review your budget
      </Typography>

      {/* Budget Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>Budget Summary</Typography>
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
            gap: 3 
          }}>
            <Box textAlign="center" p={2} bgcolor="success.50" borderRadius={1}>
              <Typography variant="body2" color="text.secondary">Total Income</Typography>
              <Typography variant="h6" color="success.dark">
                {formatCurrency(totalIncome)}
              </Typography>
            </Box>
            
            <Box textAlign="center" p={2} bgcolor="error.50" borderRadius={1}>
              <Typography variant="body2" color="text.secondary">Total Expenses</Typography>
              <Typography variant="h6" color="error.dark">
                {formatCurrency(totalExpenses)}
              </Typography>
            </Box>
            
            <Box textAlign="center" p={2} bgcolor={budgetBalance >= 0 ? 'success.50' : 'warning.50'} borderRadius={1}>
              <Typography variant="body2" color="text.secondary">Balance</Typography>
              <Typography variant="h6" color={budgetBalance >= 0 ? 'success.dark' : 'warning.dark'}>
                {formatCurrency(budgetBalance)}
              </Typography>
            </Box>
          </Box>

          {budgetBalance < 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Your expenses exceed your income by {formatCurrency(Math.abs(budgetBalance))}. 
              Consider adjusting your budget.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Income Details */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>Income Breakdown</Typography>
          
          <Box mb={1}>
            <Typography variant="body2">
              Salary: {formatCurrency(budgetData.salaryBudget)}
            </Typography>
          </Box>
          
          {budgetData.otherIncomeBudgets.map((income, index) => {
            const categoryName = INCOME_CATEGORIES.find(c => c.id === income.categoryId)?.name || income.categoryId;
            return (
              <Box key={index} mb={1}>
                <Typography variant="body2">
                  {categoryName}: {formatCurrency(income.amount)}
                </Typography>
              </Box>
            );
          })}
        </CardContent>
      </Card>

      {/* Expense Details */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>Expense Breakdown</Typography>
          
          {budgetData.expenseBudgets.length > 0 ? (
            budgetData.expenseBudgets.map((expense, index) => (
              <Box key={index} mb={1}>
                <Typography variant="body2">
                  {getCategoryName(expense.categoryId)} - {getSubCategoryName(expense.categoryId, expense.subCategoryId)}: {formatCurrency(expense.budgetedAmount)}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No expense budgets set
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>Notes (Optional)</Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={budgetData.notes}
            onChange={(e) => setBudgetData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Add any notes about this budget..."
          />
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {budget ? 'Edit' : 'Create'} Budget - {MONTH_NAMES[month - 1]} {year}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        {activeStep === 0 && renderIncomeStep()}
        {activeStep === 1 && renderExpenseStep()}
        {activeStep === 2 && renderReviewStep()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        
        {activeStep > 0 && (
          <Button onClick={handleBack}>
            Back
          </Button>
        )}
        
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Budget'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MonthlyBudgetEditor;
