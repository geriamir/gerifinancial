const UnplannedExpense = require('../../models/UnplannedExpense');

/**
 * Service for creating and managing UnplannedExpense objects
 */
class UnplannedExpenseService {
  
  /**
   * Create an UnplannedExpense for a regular (non-installment) transaction
   * @param {Object} transaction - Transaction document
   * @param {number} convertedAmount - Amount converted to project currency
   * @param {number} exchangeRate - Exchange rate used
   * @returns {UnplannedExpense}
   */
  createRegularExpense(transaction, convertedAmount, exchangeRate) {
    return new UnplannedExpense({
      transactionId: transaction._id.toString(),
      transaction: transaction,
      originalAmount: Math.abs(transaction.amount),
      originalCurrency: transaction.currency,
      convertedAmount: convertedAmount,
      exchangeRate: exchangeRate,
      transactionDate: transaction.processedDate,
      categoryId: transaction.category._id.toString(),
      subCategoryId: transaction.subCategory._id.toString(),
      category: transaction.category,
      subCategory: transaction.subCategory,
      isInstallmentGroup: false,
      installmentCount: 1
    });
  }
  
  /**
   * Create an UnplannedExpense for grouped installment transactions
   * @param {Object} options - Configuration object
   * @param {Object} options.earliestInstallment - The earliest installment transaction (used as base)
   * @param {Array<Object>} options.allInstallments - All related installment transactions
   * @param {number} options.totalOriginalAmount - Sum of all original amounts
   * @param {number} options.totalConvertedAmount - Sum of all converted amounts
   * @param {Array<string>} options.installmentIds - Array of all installment transaction IDs
   * @returns {UnplannedExpense}
   */
  createInstallmentGroupExpense({
    earliestInstallment,
    allInstallments,
    totalOriginalAmount,
    totalConvertedAmount,
    installmentIds
  }) {
    // Generate unique group ID (using double dash to separate identifier from amount)
    // Clean the identifier to remove any trailing dashes to ensure consistent format
    const cleanIdentifier = earliestInstallment.identifier.toString().replace(/-+$/, '');
    const groupId = `installment-group-${cleanIdentifier}--${earliestInstallment.rawData.originalAmount}`;
    
    // Calculate average exchange rate
    const averageExchangeRate = totalOriginalAmount > 0 ? totalConvertedAmount / totalOriginalAmount : 1;
    
    // Create enhanced transaction object with grouping metadata
    const enhancedTransaction = {
      ...earliestInstallment.toObject(),
      description: earliestInstallment.description || earliestInstallment.chargedAccount,
      isInstallmentGroup: true,
      installmentCount: allInstallments.length,
      installmentIds: installmentIds,
      groupedTransactions: allInstallments.map(inst => ({
        id: inst._id.toString(),
        amount: inst.amount,
        date: inst.processedDate,
        description: inst.description || inst.chargedAccount
      }))
    };
    
    return new UnplannedExpense({
      transactionId: groupId,
      transaction: enhancedTransaction,
      originalAmount: totalOriginalAmount,
      originalCurrency: earliestInstallment.currency,
      convertedAmount: totalConvertedAmount,
      exchangeRate: averageExchangeRate,
      transactionDate: earliestInstallment.processedDate,
      categoryId: earliestInstallment.category._id.toString(),
      subCategoryId: earliestInstallment.subCategory._id.toString(),
      category: earliestInstallment.category,
      subCategory: earliestInstallment.subCategory,
      isInstallmentGroup: true,
      installmentCount: allInstallments.length
    });
  }
  
  /**
   * Create UnplannedExpense with recommendations
   * @param {Object} expenseData - Data for creating the expense
   * @param {Array<Object>} recommendations - Array of recommendation objects
   * @returns {UnplannedExpense}
   */
  createWithRecommendations(expenseData, recommendations = []) {
    const expense = new UnplannedExpense(expenseData);
    expense.setRecommendations(recommendations);
    return expense;
  }
  
  /**
   * Validate expense data before creation
   * @param {Object} data - Data to validate
   * @returns {boolean} - True if valid
   * @throws {Error} - If validation fails
   */
  validateExpenseData(data) {
    const required = [
      'transactionId', 'transaction', 'originalAmount', 'originalCurrency',
      'convertedAmount', 'exchangeRate', 'transactionDate',
      'categoryId', 'subCategoryId', 'category', 'subCategory'
    ];
    
    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        throw new Error(`UnplannedExpenseService: Required field '${field}' is missing`);
      }
    }
    
    return true;
  }
  
  /**
   * Convert multiple transaction objects to UnplannedExpense objects
   * @param {Array<Object>} transactions - Array of transaction objects
   * @param {Function} conversionFn - Function to convert each transaction
   * @returns {Array<UnplannedExpense>}
   */
  async createMultiple(transactions, conversionFn) {
    const expenses = [];
    
    for (const transaction of transactions) {
      try {
        const expense = await conversionFn(transaction);
        if (expense instanceof UnplannedExpense) {
          expenses.push(expense);
        }
      } catch (error) {
        console.warn(`Failed to create UnplannedExpense for transaction ${transaction._id}:`, error.message);
      }
    }
    
    return expenses;
  }
}

module.exports = new UnplannedExpenseService();
