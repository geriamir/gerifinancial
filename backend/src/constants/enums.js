const CategorizationMethod = {
  MANUAL: 'manual',
  PREVIOUS_DATA: 'previous_data',
  AI: 'ai'
};

const TransactionStatus = {
  VERIFIED: 'verified',  // For transactions in permanent storage
  ERROR: 'error'        // For failed transactions
};

const TransactionType = {
  EXPENSE: 'Expense',
  INCOME: 'Income',
  TRANSFER: 'Transfer'
};

module.exports = {
  CategorizationMethod,
  TransactionStatus,
  TransactionType
};
