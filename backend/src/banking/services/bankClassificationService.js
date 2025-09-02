const logger = require('../../shared/utils/logger');

/**
 * Service for classifying bank accounts and credit card providers
 * Used to separate checking account setup from credit card setup in onboarding
 */
class BankClassificationService {
  
  /**
   * Get list of Israeli checking account banks
   * @returns {string[]} Array of checking account bank IDs
   */
  static getCheckingBanks() {
    return ['hapoalim', 'leumi', 'discount', 'otsarHahayal'];
  }
  
  /**
   * Get list of Israeli credit card providers
   * @returns {string[]} Array of credit card provider IDs
   */
  static getCreditCardProviders() {
    return ['visaCal', 'max', 'isracard'];
  }
  
  /**
   * Check if a bank ID is a checking account bank
   * @param {string} bankId - Bank identifier
   * @returns {boolean} True if it's a checking account bank
   */
  static isCheckingBank(bankId) {
    return this.getCheckingBanks().includes(bankId);
  }
  
  /**
   * Check if a bank ID is a credit card provider
   * @param {string} bankId - Bank identifier
   * @returns {boolean} True if it's a credit card provider
   */
  static isCreditCardProvider(bankId) {
    return this.getCreditCardProviders().includes(bankId);
  }
  
  /**
   * Get all supported banks (checking + credit card)
   * @returns {string[]} Array of all supported bank IDs
   */
  static getAllSupportedBanks() {
    return [...this.getCheckingBanks(), ...this.getCreditCardProviders()];
  }
  
  /**
   * Validate that a bank ID is supported
   * @param {string} bankId - Bank identifier to validate
   * @returns {boolean} True if bank is supported
   */
  static isSupportedBank(bankId) {
    return this.getAllSupportedBanks().includes(bankId);
  }
  
  /**
   * Get bank type (checking or credit)
   * @param {string} bankId - Bank identifier
   * @returns {string|null} 'checking', 'credit', or null if unsupported
   */
  static getBankType(bankId) {
    if (this.isCheckingBank(bankId)) {
      return 'checking';
    }
    if (this.isCreditCardProvider(bankId)) {
      return 'credit';
    }
    return null;
  }
  
  /**
   * Get banks filtered by type
   * @param {string} type - 'checking' or 'credit'
   * @returns {string[]} Array of bank IDs of specified type
   */
  static getBanksByType(type) {
    switch (type) {
      case 'checking':
        return this.getCheckingBanks();
      case 'credit':
        return this.getCreditCardProviders();
      default:
        logger.warn(`Unknown bank type requested: ${type}`);
        return [];
    }
  }
  
  /**
   * Get human-readable bank names for checking accounts
   * @returns {Object[]} Array of {id, name} objects for checking banks
   */
  static getCheckingBankDetails() {
    return [
      { id: 'hapoalim', name: 'Bank Hapoalim' },
      { id: 'leumi', name: 'Bank Leumi' },
      { id: 'discount', name: 'Discount Bank' },
      { id: 'otsarHahayal', name: 'Otsar HaHayal' }
    ];
  }
  
  /**
   * Get human-readable names for credit card providers
   * @returns {Object[]} Array of {id, name} objects for credit card providers
   */
  static getCreditCardProviderDetails() {
    return [
      { id: 'visaCal', name: 'Visa Cal' },
      { id: 'max', name: 'Max' },
      { id: 'isracard', name: 'Isracard' }
    ];
  }
  
  /**
   * Get bank details by type
   * @param {string} type - 'checking' or 'credit'
   * @returns {Object[]} Array of {id, name} objects
   */
  static getBankDetailsByType(type) {
    switch (type) {
      case 'checking':
        return this.getCheckingBankDetails();
      case 'credit':
        return this.getCreditCardProviderDetails();
      default:
        logger.warn(`Unknown bank type requested: ${type}`);
        return [];
    }
  }
}

module.exports = BankClassificationService;
