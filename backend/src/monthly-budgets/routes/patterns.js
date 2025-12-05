const express = require('express');
const { body, param, validationResult } = require('express-validator');
const auth = require('../../shared/middleware/auth');
const patternService = require('../services/patternService');
const smartBudgetService = require('../services/smartBudgetService');
const budgetService = require('../services/budgetService');
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

/**
 * GET /api/budgets/patterns/detected/:userId
 * Get detected patterns for user (pending approval)
 */
router.get('/detected/:userId',
  auth,
  [
    param('userId').isMongoId().withMessage('Invalid user ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Ensure user can only access their own patterns
      if (req.params.userId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const patterns = await patternService.getPendingPatterns(req.user._id);
      
      res.json({
        success: true,
        data: {
          patterns,
          totalCount: patterns.length
        }
      });
    } catch (error) {
      logger.error('Error fetching detected patterns:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch detected patterns',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/budgets/patterns/pending
 * Get all pending patterns for the current user
 */
router.get('/pending',
  auth,
  async (req, res) => {
    try {
      const patterns = await patternService.getPendingPatterns(req.user._id);
      
      res.json({
        success: true,
        data: patterns,
        count: patterns.length
      });
    } catch (error) {
      logger.error('Error fetching pending patterns:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending patterns',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/budgets/patterns/approved
 * Get all approved patterns for the current user
 */
router.get('/approved',
  auth,
  async (req, res) => {
    try {
      const patterns = await patternService.getActivePatterns(req.user._id);
      
      res.json({
        success: true,
        data: patterns,
        count: patterns.length
      });
    } catch (error) {
      logger.error('Error fetching approved patterns:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch approved patterns',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/budgets/patterns/preview/:year/:month
 * Get pattern preview for a specific month
 */
router.get('/preview/:year/:month',
  auth,
  [
    param('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
    param('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const preview = await patternService.getPatternPreview(req.user._id, year, month);
      
      res.json({
        success: true,
        data: preview
      });
    } catch (error) {
      logger.error('Error fetching pattern preview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pattern preview',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/patterns/approve
 * Approve a detected pattern
 */
router.post('/approve',
  auth,
  [
    body('patternId').isMongoId().withMessage('Invalid pattern ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const pattern = await patternService.approvePattern(req.user._id, req.body.patternId);
      
      res.json({
        success: true,
        data: { pattern },
        message: 'Pattern approved successfully'
      });
    } catch (error) {
      logger.error('Error approving pattern:', error);
      
      if (error.message === 'Pattern not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to approve pattern',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/patterns/reject
 * Reject a detected pattern
 */
router.post('/reject',
  auth,
  [
    body('patternId').isMongoId().withMessage('Invalid pattern ID'),
    body('reason').optional().isString().isLength({ max: 200 }).withMessage('Reason must be under 200 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const pattern = await patternService.rejectPattern(
        req.user._id,
        req.body.patternId,
        req.body.reason
      );
      
      res.json({
        success: true,
        data: { pattern },
        message: 'Pattern rejected successfully'
      });
    } catch (error) {
      logger.error('Error rejecting pattern:', error);
      
      if (error.message === 'Pattern not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to reject pattern',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/budgets/patterns/bulk-approve
 * Approve multiple patterns at once
 */
router.put('/bulk-approve',
  auth,
  [
    body('patternIds').isArray({ min: 1 }).withMessage('patternIds must be a non-empty array'),
    body('patternIds.*').isMongoId().withMessage('Each patternId must be a valid MongoDB ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await patternService.bulkApprovePatterns(req.user._id, req.body.patternIds);
      
      res.json({
        success: true,
        message: `Approved ${result.totalApproved} pattern(s)`,
        data: result
      });
    } catch (error) {
      logger.error('Error in bulk-approve:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve patterns',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/budgets/patterns/reject-remaining-and-proceed
 * Reject all remaining pending patterns and proceed with budget calculation
 */
router.post('/reject-remaining-and-proceed',
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
      const userId = req.user._id;

      logger.info(`Rejecting remaining patterns and proceeding with budget calculation for user ${userId}`);

      // Get all pending patterns and auto-reject them
      const pendingPatterns = await patternService.getPendingPatterns(userId);
      
      logger.info(`Found ${pendingPatterns.length} pending patterns to auto-reject`);

      let autoRejectedCount = 0;
      for (const pattern of pendingPatterns) {
        try {
          await patternService.rejectPattern(userId, pattern.id, 'auto-rejected');
          autoRejectedCount++;
        } catch (error) {
          logger.error(`Error auto-rejecting pattern ${pattern.id}:`, error);
        }
      }

      logger.info(`Auto-rejected ${autoRejectedCount} pending patterns`);

      // Calculate smart budget
      const budgetResult = await smartBudgetService.calculateSmartBudget(userId, year, month, monthsToAnalyze);

      // Save the budget to database
      const savedBudget = await budgetService.createMonthlyBudget(userId, year, month, budgetResult.budget);

      logger.info('Smart budget calculated and saved successfully after auto-rejecting patterns');

      res.json({
        success: true,
        step: 'budget-calculated',
        message: `Successfully auto-rejected ${autoRejectedCount} patterns and calculated smart budget`,
        autoRejectedPatterns: autoRejectedCount,
        data: savedBudget,
        calculation: budgetResult.calculation,
        patterns: budgetResult.patterns
      });

    } catch (error) {
      logger.error('Error in reject-remaining-and-proceed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject patterns and calculate budget',
        error: error.message
      });
    }
  }
);

module.exports = router;
