import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography
} from '@mui/material';
import BudgetSummaryCard from './BudgetSummaryCard';
import BudgetCategoryItem from './BudgetCategoryItem';
import { categoriesApi, type DefaultCategory } from '../../services/api/categories';
import { sortGroupedCategoriesByDefaultOrder } from '../../utils/categoryOrdering';
import type { MonthlyBudget } from '../../services/api/budgets';

interface UserCategory {
  _id: string;
  name: string;
  type: 'Income' | 'Expense' | 'Transfer';
  subCategories: Array<{
    _id: string;
    name: string;
    keywords: string[];
  }>;
}

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
  const [defaultCategories, setDefaultCategories] = useState<DefaultCategory[]>([]);
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Fetch both default categories (for ordering) and user categories (for actual IDs)
        const [defaultData, userData] = await Promise.all([
          categoriesApi.getDefaultOrder(),
          categoriesApi.getUserCategories()
        ]);
        setDefaultCategories(defaultData.categories);
        setUserCategories(userData);
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Continue with default alphabetical sorting if API fails
      }
    };

    fetchCategories();
  }, []);

  const renderIncomeCategories = () => {
    if (!currentMonthlyBudget) return null;

    // Get income categories and sort them by default order
    const incomeBudgets = currentMonthlyBudget.otherIncomeBudgets || [];
    
    // Group by category name for sorting
    const incomeGrouped = incomeBudgets.reduce((acc, income) => {
      const categoryName = typeof income.categoryId === 'object' 
        ? (income.categoryId as any)?.name || 'Income' 
        : income.categoryId || 'Income';
      
      // Ensure we have a valid category name
      if (categoryName && typeof categoryName === 'string') {
        acc[categoryName] = income;
      }
      return acc;
    }, {} as Record<string, any>);

    // Sort by default order (only if we have categories and defaultCategories loaded)
    const sortedIncomeEntries = defaultCategories.length > 0
      ? sortGroupedCategoriesByDefaultOrder(
          Object.fromEntries(Object.entries(incomeGrouped).map(([name, income]) => [name, [income]])),
          defaultCategories,
          'Income'
        )
      : Object.entries(incomeGrouped).map(([name, income]) => [name, [income]]);

    return (
      <>
        {sortedIncomeEntries.map((entry) => {
          const [categoryName, incomes] = entry as [string, any[]];
          const income = incomes[0];
          return (
            <BudgetCategoryItem
              key={categoryName}
              category={categoryName}
              subcategories={[]}
              totalBudgeted={income.amount}
              totalActual={(income as any).actualAmount || 0}
              color="success"
              year={currentYear}
              month={currentMonth}
              categoryId={typeof income.categoryId === 'object' ? (income.categoryId as any)?._id : income.categoryId}
              isIncomeCategory={true}
            />
          );
        })}
        
        {sortedIncomeEntries.length === 0 && (
          <Box p={2} textAlign="center" color="text.secondary">
            <Typography variant="body2">
              No income sources
            </Typography>
          </Box>
        )}
      </>
    );
  };

  const renderExpenseCategories = () => {
    // Group existing expenses by category
    const existingGroupedExpenses = currentMonthlyBudget?.expenseBudgets?.reduce((acc, expense) => {
      const categoryName = typeof expense.categoryId === 'object' 
        ? (expense.categoryId as any)?.name || 'Uncategorized'
        : expense.categoryId || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(expense);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Get all expense categories from user categories and merge with existing budgets
    const allExpenseCategories: Record<string, any[]> = {};
    
    // Add all user expense categories with real IDs
    userCategories
      .filter(cat => cat.type === 'Expense')
      .forEach(category => {
        allExpenseCategories[category.name] = [];
        
        // For each subcategory in this category, create a budget entry (with 0 if not exists)
        if (category.subCategories && category.subCategories.length > 0) {
          category.subCategories.forEach(subCat => {
            // Check if this subcategory already has a budget
            const existingBudget = existingGroupedExpenses[category.name]?.find(exp => {
              const expSubCatName = typeof exp.subCategoryId === 'object' 
                ? (exp.subCategoryId as any)?.name 
                : exp.subCategoryId;
              return expSubCatName === subCat.name;
            });

            if (existingBudget) {
              // Use existing budget data
              allExpenseCategories[category.name].push(existingBudget);
            } else {
              // Create a placeholder with 0 budget using real IDs
              allExpenseCategories[category.name].push({
                categoryId: { name: category.name, _id: category._id },
                subCategoryId: { name: subCat.name, _id: subCat._id },
                budgetedAmount: 0,
                actualAmount: 0
              });
            }
          });
        }
      });

    // Add any existing categories that aren't in user categories
    Object.entries(existingGroupedExpenses).forEach(([categoryName, expenses]) => {
      if (!allExpenseCategories[categoryName]) {
        allExpenseCategories[categoryName] = expenses;
      }
    });

    // Sort categories by default order (only if we have defaultCategories loaded)
    const sortedExpenseEntries = defaultCategories.length > 0
      ? sortGroupedCategoriesByDefaultOrder(
          allExpenseCategories,
          defaultCategories,
          'Expense'
        )
      : Object.entries(allExpenseCategories);

    return (
      <>
        {sortedExpenseEntries.map((entry) => {
          const [categoryName, expenses] = entry as [string, any[]];
          const totalBudgeted = expenses.reduce((sum, exp) => sum + (exp.budgetedAmount || 0), 0);
          const totalActual = expenses.reduce((sum, exp) => sum + (exp.actualAmount || 0), 0);
          
          // Create subcategories array maintaining the sorted order
          const subcategories = expenses.map(exp => ({
            name: typeof exp.subCategoryId === 'object' 
              ? (exp.subCategoryId as any)?.name || 'General'
              : exp.subCategoryId || 'General',
            budgeted: exp.budgetedAmount || 0,
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
        })}
        
        {sortedExpenseEntries.length === 0 && (
          <Box p={2} textAlign="center" color="text.secondary">
            <Typography variant="body2">
              No expense categories available
            </Typography>
          </Box>
        )}
      </>
    );
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
