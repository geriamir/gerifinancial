import { ProjectBudget, CategoryBudget } from '../types/projects';

/**
 * Helper functions for project operations
 */

/** Extract plain string ID from a populated Mongoose object or raw string */
const getId = (val: any): string => (typeof val === 'object' && val !== null) ? val._id : val;

/**
 * Update a planned expense in the project's category budgets
 */
export const updatePlannedExpense = (
  project: ProjectBudget,
  index: number,
  updates: Partial<CategoryBudget>
): CategoryBudget[] => {
  const categoryBreakdownItem = (project.categoryBreakdown || [])[index];
  if (!categoryBreakdownItem) {
    return project.categoryBudgets || [];
  }

  const newBudgetedAmount = updates.budgetedAmount ?? categoryBreakdownItem.budgeted;
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
  // categoryBudgets entries may have populated objects or raw strings for IDs
  const categoryBudgets = [...(project.categoryBudgets || [])];
  const targetCatId = categoryBreakdownItem.categoryId._id;
  const targetSubId = categoryBreakdownItem.subCategoryId._id;
  const budgetIndex = categoryBudgets.findIndex(budget => 
    getId(budget.categoryId) === targetCatId &&
    getId(budget.subCategoryId) === targetSubId
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

  const targetCatId = categoryBreakdownItem.categoryId._id;
  const targetSubId = categoryBreakdownItem.subCategoryId._id;

  return (project.categoryBudgets || []).filter(budget => !(
    getId(budget.categoryId) === targetCatId &&
    getId(budget.subCategoryId) === targetSubId
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
