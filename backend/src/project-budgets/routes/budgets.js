const express = require('express');
const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../../shared/middleware/auth');
const projectBudgetService = require('../services/projectBudgetService');
const projectExpensesService = require('../services/projectExpensesService');
const projectOverviewService = require('../services/projectOverviewService');
const projectTransactionService = require('../services/projectTransactionService');
const logger = require('../../shared/utils/logger');
const { ProjectBudget } = require('../models');
const { Transaction } = require('../../banking');

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
      
      // Build filters for the service layer
      const filters = {
        status,
        year: year ? parseInt(year) : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
      
      // Use the project budget service to get projects with calculated overview data
      const result = await projectBudgetService.getProjectBudgets(req.user._id, filters);
      
      res.json({
        success: true,
        data: {
          projects: result.projects,
          pagination: {
            total: result.total
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
    body('type').isIn(['vacation', 'home_renovation', 'investment']).withMessage('Project type must be vacation, home_renovation, or investment'),
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
      
      const project = await projectBudgetService.createProjectBudget(req.user._id, req.body);
      
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
      const project = await projectBudgetService.getProjectBudget(req.params.id);
      
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
    body('startDate').optional().isISO8601().withMessage('Start date must be valid ISO8601 date'),
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
      // Validate date logic if both dates are provided
      if (req.body.startDate && req.body.endDate) {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);
        
        if (endDate <= startDate) {
          return res.status(400).json({
            success: false,
            message: 'End date must be after start date'
          });
        }
      } else if (req.body.endDate) {
        // If only endDate is provided, check against existing startDate
        const existingProject = await projectBudgetService.getProjectBudget(req.params.id);
        const endDate = new Date(req.body.endDate);
        
        if (endDate <= existingProject.startDate) {
          return res.status(400).json({
            success: false,
            message: 'End date must be after start date'
          });
        }
      }
      
      const project = await projectBudgetService.updateProjectBudget(req.params.id, req.body);
      
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
      
      if (error.message.includes('End date must be after start date')) {
        return res.status(400).json({
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
      const result = await projectBudgetService.deleteProjectBudget(req.params.id);
      
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
      const progress = await projectBudgetService.getProjectProgress(req.params.id);
      
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

/**
 * POST /api/budgets/projects/:id/expenses/tag
 * Tag single transaction to project as unplanned expense
 */
router.post('/projects/:id/expenses/tag',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID'),
    body('transactionId').isMongoId().withMessage('Invalid transaction ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Get project and verify ownership
      const project = await ProjectBudget.findOne({
        _id: req.params.id,
        userId: req.user._id
      });
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Add transaction as unplanned expense using the service
      const transaction = await projectExpensesService.addUnplannedExpense(
        project._id,
        req.body.transactionId
      );
      
      res.json({
        success: true,
        data: {
          transactionId: transaction._id,
          projectId: project._id,
          projectName: project.name
        },
        message: 'Transaction tagged to project successfully'
      });
    } catch (error) {
      logger.error('Error tagging transaction to project:', error);
      
      if (error.message.includes('not found') || error.message.includes('not an expense')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to tag transaction to project',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/projects/:id/expenses/bulk-tag
 * Tag multiple transactions to project as unplanned expenses
 */
router.post('/projects/:id/expenses/bulk-tag',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID'),
    body('transactionIds').isArray({ min: 1 }).withMessage('At least one transaction ID required'),
    body('transactionIds.*').isMongoId().withMessage('Invalid transaction ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Get project and verify ownership
      const project = await ProjectBudget.findOne({
        _id: req.params.id,
        userId: req.user._id
      });
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      const result = await projectTransactionService.bulkTagTransactionsToProject(
        project._id,
        req.body.transactionIds
      );
      
      // Build results array for test compatibility
      const results = req.body.transactionIds.map(transactionId => {
        const failure = result.failedTags.find(f => f.transactionId === transactionId);
        if (failure) {
          return {
            transactionId,
            success: false,
            error: failure.error
          };
        }
        return {
          transactionId,
          success: true
        };
      });
      
      res.json({
        success: true,
        data: {
          successfulTags: result.successfulTags,
          totalRequested: req.body.transactionIds.length,
          results: results,
          errors: result.failedTags,
          projectId: project._id,
          projectName: project.name
        },
        message: `${result.successfulTags} transactions tagged to project successfully`
      });
    } catch (error) {
      logger.error('Error bulk tagging transactions to project:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to tag transactions to project',
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/budgets/projects/:id/expenses/:transactionId
 * Remove transaction from project
 */
router.delete('/projects/:id/expenses/:transactionId',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID'),
    param('transactionId').isMongoId().withMessage('Invalid transaction ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Get project and verify ownership
      const project = await ProjectBudget.findOne({
        _id: req.params.id,
        userId: req.user._id
      });
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      const result = await projectTransactionService.removeTransactionFromProject(
        req.params.transactionId,
        project._id
      );
      
      res.json({
        success: true,
        data: {
          transactionId: req.params.transactionId,
          projectId: project._id,
          projectName: project.name
        },
        message: 'Transaction removed from project successfully'
      });
    } catch (error) {
      logger.error('Error removing transaction from project:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to remove transaction from project',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/budgets/projects/:id/expenses/:transactionId/move
 * Move expense to planned category (handles both single transactions and installment groups)
 */
router.put('/projects/:id/expenses/:transactionId/move',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID'),
    // transactionId can be either a MongoDB ObjectId OR an installment group ID (string)
    // We'll validate this manually in the handler since it can be either format
    param('transactionId').isString().withMessage('Transaction/group ID is required'),
    body('categoryId').isMongoId().withMessage('Invalid category ID'),
    body('subCategoryId').isMongoId().withMessage('Invalid subcategory ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Get project and verify ownership
      const project = await ProjectBudget.findOne({
        _id: req.params.id,
        userId: req.user._id
      });
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      /** @type {string} */
      const { transactionId } = req.params;
      const { categoryId, subCategoryId } = req.body;
      
      // Check if this is an installment group ID (starts with "installment-group-")
      if (transactionId.startsWith('installment-group-')) {
        // Handle installment group
        
        // Parse the group ID to get the identifier and original amount
        const groupParts = transactionId.replace('installment-group-', '').split('--');
        const identifier = groupParts[0];
        const originalAmount = Math.abs(parseFloat(groupParts[1]));
        
        // Find all transactions in this installment group
        const installmentTransactions = await Transaction.find({
          userId: req.user._id,
          identifier: identifier,
          'rawData.type': 'installments',
          tags: project.projectTag
        });
        
        if (installmentTransactions.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Installment group not found'
          });
        }
        
        // Move all transactions in the group
        const installmentResults = [];
        for (const transaction of installmentTransactions) {
          try {
            await projectTransactionService.moveExpenseToPlannedCategory(
              transaction._id,
              project._id,
              categoryId,
              subCategoryId
            );
            installmentResults.push({
              transactionId: transaction._id,
              success: true,
              convertedAmount: Math.abs(transaction.amount)
            });
          } catch (error) {
            installmentResults.push({
              transactionId: transaction._id,
              success: false,
              error: error.message
            });
          }
        }
        
        const totalConvertedAmount = installmentResults
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.convertedAmount, 0);
        
        res.json({
          success: true,
          data: {
            groupId: transactionId,
            installmentCount: installmentTransactions.length,
            totalConvertedAmount,
            installmentResults,
            targetCategory: {
              categoryId,
              subCategoryId
            }
          },
          message: 'Installment group moved to planned category successfully'
        });
        
      } else {
        
        // Validate it's a valid MongoDB ObjectId for single transactions
        try {
          new mongoose.Types.ObjectId(transactionId);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: 'Invalid transaction ID format'
          });
        }
        
        // Get the transaction to check its amount
        const transaction = await Transaction.findOne({
          _id: transactionId,
          userId: req.user._id
        });
        
        if (!transaction) {
          return res.status(404).json({
            success: false,
            message: 'Transaction not found'
          });
        }
        
        const result = await projectTransactionService.moveExpenseToPlannedCategory(
          transactionId,
          project._id,
          categoryId,
          subCategoryId
        );
        
        res.json({
          success: true,
          data: {
            transactionId: transactionId,
            convertedAmount: Math.abs(transaction.amount),
            projectId: project._id,
            targetCategory: {
              categoryId,
              subCategoryId
            },
            groupId: result.groupId
          },
          message: 'Expense moved to planned category successfully'
        });
      }
    } catch (error) {
      logger.error('Error moving expense to planned category:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to move expense to planned category',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/projects/:id/expenses/bulk-move
 * Move multiple expenses to planned category
 */
router.post('/projects/:id/expenses/bulk-move',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID'),
    body('transactionIds').isArray({ min: 1 }).withMessage('At least one transaction ID required'),
    body('transactionIds.*').isMongoId().withMessage('Invalid transaction ID'),
    body('categoryId').isMongoId().withMessage('Invalid category ID'),
    body('subCategoryId').isMongoId().withMessage('Invalid subcategory ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Get project and verify ownership
      const project = await ProjectBudget.findOne({
        _id: req.params.id,
        userId: req.user._id
      });
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      const result = await projectTransactionService.bulkMoveExpensesToPlannedCategory(
        req.body.transactionIds,
        project._id,
        req.body.categoryId,
        req.body.subCategoryId
      );
      
      // Get transaction amounts for totalConvertedAmount calculation
      const transactions = await Transaction.find({
        _id: { $in: req.body.transactionIds },
        userId: req.user._id
      });
      
      // Build results array and calculate total converted amount
      const results = req.body.transactionIds.map(transactionId => {
        const failure = result.failedMoves.find(f => f.transactionId.toString() === transactionId.toString());
        const transaction = transactions.find(t => t._id.toString() === transactionId.toString());
        
        if (failure) {
          return {
            transactionId,
            success: false,
            error: failure.error
          };
        }
        return {
          transactionId,
          success: true,
          convertedAmount: transaction ? Math.abs(transaction.amount) : 0
        };
      });
      
      const totalConvertedAmount = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.convertedAmount || 0), 0);
      
      res.json({
        success: true,
        data: {
          successfulMoves: result.successfulMoves,
          totalRequested: req.body.transactionIds.length,
          totalConvertedAmount,
          results: results,
          errors: result.failedMoves,
          projectId: project._id,
          categoryId: req.body.categoryId,
          subCategoryId: req.body.subCategoryId
        },
        message: `${result.successfulMoves} expenses moved to planned category successfully`
      });
    } catch (error) {
      logger.error('Error bulk moving expenses to planned category:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to move expenses to planned category',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/budgets/projects/:id/expenses/breakdown
 * Get comprehensive expense breakdown for project
 */
router.get('/projects/:id/expenses/breakdown',
  auth,
  [
    param('id').isMongoId().withMessage('Invalid project ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Get project and verify ownership
      const project = await ProjectBudget.findOne({
        _id: req.params.id,
        userId: req.user._id
      }).populate('categoryBudgets.categoryId', 'name')
        .populate('categoryBudgets.subCategoryId', 'name');
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Get comprehensive project overview including planned expenses with grouping
      const overview = await projectOverviewService.getProjectOverview(project);
      
      res.json({
        success: true,
        data: {
          projectId: project._id,
          projectName: project.name,
          currency: project.currency,
          totalBudget: overview.totalBudget,
          totalPaid: overview.totalPaid,
          totalPlannedPaid: overview.totalPlannedPaid,
          totalUnplannedPaid: overview.totalUnplannedPaid,
          isOverBudget: overview.isOverBudget,
          progress: overview.progress,
          plannedCategories: overview.categoryBreakdown,
          plannedExpensesGrouped: overview.plannedExpensesGrouped,
          unplannedExpenses: overview.unplannedExpenses,
          unplannedExpensesCount: overview.unplannedExpensesCount
        }
      });
    } catch (error) {
      logger.error('Error fetching project expense breakdown:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch project expense breakdown',
        error: error.message
      });
    }
  }
);

module.exports = router;
