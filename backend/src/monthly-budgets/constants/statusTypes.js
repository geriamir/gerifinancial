/**
 * Monthly Budget Status Type Constants
 * 
 * This file defines status types used specifically for monthly budget functionality
 * including transaction pattern approval workflows.
 */

// Approval Status Types for Transaction Patterns
const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// All status arrays for validation
const ALL_APPROVAL_STATUSES = Object.values(APPROVAL_STATUS);

// Validation functions
const isValidApprovalStatus = (status) => ALL_APPROVAL_STATUSES.includes(status);

// Status descriptions for UI
const APPROVAL_STATUS_DESCRIPTIONS = {
  [APPROVAL_STATUS.PENDING]: 'Pending - Awaiting approval',
  [APPROVAL_STATUS.APPROVED]: 'Approved - Approved for use',
  [APPROVAL_STATUS.REJECTED]: 'Rejected - Rejected and not in use'
};

module.exports = {
  // Status constants
  APPROVAL_STATUS,
  
  // Validation arrays
  ALL_APPROVAL_STATUSES,
  
  // Validation functions
  isValidApprovalStatus,
  
  // Descriptions
  APPROVAL_STATUS_DESCRIPTIONS
};
