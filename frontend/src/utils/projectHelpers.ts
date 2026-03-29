import { ProjectBudget, CategoryBudget } from '../types/projects';

/**
 * Helper functions for project operations
 */

/**
 * Update a planned expense in the project's category budgets
 */
export const updatePlannedExpense = (
  project: ProjectBudget,
  index: number,
  updates: Record<string, any>
): CategoryBudget[] => {
  const categoryBreakdownItem = (project.categoryBreakdown || [])[index];
  if (!categoryBreakdownItem) {
    return project.categoryBudgets || [];
  }

  const newBudgetedAmount = updates.budgetedAmount ?? updates.budgeted ?? categoryBreakdownItem.budgeted;
  const newCategoryId = (typeof updates.categoryId === 'string') ? updates.categoryId : categoryBreakdownItem.categoryId._id;
  const newSubCategoryId = (typeof updates.subCategoryId === 'string') ? updates.subCategoryId : categoryBreakdownItem.subCategoryId._id;

  const updatedBudgetItem: CategoryBudget = {
    categoryId: newCategoryId,
    subCategoryId: newSubCategoryId,
    budgetedAmount: newBudgetedAmount,
    actualAmount: categoryBreakdownItem.actual,
    description: updates.description ?? categoryBreakdownItem.description ?? '',
    currency: updates.currency || categoryBreakdownItem.currency
  };
  
  // Find the corresponding index in categoryBudgets array
  const categoryBudgets = [...(project.categoryBudgets || [])];
  const budgetIndex = categoryBudgets.findIndex(budget => 
    budget.categoryId === categoryBreakdownItem.categoryId._id &&
    budget.subCategoryId === categoryBreakdownItem.subCategoryId._id
  );
  
  if (budgetIndex >= 0) {
    categoryBudgets[budgetIndex] = { ...categoryBudgets[budgetIndex], ...updatedBudgetItem };
  } else {
    categoryBudgets.push(updatedBudgetItem);
  }
  
  return categoryBudgets;
};

/**
 * Delete a planned expense from the project's category budgets
 */
export const deletePlannedExpense = (
  project: ProjectBudget,
  index: number
): CategoryBudget[] => {
  const categoryBreakdownItem = (project.categoryBreakdown || [])[index];
  if (!categoryBreakdownItem) {
    return project.categoryBudgets || [];
  }

  return (project.categoryBudgets || []).filter(budget => !(
    budget.categoryId === categoryBreakdownItem.categoryId._id &&
    budget.subCategoryId === categoryBreakdownItem.subCategoryId._id
  ));
};

/**
 * Add a new planned expense to the project's category budgets
 */
export const addPlannedExpense = (
  project: ProjectBudget,
  newBudget: Partial<CategoryBudget>
): CategoryBudget[] => {
  const defaultBudget: CategoryBudget = {
    categoryId: '',
    subCategoryId: '',
    budgetedAmount: 0,
    actualAmount: 0,
    description: 'New Expense Item',
    currency: project.currency,
    ...newBudget
  };
  
  return [...(project.categoryBudgets || []), defaultBudget];
};
