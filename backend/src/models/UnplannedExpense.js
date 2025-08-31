/**
 * UnplannedExpense - Strongly typed class for representing unplanned expenses in project budgets
 * This is not a Mongoose model but a plain JavaScript class for type safety and consistency
 */
class UnplannedExpense {
  /**
   * Create an UnplannedExpense instance
   * @param {Object} data - The expense data
   * @param {string} data.transactionId - Unique transaction ID (could be grouped ID for installments)
   * @param {Object} data.transaction - Transaction object with all transaction details
   * @param {number} data.originalAmount - Original transaction amount
   * @param {string} data.originalCurrency - Original transaction currency
   * @param {number} data.convertedAmount - Amount converted to project currency
   * @param {number} data.exchangeRate - Exchange rate used for conversion
   * @param {Date} data.transactionDate - Date of the transaction
   * @param {string} data.categoryId - MongoDB ObjectId of the category
   * @param {string} data.subCategoryId - MongoDB ObjectId of the subcategory
   * @param {Object} data.category - Category object with _id and name
   * @param {Object} data.subCategory - SubCategory object with _id and name
   * @param {boolean} [data.isInstallmentGroup=false] - Whether this represents a group of installments
   * @param {number} [data.installmentCount=1] - Number of installments in the group
   * @param {Array<Object>} [data.recommendations=[]] - Smart recommendations for moving to planned categories
   */
  constructor(data) {
    // Validate required fields
    this._validateRequiredFields(data);
    
    // Core identifiers
    this.transactionId = data.transactionId;
    this.transaction = this._processTransactionData(data.transaction);
    
    // Financial data
    this.originalAmount = this._validateNumber(data.originalAmount, 'originalAmount');
    this.originalCurrency = this._validateString(data.originalCurrency, 'originalCurrency');
    this.convertedAmount = this._validateNumber(data.convertedAmount, 'convertedAmount');
    this.exchangeRate = this._validateNumber(data.exchangeRate, 'exchangeRate');
    
    // Date
    this.transactionDate = this._validateDate(data.transactionDate);
    
    // Category data
    this.categoryId = this._validateString(data.categoryId, 'categoryId');
    this.subCategoryId = this._validateString(data.subCategoryId, 'subCategoryId');
    this.category = this._validateCategoryObject(data.category, 'category');
    this.subCategory = this._validateCategoryObject(data.subCategory, 'subCategory');
    
    // Installment grouping (optional)
    this.isInstallmentGroup = Boolean(data.isInstallmentGroup || false);
    this.installmentCount = this._validateNumber(data.installmentCount || 1, 'installmentCount');
    
    // Recommendations (set externally)
    this.recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  }
  
  
  /**
   * Add recommendations to this expense
   * @param {Array<Object>} recommendations - Array of recommendation objects
   */
  setRecommendations(recommendations) {
    this.recommendations = Array.isArray(recommendations) ? recommendations : [];
    return this;
  }
  
  /**
   * Get the best recommendation (highest confidence)
   * @returns {Object|null} - Best recommendation or null if none
   */
  getBestRecommendation() {
    if (this.recommendations.length === 0) return null;
    return this.recommendations.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }
  
  /**
   * Check if this expense has high-confidence recommendations
   * @param {number} [threshold=70] - Confidence threshold
   * @returns {boolean}
   */
  hasHighConfidenceRecommendations(threshold = 70) {
    return this.recommendations.some(rec => rec.confidence >= threshold);
  }
  
  /**
   * Get formatted display information
   * @returns {Object} - Formatted display data
   */
  getDisplayInfo() {
    return {
      id: this.transactionId,
      description: this.transaction.description || this.transaction.chargedAccount || 'Unknown Transaction',
      amount: this.originalAmount,
      currency: this.originalCurrency,
      convertedAmount: this.convertedAmount,
      date: this.transactionDate,
      category: `${this.category.name} → ${this.subCategory.name}`,
      isGroup: this.isInstallmentGroup,
      installmentCount: this.installmentCount,
      hasRecommendations: this.recommendations.length > 0,
      bestRecommendationConfidence: this.getBestRecommendation()?.confidence || 0
    };
  }
  
  /**
   * Convert to plain object for JSON serialization
   * @returns {Object}
   */
  toObject() {
    return {
      transactionId: this.transactionId,
      transaction: this.transaction,
      amount: this.transaction.amount, // Add the transaction amount for compatibility
      originalAmount: this.originalAmount,
      originalCurrency: this.originalCurrency,
      convertedAmount: this.convertedAmount,
      exchangeRate: this.exchangeRate,
      transactionDate: this.transactionDate,
      categoryId: this.categoryId,
      subCategoryId: this.subCategoryId,
      category: this.category,
      subCategory: this.subCategory,
      isInstallmentGroup: this.isInstallmentGroup,
      installmentCount: this.installmentCount,
      recommendations: this.recommendations
    };
  }
  
  /**
   * Convert to JSON string
   * @returns {string}
   */
  toJSON() {
    return this.toObject();
  }
  
  // Private validation methods
  _validateRequiredFields(data) {
    const required = [
      'transactionId', 'transaction', 'originalAmount', 'originalCurrency',
      'convertedAmount', 'exchangeRate', 'transactionDate',
      'categoryId', 'subCategoryId', 'category', 'subCategory'
    ];
    
    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        throw new Error(`UnplannedExpense: Required field '${field}' is missing`);
      }
    }
  }
  
  _validateString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`UnplannedExpense: Field '${fieldName}' must be a non-empty string`);
    }
    return value.trim();
  }
  
  _validateNumber(value, fieldName) {
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      throw new Error(`UnplannedExpense: Field '${fieldName}' must be a non-negative number`);
    }
    return num;
  }
  
  _validateDate(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error('UnplannedExpense: transactionDate must be a valid date');
    }
    return date;
  }
  
  _validateCategoryObject(obj, fieldName) {
    if (!obj || typeof obj !== 'object') {
      throw new Error(`UnplannedExpense: Field '${fieldName}' must be an object`);
    }
    if (!obj._id || !obj.name) {
      throw new Error(`UnplannedExpense: Field '${fieldName}' must have _id and name properties`);
    }
    return {
      _id: obj._id.toString(),
      name: obj.name.toString()
    };
  }
  
  _processTransactionData(transaction) {
    if (!transaction || typeof transaction !== 'object') {
      throw new Error('UnplannedExpense: transaction must be an object');
    }
    
    // Ensure transaction has an _id if it's a Mongoose document
    if (transaction.toObject && typeof transaction.toObject === 'function') {
      return transaction.toObject();
    }
    
    return transaction;
  }
}

module.exports = UnplannedExpense;
