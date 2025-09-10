// Monthly budgets subsystem public interface

// Models (used by other subsystems)
const { MonthlyBudget, YearlyBudget, CategoryBudget, TransactionPattern } = require('./models');

// Services (used by other subsystems)
const budgetService = require('./services/budgetService');
const budgetCalculationService = require('./services/budgetCalculationService');
const yearlyBudgetService = require('./services/yearlyBudgetService');
const smartBudgetService = require('./services/smartBudgetService');
const recurrenceDetectionService = require('./services/recurrenceDetectionService');
const { initializeUserCategories, defaultCategories } = require('./services/userCategoryService');

module.exports = {
  // Models
  MonthlyBudget,
  YearlyBudget,
  CategoryBudget,
  TransactionPattern,
  
  // Services
  budgetService,
  budgetCalculationService,
  yearlyBudgetService,
  smartBudgetService,
  recurrenceDetectionService,
  initializeUserCategories,
  defaultCategories
};
