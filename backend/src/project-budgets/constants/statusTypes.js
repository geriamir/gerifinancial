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
const ALL_ACCOUNT_STATUSES = Object.values(ACCOUNT_STATUS);

// Validation functions
const isValidBudgetStatus = (status) => ALL_BUDGET_STATUSES.includes(status);
const isValidProjectStatus = (status) => ALL_PROJECT_STATUSES.includes(status);
const isValidAccountStatus = (status) => ALL_ACCOUNT_STATUSES.includes(status);

// Status descriptions for UI
const BUDGET_STATUS_DESCRIPTIONS = {
  [BUDGET_STATUS.DRAFT]: 'Draft - Not yet finalized',
  [BUDGET_STATUS.ACTIVE]: 'Active - Currently in use',
  [BUDGET_STATUS.COMPLETED]: 'Completed - Period ended',
  [BUDGET_STATUS.CANCELLED]: 'Cancelled - Not in use'
};

module.exports = {
  // Status constants
  BUDGET_STATUS,
  PROJECT_STATUS,
  ACCOUNT_STATUS,
  
  // Validation arrays
  ALL_BUDGET_STATUSES,
  ALL_PROJECT_STATUSES,
  ALL_ACCOUNT_STATUSES,
  
  // Validation functions
  isValidBudgetStatus,
  isValidProjectStatus,
  isValidAccountStatus,
  
  // Descriptions
  BUDGET_STATUS_DESCRIPTIONS
};
