const CategorizationMethod = {
  MANUAL: 'manual',
  PREVIOUS_DATA: 'previous_data',
  AI: 'ai'
};

const TransactionStatus = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  ERROR: 'error'
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
