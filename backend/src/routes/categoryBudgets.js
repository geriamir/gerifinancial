const express = require('express');
const auth = require('../middleware/auth');
const categoryBudgetService = require('../services/categoryBudgetService');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// ============================================
// CATEGORY BUDGET ROUTES
// ============================================

/**
 * GET /api/category-budgets
 * Get all category budgets for the authenticated user
 */
router.get('/', auth, [
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('type').optional().isIn(['income', 'expense'])
], handleValidationErrors, async (req, res) => {
  try {
    const { month, type } = req.query;
    const userId = req.user.id;

    let budgets;
    
    if (type === 'income') {
      budgets = await categoryBudgetService.getIncomeBudgets(userId, month);
    } else if (type === 'expense') {
      budgets = await categoryBudgetService.getExpenseBudgets(userId, month);
    } else {
      budgets = month 
        ? await categoryBudgetService.getBudgetsForMonth(userId, parseInt(month))
        : await categoryBudgetService.getUserCategoryBudgets(userId);
    }

    res.json({
      success: true,
      data: budgets
    });
  } catch (error) {
    console.error('Error fetching category budgets:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch category budgets'
    });
  }
});

/**
 * GET /api/category-budgets/:id
 * Get a specific category budget by ID
 */
router.get('/:id', auth, [
  param('id').isMongoId()
], handleValidationErrors, async (req, res) => {
  try {
    const budget = await categoryBudgetService.getCategoryBudget(req.params.id);
    
    // Verify ownership
    if (budget.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: budget
    });
  } catch (error) {
    console.error('Error fetching category budget:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch category budget'
    });
  }
});

/**
 * POST /api/category-budgets
 * Create or update a category budget
 */
router.post('/', auth, [
  body('categoryId').isMongoId(),
  body('subCategoryId').optional().isMongoId(),
  body('budgetType').isIn(['fixed', 'variable']),
  body('fixedAmount').optional().isNumeric({ min: 0 }),
  body('monthlyAmounts').optional().isArray(),
  body('monthlyAmounts.*.month').optional().isInt({ min: 1, max: 12 }),
  body('monthlyAmounts.*.amount').optional().isNumeric({ min: 0 }),
  body('notes').optional().isLength({ max: 500 })
], handleValidationErrors, async (req, res) => {
  try {
    const { categoryId, subCategoryId, ...budgetData } = req.body;
    const userId = req.user.id;

    const budget = await categoryBudgetService.createOrUpdateCategoryBudget(
      userId,
      categoryId,
      subCategoryId,
      budgetData
    );

    res.status(201).json({
      success: true,
      data: budget
    });
  } catch (error) {
    console.error('Error creating/updating category budget:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create/update category budget'
    });
  }
});

/**
 * PUT /api/category-budgets/:id/amount
 * Update budget amount for a specific month
 */
router.put('/:id/amount', auth, [
  param('id').isMongoId(),
  body('month').isInt({ min: 1, max: 12 }),
  body('amount').isNumeric({ min: 0 })
], handleValidationErrors, async (req, res) => {
  try {
    const { month, amount } = req.body;
    const budgetId = req.params.id;
    
    // First verify ownership
    const budget = await categoryBudgetService.getCategoryBudget(budgetId);
    if (budget.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updatedBudget = await categoryBudgetService.updateBudgetAmount(
      req.user.id,
      budget.categoryId,
      budget.subCategoryId,
      month,
      parseFloat(amount)
    );

    res.json({
      success: true,
      data: updatedBudget
    });
  } catch (error) {
    console.error('Error updating budget amount:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update budget amount'
    });
  }
});

/**
 * PUT /api/category-budgets/:id/convert
 * Convert budget type (fixed to variable or vice versa)
 */
router.put('/:id/convert', auth, [
  param('id').isMongoId(),
  body('budgetType').isIn(['fixed', 'variable']),
  body('fixedAmount').optional().isNumeric({ min: 0 }),
  body('populateAllMonths').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    const { budgetType, fixedAmount, populateAllMonths } = req.body;
    const budgetId = req.params.id;

    // Verify ownership
    const budget = await categoryBudgetService.getCategoryBudget(budgetId);
    if (budget.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updatedBudget = await categoryBudgetService.convertBudgetType(
      budgetId,
      budgetType,
      { fixedAmount, populateAllMonths }
    );

    res.json({
      success: true,
      data: updatedBudget
    });
  } catch (error) {
    console.error('Error converting budget type:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to convert budget type'
    });
  }
});

/**
 * DELETE /api/category-budgets/:id
 * Delete a category budget
 */
router.delete('/:id', auth, [
  param('id').isMongoId()
], handleValidationErrors, async (req, res) => {
  try {
    const budgetId = req.params.id;

    // Verify ownership
    const budget = await categoryBudgetService.getCategoryBudget(budgetId);
    if (budget.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await categoryBudgetService.deleteCategoryBudget(budgetId);

    res.json({
      success: true,
      message: 'Category budget deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category budget:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete category budget'
    });
  }
});

// ============================================
// BUDGET SUMMARY & ANALYSIS ROUTES
// ============================================

/**
 * GET /api/category-budgets/summary/:year/:month
 * Get budget summary for a specific month
 */
router.get('/summary/:year/:month', auth, [
  param('year').isInt({ min: 2020, max: 2050 }),
  param('month').isInt({ min: 1, max: 12 })
], handleValidationErrors, async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.user.id;

    const summary = await categoryBudgetService.getMonthlyBudgetSummary(
      userId,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching budget summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch budget summary'
    });
  }
});

/**
 * GET /api/category-budgets/vs-actual/:categoryId/:year/:month
 * Get budget vs actual comparison for a category
 */
router.get('/vs-actual/:categoryId/:year/:month', auth, [
  param('categoryId').isMongoId(),
  param('year').isInt({ min: 2020, max: 2050 }),
  param('month').isInt({ min: 1, max: 12 }),
  query('subCategoryId').optional().isMongoId()
], handleValidationErrors, async (req, res) => {
  try {
    const { categoryId, year, month } = req.params;
    const { subCategoryId } = req.query;
    const userId = req.user.id;

    const comparison = await categoryBudgetService.getBudgetVsActual(
      userId,
      categoryId,
      subCategoryId,
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error fetching budget vs actual:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch budget vs actual comparison'
    });
  }
});

/**
 * POST /api/category-budgets/initialize
 * Initialize default budgets for the user based on their categories
 */
router.post('/initialize', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const budgets = await categoryBudgetService.initializeUserBudgets(userId);

    res.json({
      success: true,
      data: budgets,
      message: `Initialized ${budgets.length} category budgets`
    });
  } catch (error) {
    console.error('Error initializing user budgets:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize user budgets'
    });
  }
});

/**
 * GET /api/category-budgets/dashboard
 * Get budget overview for dashboard
 */
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const overview = await categoryBudgetService.getDashboardOverview(userId);

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch dashboard overview'
    });
  }
});

module.exports = router;
