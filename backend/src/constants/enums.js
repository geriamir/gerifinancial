const CategorizationMethod = {
  MANUAL: 'manual',
  PREVIOUS_DATA: 'previous_data',
  AI: 'ai'
};

const TransactionStatus = {
  VERIFIED: 'verified',  // For transactions in permanent storage
  ERROR: 'error',       // For failed transactions
  DUPLICATE: 'duplicate' // For duplicate transactions within scraping session
};

const TransactionType = {
  EXPENSE: 'Expense',
  INCOME: 'Income',
  TRANSFER: 'Transfer'
};

const ScrapingSessionStatus = {
  ACTIVE: 'active',     // Currently processing transactions
  COMPLETED: 'completed', // Successfully finished
  ERROR: 'error'        // Failed with error
};

module.exports = {
  CategorizationMethod,
  TransactionStatus,
  TransactionType,
  ScrapingSessionStatus
};
