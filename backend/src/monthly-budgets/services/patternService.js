const { TransactionPattern } = require('../models');
const { APPROVAL_STATUS } = require('../constants/statusTypes');
const logger = require('../../shared/utils/logger');

class PatternService {
  /**
   * Get pending patterns for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of pending patterns
   */
  async getPendingPatterns(userId) {
    try {
      const patterns = await TransactionPattern.getPendingPatterns(userId);
      
      return patterns
        .map(pattern => ({
          id: pattern._id,
          patternId: pattern.patternId,
          description: pattern.transactionIdentifier.description,
          amount: pattern.averageAmount,
          category: pattern.transactionIdentifier.categoryId?.name || 'Unknown',
          subcategory: pattern.transactionIdentifier.subCategoryId?.name || 'General',
          patternType: pattern.recurrencePattern,
          confidence: pattern.detectionData.confidence,
          scheduledMonths: pattern.scheduledMonths,
          sampleTransactions: pattern.detectionData.sampleTransactions,
          detectedAt: pattern.detectionData.lastDetected,
          displayName: pattern.displayName
        }))
        .sort((a, b) => b.confidence - a.confidence); // Sort by confidence DESC
    } catch (error) {
      logger.error('Error fetching pending patterns:', error);
      throw error;
    }
  }

  /**
   * Approve a pattern
   * @param {string} userId - User ID
   * @param {string} patternId - Pattern ID
   * @returns {Promise<Object>} Approved pattern data
   */
  async approvePattern(userId, patternId) {
    try {
      const pattern = await TransactionPattern.findById(patternId);
      
      if (!pattern) {
        throw new Error('Pattern not found');
      }

      if (pattern.userId.toString() !== userId.toString()) {
        throw new Error('Access denied');
      }

      pattern.approve();
      await pattern.save();
      
      logger.info(`Pattern approved: ${pattern.displayName} for user ${userId}`);
      
      return {
        id: pattern._id,
        patternId: pattern.patternId,
        description: pattern.transactionIdentifier.description,
        amount: pattern.averageAmount,
        patternType: pattern.recurrencePattern,
        scheduledMonths: pattern.scheduledMonths,
        approvalStatus: pattern.approvalStatus,
        isActive: pattern.isActive
      };
    } catch (error) {
      logger.error('Error approving pattern:', error);
      throw error;
    }
  }

  /**
   * Reject a pattern
   * @param {string} userId - User ID
   * @param {string} patternId - Pattern ID
   * @param {string} reason - Optional reason for rejection
   * @returns {Promise<Object>} Rejected pattern data
   */
  async rejectPattern(userId, patternId, reason) {
    try {
      const pattern = await TransactionPattern.findById(patternId);
      
      if (!pattern) {
        throw new Error('Pattern not found');
      }

      if (pattern.userId.toString() !== userId.toString()) {
        throw new Error('Access denied');
      }

      pattern.reject();
      if (reason) {
        pattern.notes = reason;
      }
      await pattern.save();
      
      logger.info(`Pattern rejected: ${pattern.displayName} for user ${userId}`);
      
      return {
        id: pattern._id,
        patternId: pattern.patternId,
        description: pattern.transactionIdentifier.description,
        amount: pattern.averageAmount,
        patternType: pattern.recurrencePattern,
        approvalStatus: pattern.approvalStatus,
        isActive: pattern.isActive,
        notes: pattern.notes
      };
    } catch (error) {
      logger.error('Error rejecting pattern:', error);
      throw error;
    }
  }

  /**
   * Bulk approve multiple patterns
   * @param {string} userId - User ID
   * @param {Array<string>} patternIds - Array of pattern IDs to approve
   * @returns {Promise<Object>} Result with approved patterns and errors
   */
  async bulkApprovePatterns(userId, patternIds) {
    try {
      const approvedPatterns = [];
      const errors = [];

      for (const patternId of patternIds) {
        try {
          const pattern = await TransactionPattern.findOne({ _id: patternId, userId });
          
          if (!pattern) {
            errors.push({ patternId, error: 'Pattern not found or does not belong to user' });
            continue;
          }

          if (pattern.approvalStatus !== APPROVAL_STATUS.PENDING) {
            errors.push({ patternId, error: `Pattern is already ${pattern.approvalStatus}` });
            continue;
          }

          pattern.approve();
          await pattern.save();
          
          approvedPatterns.push({
            id: pattern._id,
            patternId: pattern.patternId,
            description: pattern.transactionIdentifier.description,
            patternType: pattern.recurrencePattern
          });
        } catch (error) {
          logger.error(`Error approving pattern ${patternId}:`, error);
          errors.push({ patternId, error: error.message });
        }
      }

      logger.info(`Successfully approved ${approvedPatterns.length} out of ${patternIds.length} patterns for user ${userId}`);

      return {
        approvedPatterns,
        totalApproved: approvedPatterns.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      logger.error('Error in bulk approve patterns:', error);
      throw error;
    }
  }

  /**
   * Get pattern preview for a specific month
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Promise<Object>} Pattern preview data
   */
  async getPatternPreview(userId, year, month) {
    try {
      const patterns = await TransactionPattern.getPatternsForMonth(userId, month);
      
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const totalPatternAmount = patterns.reduce((sum, pattern) => sum + pattern.averageAmount, 0);
      
      return {
        year,
        month,
        monthName: monthNames[month - 1],
        patterns: patterns.map(pattern => ({
          id: pattern._id,
          patternId: pattern.patternId,
          description: pattern.transactionIdentifier.description,
          amount: pattern.averageAmount,
          category: pattern.transactionIdentifier.categoryId?.name || 'Unknown',
          subcategory: pattern.transactionIdentifier.subCategoryId?.name || 'General',
          patternType: pattern.recurrencePattern,
          scheduledMonths: pattern.scheduledMonths,
          displayName: pattern.displayName,
          confidence: pattern.detectionData.confidence
        })),
        totalPatternAmount,
        patternCount: patterns.length,
        hasPatterns: patterns.length > 0
      };
    } catch (error) {
      logger.error('Error fetching pattern preview:', error);
      throw error;
    }
  }

  /**
   * Get approved/active patterns for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of active patterns
   */
  async getActivePatterns(userId) {
    try {
      const patterns = await TransactionPattern.getActivePatterns(userId);
      
      return patterns.map(pattern => ({
        id: pattern._id,
        patternId: pattern.patternId,
        description: pattern.transactionIdentifier.description,
        amount: pattern.averageAmount,
        category: pattern.transactionIdentifier.categoryId?.name || 'Unknown',
        subcategory: pattern.transactionIdentifier.subCategoryId?.name || 'General',
        patternType: pattern.recurrencePattern,
        scheduledMonths: pattern.scheduledMonths,
        displayName: pattern.displayName,
        approvedAt: pattern.approvalStatus.approvedAt
      }));
    } catch (error) {
      logger.error('Error fetching active patterns:', error);
      throw error;
    }
  }
}

module.exports = new PatternService();
