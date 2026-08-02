// Banking services internal module
const bankScraperService = require('./bankScraperService');
const dataSyncService = require('./dataSyncService');
const creditCardDetectionService = require('./creditCardDetectionService');
const creditCardOnboardingService = require('./creditCardOnboardingService');
const bankClassificationService = require('./bankClassificationService');
const bankAccountService = require('./bankAccountService');
const transactionService = require('./transactionService');
const categoryMappingService = require('./categoryMappingService');
const transactionClassifier = require('./transactionClassifier');
const tagService = require('./tagService');
const scrapingSchedulerService = require('./scrapingSchedulerService');
const { BaseSyncStrategy, IsraeliScraperSyncStrategy, CheckingAccountsSyncStrategy } = require('./sync-strategies');

module.exports = {
  bankScraperService,
  dataSyncService,
  creditCardDetectionService,
  creditCardOnboardingService,
  bankClassificationService,
  bankAccountService,
  transactionService,
  categoryMappingService,
  transactionClassifier,
  tagService,
  scrapingSchedulerService,
  BaseSyncStrategy,
  IsraeliScraperSyncStrategy,
  CheckingAccountsSyncStrategy
};
