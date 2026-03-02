// Banking subsystem public interface

// Models (used by other subsystems)
const { Transaction, BankAccount, CreditCard, Tag, ManualCategorized, TransactionExclusion, Category, SubCategory } = require('./models');

// Services (used by other subsystems)
const bankScraperService = require('./services/bankScraperService');
const dataSyncService = require('./services/dataSyncService');
const queuedDataSyncService = require('./services/queuedDataSyncService');
const creditCardDetectionService = require('./services/creditCardDetectionService');
const creditCardOnboardingService = require('./services/creditCardOnboardingService');
const bankClassificationService = require('./services/bankClassificationService');
const bankAccountService = require('./services/bankAccountService');
const transactionService = require('./services/transactionService');
const creditCardService = require('./services/creditCardService');
const scrapingEvents = require('./services/scrapingEvents');

// Sync strategies (used by other subsystems)
const { BaseSyncStrategy, CheckingAccountsSyncStrategy } = require('./services/sync-strategies');

// Constants (used by other subsystems)
const { TransactionType } = require('./constants/enums');

// Utils (used by other subsystems)
const installmentGroupingUtils = require('./utils/installmentGroupingUtils');

module.exports = {
  // Models
  Transaction,
  BankAccount,
  CreditCard,
  Tag,
  ManualCategorized,
  TransactionExclusion,
  Category,
  SubCategory,
  
  // Services
  bankScraperService,
  dataSyncService,
  queuedDataSyncService,
  creditCardDetectionService,
  creditCardOnboardingService,
  bankClassificationService,
  bankAccountService,
  transactionService,
  creditCardService,
  scrapingEvents,
  
  // Sync strategies
  BaseSyncStrategy,
  CheckingAccountsSyncStrategy,
  
  // Constants
  TransactionType,
  
  // Utils
  installmentGroupingUtils
};
