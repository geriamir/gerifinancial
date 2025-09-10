const express = require('express');
const { body, param, validationResult } = require('express-validator');
const auth = require('../../shared/middleware/auth');
const budgetService = require('../services/budgetService');
const smartBudgetService = require('../services/smartBudgetService');
const logger = require('../../shared/utils/logger');

const router = express.Router();

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

// ============================================
// MONTHLY BUDGET ENDPOINTS
// ============================================

/**
 * GET /api/budgets/monthly/:year/:month
 * Get monthly budget for specific month
 */
router.get('/monthly/:year/:month',
  auth,
  [
    param('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    param('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { year, month } = req.params;
      const budget = await budgetService.getMonthlyBudget(req.user._id, parseInt(year), parseInt(month));
      
      res.json({
        success: true,
        data: budget
      });
    } catch (error) {
      logger.error('Error fetching monthly budget:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch monthly budget',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/monthly
 * Create new monthly budget
 */
router.post('/monthly',
  auth,
  [
    body('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
    body('salaryBudget').optional().isFloat({ min: 0 }).withMessage('Salary budget must be non-negative'),
    body('expenseBudgets').optional().isArray().withMessage('Expense budgets must be an array'),
    body('otherIncomeBudgets').optional().isArray().withMessage('Other income budgets must be an array'),
    body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes must be under 500 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { year, month, ...budgetData } = req.body;
      const budget = await budgetService.createMonthlyBudget(req.user._id, year, month, budgetData);
      
      res.status(201).json({
        success: true,
        data: budget,
        message: 'Monthly budget created successfully'
      });
    } catch (error) {
      logger.error('Error creating monthly budget:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create monthly budget',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/budgets/monthly/:id
 * Update existing monthly budget
 */
router.put('/monthly/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid budget ID'),
    body('salaryBudget').optional().isFloat({ min: 0 }).withMessage('Salary budget must be non-negative'),
    body('expenseBudgets').optional().isArray().withMessage('Expense budgets must be an array'),
    body('otherIncomeBudgets').optional().isArray().withMessage('Other income budgets must be an array'),
    body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes must be under 500 characters'),
    body('status').optional().isIn(['draft', 'active', 'completed']).withMessage('Invalid status')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const budget = await budgetService.updateMonthlyBudget(req.params.id, req.body);
      
      res.json({
        success: true,
        data: budget,
        message: 'Monthly budget updated successfully'
      });
    } catch (error) {
      logger.error('Error updating monthly budget:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update monthly budget',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/monthly/calculate
 * Auto-calculate monthly budget from history
 */
router.post('/monthly/calculate',
  auth,
  [
    body('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('monthsToAnalyze').optional().isInt({ min: 1, max: 24 }).withMessage('Months to analyze must be between 1 and 24')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { year, month, monthsToAnalyze = 6 } = req.body;
      const budget = await budgetService.calculateMonthlyBudgetFromHistory(
        req.user._id, 
        year, 
        month, 
        monthsToAnalyze
      );
      
      res.json({
        success: true,
        data: budget,
        message: 'Monthly budget calculated from history'
      });
    } catch (error) {
      logger.error('Error calculating monthly budget:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate monthly budget',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/monthly/smart-calculate
 * Smart budget calculation with pattern-aware workflow
 */
router.post('/monthly/smart-calculate',
  auth,
  [
    body('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('monthsToAnalyze').optional().isInt({ min: 6, max: 24 }).withMessage('Months to analyze must be between 6 and 24')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { year, month, monthsToAnalyze = 6 } = req.body;
      
      // Execute smart budget workflow
      const result = await smartBudgetService.executeSmartBudgetWorkflow(
        req.user._id, 
        year, 
        month, 
        monthsToAnalyze
      );
      
      if (result.step === 'pattern-approval-required') {
        // User needs to approve patterns first
        return res.status(202).json({
          success: false,
          step: result.step,
          message: result.message,
          data: {
            pendingPatterns: result.pendingPatterns,
            nextAction: result.nextAction
          }
        });
      }
      
      if (result.step === 'pattern-detection-complete') {
        // New patterns detected - need user approval
        return res.status(202).json({
          success: false,
          step: result.step,
          message: result.message,
          detectedPatterns: result.detectedPatterns,
          nextAction: result.nextAction
        });
      }
      
      // Budget calculated successfully
      res.json({
        success: true,
        step: result.step,
        data: result.budget,
        calculation: result.calculation,
        patterns: result.patterns,
        message: result.message
      });
      
    } catch (error) {
      logger.error('Error in smart budget calculation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate smart budget',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/budgets/monthly/:year/:month/actual
 * Get budget vs actual analysis for a month
 */
router.get('/monthly/:year/:month/actual',
  auth,
  [
    param('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    param('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { year, month } = req.params;
      const analysis = await budgetService.getBudgetVsActual(req.user._id, 'monthly', {
        year: parseInt(year),
        month: parseInt(month)
      });
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Error fetching budget vs actual:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch budget analysis',
        error: error.message
      });
    }
  }
);

// ============================================
// YEARLY BUDGET ENDPOINTS
// ============================================

/**
 * GET /api/budgets/yearly/:year
 * Get yearly budget
 */
router.get('/yearly/:year',
  auth,
  [
    param('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const budget = await budgetService.getYearlyBudget(req.user._id, parseInt(req.params.year));
      
      res.json({
        success: true,
        data: budget
      });
    } catch (error) {
      logger.error('Error fetching yearly budget:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch yearly budget',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/yearly
 * Create new yearly budget
 */
router.post('/yearly',
  auth,
  [
    body('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
    body('totalIncome').optional().isFloat({ min: 0 }).withMessage('Total income must be non-negative'),
    body('totalExpenses').optional().isFloat({ min: 0 }).withMessage('Total expenses must be non-negative'),
    body('oneTimeIncome').optional().isArray().withMessage('One-time income must be an array'),
    body('oneTimeExpenses').optional().isArray().withMessage('One-time expenses must be an array'),
    body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be under 1000 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { year, ...budgetData } = req.body;
      const budget = await budgetService.createYearlyBudget(req.user._id, year, budgetData);
      
      res.status(201).json({
        success: true,
        data: budget,
        message: 'Yearly budget created successfully'
      });
    } catch (error) {
      logger.error('Error creating yearly budget:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create yearly budget',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/budgets/yearly/:id
 * Update yearly budget
 */
router.put('/yearly/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid budget ID'),
    body('totalIncome').optional().isFloat({ min: 0 }).withMessage('Total income must be non-negative'),
    body('totalExpenses').optional().isFloat({ min: 0 }).withMessage('Total expenses must be non-negative'),
    body('oneTimeIncome').optional().isArray().withMessage('One-time income must be an array'),
    body('oneTimeExpenses').optional().isArray().withMessage('One-time expenses must be an array'),
    body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be under 1000 characters'),
    body('status').optional().isIn(['draft', 'active', 'completed']).withMessage('Invalid status')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const budget = await budgetService.updateYearlyBudget(req.params.id, req.body);
      
      res.json({
        success: true,
        data: budget,
        message: 'Yearly budget updated successfully'
      });
    } catch (error) {
      logger.error('Error updating yearly budget:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update yearly budget',
        error: error.message
      });
    }
  }
);

module.exports = router;
