import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography
} from '@mui/material';
import BudgetSummaryCard from './BudgetSummaryCard';
import BudgetCategoryItem from './BudgetCategoryItem';
import type { MonthlyBudget } from '../../services/api/budgets';

interface BudgetColumnProps {
  title: string;
  color: 'success' | 'error';
  totalBudgeted: number;
  totalActual: number;
  currentMonthlyBudget: MonthlyBudget | null;
  currentYear: number;
  currentMonth: number;
  type: 'income' | 'expense';
}

const BudgetColumn: React.FC<BudgetColumnProps> = ({
  title,
  color,
  totalBudgeted,
  totalActual,
  currentMonthlyBudget,
  currentYear,
  currentMonth,
  type
}) => {
  const renderIncomeCategories = () => {
    if (!currentMonthlyBudget) return null;

    return (
      <>
        {/* Salary */}
        <BudgetCategoryItem
          category="Salary"
          subcategories={[]}
          totalBudgeted={currentMonthlyBudget.salaryBudget || 0}
          totalActual={0} // TODO: Get actual salary from transactions
          color="success"
          year={currentYear}
          month={currentMonth}
        />

        {/* Other Income Categories */}
        {currentMonthlyBudget.otherIncomeBudgets?.map((income, index) => (
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
        
        {(!currentMonthlyBudget.otherIncomeBudgets || currentMonthlyBudget.otherIncomeBudgets.length === 0) && (
          <Box p={2} textAlign="center" color="text.secondary">
            <Typography variant="body2">
              No additional income sources
            </Typography>
          </Box>
        )}
      </>
    );
  };

  const renderExpenseCategories = () => {
    if (!currentMonthlyBudget?.expenseBudgets?.length) {
      return (
        <Box p={2} textAlign="center" color="text.secondary">
          <Typography variant="body2">
            No expense budgets set
          </Typography>
        </Box>
      );
    }

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
  };

  return (
    <Box sx={{ flex: 1 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" color={`${color}.main`} gutterBottom>
            {title}
          </Typography>
          
          {/* Summary Card */}
          <BudgetSummaryCard
            title={title}
            totalBudgeted={totalBudgeted}
            totalActual={totalActual}
            color={color}
          />

          {/* Column Headers */}
          <Box display="flex" justifyContent="space-between" alignItems="center" px={2} py={1} bgcolor="grey.100" borderRadius={1} mb={2}>
            <Typography variant="body2" fontWeight="bold" color="text.secondary">
              Category
            </Typography>
          </Box>

          {/* Categories */}
          <Box>
            {type === 'income' ? renderIncomeCategories() : renderExpenseCategories()}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BudgetColumn;
