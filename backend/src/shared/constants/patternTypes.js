/**
 * Centralized Pattern Type Constants
 * 
 * This file defines all recurrence pattern types used throughout the application
 * to ensure consistency and prevent typos in string literals.
 */

const PATTERN_TYPES = {
  MONTHLY: 'monthly',
  BI_MONTHLY: 'bi-monthly', 
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly'
};

// Array of all pattern types for validation
const ALL_PATTERN_TYPES = Object.values(PATTERN_TYPES);

// Pattern type validation function
const isValidPatternType = (type) => {
  return ALL_PATTERN_TYPES.includes(type);
};

// Pattern interval mapping (in months)
const PATTERN_INTERVALS = {
  [PATTERN_TYPES.MONTHLY]: 1,
  [PATTERN_TYPES.BI_MONTHLY]: 2,
  [PATTERN_TYPES.QUARTERLY]: 3,
  [PATTERN_TYPES.YEARLY]: 12
};

// Pattern description mapping for UI
const PATTERN_DESCRIPTIONS = {
  [PATTERN_TYPES.MONTHLY]: 'Every month',
  [PATTERN_TYPES.BI_MONTHLY]: 'Every 2 months',
  [PATTERN_TYPES.QUARTERLY]: 'Every 3 months (quarterly)',
  [PATTERN_TYPES.YEARLY]: 'Once per year'
};

module.exports = {
  PATTERN_TYPES,
  ALL_PATTERN_TYPES,
  isValidPatternType,
  PATTERN_INTERVALS,
  PATTERN_DESCRIPTIONS
};
