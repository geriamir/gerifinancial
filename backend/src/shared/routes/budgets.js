const express = require('express');
const router = express.Router();

// Import modular route files
const monthlyBudgetRoutes = require('../../monthly-budgets/routes/budgets');
const projectBudgetRoutes = require('../../project-budgets/routes/budgets');
const patternRoutes = require('../../monthly-budgets/routes/patterns');

// Import additional route handlers for functionality not yet modularized
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const budgetService = require('../../monthly-budgets/services/budgetService');
const { defaultCategories } = require('../../monthly-budgets/services/userCategoryService');
const logger = require('../utils/logger');

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// Use the modular routes
router.use('/', monthlyBudgetRoutes);
router.use('/', projectBudgetRoutes);
router.use('/patterns', patternRoutes);

// ============================================
// GENERAL BUDGET ENDPOINTS
// ============================================

/**
 * GET /api/budgets/summary
 * Get budget summary for dashboard
 */
router.get('/summary',
  auth,
  [
    query('year').optional().isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const currentDate = new Date();
      const year = req.query.year ? parseInt(req.query.year) : currentDate.getFullYear();
      const month = req.query.month ? parseInt(req.query.month) : currentDate.getMonth() + 1;
      
      const summary = await budgetService.getBudgetSummary(req.user._id, year, month);
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error fetching budget summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budget summary',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/budgets/dashboard
 * Get dashboard overview data
 */
router.get('/dashboard',
  auth,
  async (req, res) => {
    try {
      const overview = await budgetService.getDashboardOverview(req.user._id);
      
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      logger.error('Error fetching dashboard overview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard overview',
        error: error.message
      });
    }
  }
);

// ============================================
// CATEGORY CONFIGURATION ENDPOINTS
// ============================================

/**
 * GET /api/budgets/categories/default-order
 * Get default category structure and ordering
 */
router.get('/categories/default-order',
  auth,
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          categories: defaultCategories,
          incomeCategories: defaultCategories.filter(cat => cat.type === 'Income'),
          expenseCategories: defaultCategories.filter(cat => cat.type === 'Expense'),
          transferCategories: defaultCategories.filter(cat => cat.type === 'Transfer')
        }
      });
    } catch (error) {
      logger.error('Error fetching default categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch default categories',
        error: error.message
      });
    }
  }
);

// ============================================
// BUDGET EDITING ENDPOINTS
// ============================================

/**
 * GET /api/budgets/category/:categoryId/subcategory/:subCategoryId/edit
 * Get budget details for editing
 */
router.get('/category/:categoryId/subcategory/:subCategoryId/edit',
  auth,
  [
    param('categoryId').isMongoId().withMessage('Invalid category ID'),
    param('subCategoryId').custom((value) => {
      if (value === 'null') return true; // Allow 'null' string for income categories
      if (value && !/^[0-9a-fA-F]{24}$/.test(value)) {
        throw new Error('Invalid subcategory ID');
      }
      return true;
    }).withMessage('Invalid subcategory ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { categoryId, subCategoryId } = req.params;
      const budget = await budgetService.getBudgetForEditing(
        req.user._id, 
        categoryId, 
        subCategoryId === 'null' ? null : subCategoryId
      );
      
      res.json({
        success: true,
        data: budget
      });
    } catch (error) {
      logger.error('Error fetching budget for editing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budget for editing',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/budgets/category/:categoryId/subcategory/:subCategoryId
 * Update category budget with manual edit tracking
 */
router.put('/category/:categoryId/subcategory/:subCategoryId',
  auth,
  [
    param('categoryId').isMongoId().withMessage('Invalid category ID'),
    param('subCategoryId').custom((value) => {
      if (value === 'null') return true; // Allow 'null' string for income categories
      if (value && !/^[0-9a-fA-F]{24}$/.test(value)) {
        throw new Error('Invalid subcategory ID');
      }
      return true;
    }).withMessage('Invalid subcategory ID'),
    body('budgetType').isIn(['fixed', 'variable']).withMessage('Budget type must be fixed or variable'),
    body('fixedAmount').optional().isFloat({ min: 0 }).withMessage('Fixed amount must be non-negative'),
    body('monthlyAmounts').optional().isArray().withMessage('Monthly amounts must be an array'),
    body('monthlyAmounts.*.month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('monthlyAmounts.*.amount').optional().isFloat({ min: 0 }).withMessage('Amount must be non-negative'),
    body('reason').optional().isString().isLength({ max: 200 }).withMessage('Reason must be under 200 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { categoryId, subCategoryId } = req.params;
      const budget = await budgetService.updateCategoryBudget(
        req.user._id, 
        categoryId, 
        subCategoryId === 'null' ? null : subCategoryId,
        req.body
      );
      
      res.json({
        success: true,
        data: budget,
        message: 'Budget updated successfully'
      });
    } catch (error) {
      logger.error('Error updating category budget:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update budget',
        error: error.message
      });
    }
  }
);

// ============================================
// TRANSACTION EXCLUSION ENDPOINTS
// ============================================

/**
 * PUT /api/budgets/transactions/:transactionId/exclude
 * Exclude transaction from budget calculation
 */
router.put('/transactions/:transactionId/exclude',
  auth,
  [
    param('transactionId').isMongoId().withMessage('Invalid transaction ID'),
    body('reason').isString().isLength({ min: 1, max: 200 }).withMessage('Reason must be 1-200 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      
      const result = await budgetService.excludeTransactionFromBudget(
        req.user._id, 
        transactionId, 
        reason
      );
      
      res.json({
        success: true,
        data: {
          transactionId: result.transaction._id,
          excluded: result.transaction.excludeFromBudgetCalculation,
          reason: result.transaction.exclusionReason,
          excludedAt: result.transaction.excludedAt,
          budgetRecalculation: result.budgetRecalculation
        },
        message: 'Transaction excluded from budget calculation and budget recalculated'
      });
    } catch (error) {
      logger.error('Error excluding transaction:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to exclude transaction',
        error: error.message
      });
    }
  }
);

module.exports = router;
