const { Transaction, Category } = require('../../banking');

const SALARY_EARLY_DAYS = 5;

/**
 * Find the Salary category for a user.
 * Returns null if no Salary category exists.
 */
async function findSalaryCategory(userId) {
  return Category.findOne({ userId, name: 'Salary', type: 'Income' });
}

/**
 * Adjust a month's transactions for salary early-payment attribution.
 * 
 * Salary arriving up to SALARY_EARLY_DAYS before the month starts is attributed
 * to that month (not the previous month). Conversely, salary arriving in the last
 * SALARY_EARLY_DAYS of a month is excluded (it belongs to the next month).
 *
 * @param {Array} transactions - Already-queried transactions for the month
 * @param {string} userId - User ID
 * @param {number} year - Budget year
 * @param {number} month - Budget month (1-indexed)
 * @param {Object} extraFilters - Additional MongoDB filters (e.g., excludeFromBudgetCalculation)
 * @returns {Array} Adjusted transactions array
 */
async function adjustForSalaryEarlyPayment(transactions, userId, year, month, extraFilters = {}) {
  const salaryCategory = await findSalaryCategory(userId);
  if (!salaryCategory) return transactions;

  const salaryCategoryId = salaryCategory._id.toString();

  // Late window: last N days of this month — salary here belongs to NEXT month
  const nextMonthStart = new Date(year, month, 1);
  const lateWindowStart = new Date(nextMonthStart);
  lateWindowStart.setDate(lateWindowStart.getDate() - SALARY_EARLY_DAYS);

  const filtered = transactions.filter(tx => {
    if (!tx.category || !tx.category._id) return true;
    if (tx.category._id.toString() !== salaryCategoryId) return true;
    const txDate = new Date(tx.processedDate);
    return txDate < lateWindowStart;
  });

  // Early window: last N days of previous month — salary here belongs to THIS month
  const monthStart = new Date(year, month - 1, 1);
  const earlyWindowStart = new Date(monthStart);
  earlyWindowStart.setDate(earlyWindowStart.getDate() - SALARY_EARLY_DAYS);
  const earlyWindowEnd = new Date(year, month - 1, 0, 23, 59, 59);

  if (earlyWindowEnd < earlyWindowStart) return filtered;

  const earlySalaryTxns = await Transaction.find({
    userId,
    category: salaryCategory._id,
    processedDate: { $gte: earlyWindowStart, $lte: earlyWindowEnd },
    ...extraFilters
  }).populate('category subCategory tags');

  return [...filtered, ...earlySalaryTxns];
}

module.exports = {
  SALARY_EARLY_DAYS,
  findSalaryCategory,
  adjustForSalaryEarlyPayment
};
