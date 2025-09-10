/**
 * Budget utility functions for project budget calculations and status determination
 */

/**
 * Determines the budget status based on funding, planned budget, and actual spending
 * @param totalFunding - Total funding available for the project
 * @param totalBudget - Total planned budget for the project
 * @param totalPaid - Total amount already spent/paid
 * @returns Budget status description
 */
export const getBudgetStatus = (
  totalFunding: number,
  totalBudget: number,
  totalPaid: number
): string => {
  if (totalPaid > totalFunding) {
    return "Over Budget";
  } else if (totalPaid > totalBudget && totalPaid <= totalFunding) {
    return "Over Plan";
  } else if (totalBudget > totalFunding) {
    return "Over Planned";
  } else {
    return "On Track";
  }
};
