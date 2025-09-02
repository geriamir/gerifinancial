/**
 * Centralized Status Type Constants
 * 
 * This file defines all status types used throughout the application
 * to ensure consistency and prevent typos in string literals.
 */

// Budget Status Types
const BUDGET_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Project Status Types  
const PROJECT_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active', 
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Approval Status Types
const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Bank Account Status Types
const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  CLOSED: 'closed'
};

// All status arrays for validation
const ALL_BUDGET_STATUSES = Object.values(BUDGET_STATUS);
const ALL_PROJECT_STATUSES = Object.values(PROJECT_STATUS);
const ALL_APPROVAL_STATUSES = Object.values(APPROVAL_STATUS);
const ALL_ACCOUNT_STATUSES = Object.values(ACCOUNT_STATUS);

// Validation functions
const isValidBudgetStatus = (status) => ALL_BUDGET_STATUSES.includes(status);
const isValidProjectStatus = (status) => ALL_PROJECT_STATUSES.includes(status);
const isValidApprovalStatus = (status) => ALL_APPROVAL_STATUSES.includes(status);
const isValidAccountStatus = (status) => ALL_ACCOUNT_STATUSES.includes(status);

// Status descriptions for UI
const BUDGET_STATUS_DESCRIPTIONS = {
  [BUDGET_STATUS.DRAFT]: 'Draft - Not yet finalized',
  [BUDGET_STATUS.ACTIVE]: 'Active - Currently in use',
  [BUDGET_STATUS.COMPLETED]: 'Completed - Period ended',
  [BUDGET_STATUS.CANCELLED]: 'Cancelled - Not in use'
};

const APPROVAL_STATUS_DESCRIPTIONS = {
  [APPROVAL_STATUS.PENDING]: 'Pending - Awaiting approval',
  [APPROVAL_STATUS.APPROVED]: 'Approved - Approved for use',
  [APPROVAL_STATUS.REJECTED]: 'Rejected - Rejected and not in use'
};

module.exports = {
  // Status constants
  BUDGET_STATUS,
  PROJECT_STATUS,
  APPROVAL_STATUS,
  ACCOUNT_STATUS,
  
  // Validation arrays
  ALL_BUDGET_STATUSES,
  ALL_PROJECT_STATUSES,
  ALL_APPROVAL_STATUSES,
  ALL_ACCOUNT_STATUSES,
  
  // Validation functions
  isValidBudgetStatus,
  isValidProjectStatus,
  isValidApprovalStatus,
  isValidAccountStatus,
  
  // Descriptions
  BUDGET_STATUS_DESCRIPTIONS,
  APPROVAL_STATUS_DESCRIPTIONS
};
