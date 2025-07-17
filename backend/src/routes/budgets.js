const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const budgetService = require('../services/budgetService');
const logger = require('../utils/logger');

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

// ============================================
// PROJECT BUDGET ENDPOINTS
// ============================================

/**
 * GET /api/budgets/projects
 * List user's project budgets with filtering
 */
router.get('/projects',
  auth,
  [
    query('status').optional().isIn(['planning', 'active', 'completed', 'cancelled']).withMessage('Invalid status'),
    query('year').optional().isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, year, limit = 20, offset = 0 } = req.query;
      
      // Build query based on filters
      let query = { userId: req.user._id };
      
      if (status) {
        query.status = status;
      }
      
      if (year) {
        const yearInt = parseInt(year);
        query.$or = [
          { startDate: { $gte: new Date(yearInt, 0, 1), $lte: new Date(yearInt, 11, 31) } },
          { endDate: { $gte: new Date(yearInt, 0, 1), $lte: new Date(yearInt, 11, 31) } }
        ];
      }
      
      const { ProjectBudget } = require('../models');
      const projects = await ProjectBudget.find(query)
        .populate('projectTag', 'name')
        .populate('categoryBudgets.categoryId', 'name')
        .populate('categoryBudgets.subCategoryId', 'name')
        .sort({ startDate: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset));
      
      const total = await ProjectBudget.countDocuments(query);
      
      res.json({
        success: true,
        data: {
          projects,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + projects.length) < total
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching project budgets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch project budgets',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/projects
 * Create new project budget
 */
router.post('/projects',
  auth,
  [
    body('name').isString().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
    body('description').optional().isString().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
    body('startDate').isISO8601().withMessage('Start date must be valid ISO8601 date'),
    body('endDate').isISO8601().withMessage('End date must be valid ISO8601 date'),
    body('fundingSources').optional().isArray().withMessage('Funding sources must be an array'),
    body('categoryBudgets').optional().isArray().withMessage('Category budgets must be an array'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be under 1000 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Validate that end date is after start date
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      
      if (endDate <= startDate) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }
      
      const project = await budgetService.createProjectBudget(req.user._id, req.body);
      
      res.status(201).json({
        success: true,
        data: project,
        message: 'Project budget created successfully'
      });
    } catch (error) {
      logger.error('Error creating project budget:', error);
      
      if (error.message.includes('duplicate') || error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Project name already exists'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create project budget',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/budgets/projects/:id
 * Get project budget details
 */
router.get('/projects/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const project = await budgetService.getProjectBudget(req.params.id);
      
      // Check if user owns this project
      if (project.userId.toString() !== req.user._id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      logger.error('Error fetching project budget:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch project budget',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/budgets/projects/:id
 * Update project budget
 */
router.put('/projects/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID'),
    body('name').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
    body('description').optional().isString().isLength({ max: 500 }).withMessage('Description must be under 500 characters'),
    body('endDate').optional().isISO8601().withMessage('End date must be valid ISO8601 date'),
    body('status').optional().isIn(['planning', 'active', 'completed', 'cancelled']).withMessage('Invalid status'),
    body('fundingSources').optional().isArray().withMessage('Funding sources must be an array'),
    body('categoryBudgets').optional().isArray().withMessage('Category budgets must be an array'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes must be under 1000 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const project = await budgetService.updateProjectBudget(req.params.id, req.body);
      
      res.json({
        success: true,
        data: project,
        message: 'Project budget updated successfully'
      });
    } catch (error) {
      logger.error('Error updating project budget:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update project budget',
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/budgets/projects/:id
 * Delete project budget
 */
router.delete('/projects/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await budgetService.deleteProjectBudget(req.params.id);
      
      res.json({
        success: true,
        message: 'Project budget deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting project budget:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete project budget',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/budgets/projects/:id/progress
 * Get project progress and analytics
 */
router.get('/projects/:id/progress',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const progress = await budgetService.getProjectProgress(req.params.id);
      
      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      logger.error('Error fetching project progress:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch project progress',
        error: error.message
      });
    }
  }
);

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

module.exports = router;
