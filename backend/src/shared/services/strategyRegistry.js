const logger = require('../utils/logger');

/**
 * Global strategy registry — lazy-initialized, safe to call from anywhere.
 * Avoids the startup race where BullMQ workers process stale Redis jobs
 * before mongoose.connect().then() sets up the registry in app.js.
 */
function ensureInitialized() {
  if (global.syncStrategies) return global.syncStrategies;

  const { CheckingAccountsSyncStrategy, MercurySyncStrategy } = require('../../banking/services/sync-strategies');
  const PortfoliosSyncStrategy = require('../../investments/services/sync/PortfoliosSyncStrategy');
  const ForeignCurrencySyncStrategy = require('../../foreign-currency/services/sync/ForeignCurrencySyncStrategy');
  const IBKRFlexSyncStrategy = require('../../investments/services/sync/IBKRFlexSyncStrategy');
  const PhoenixSyncStrategy = require('../../pension/services/sync/PhoenixSyncStrategy');

  global.syncStrategies = {
    'checking-accounts': new CheckingAccountsSyncStrategy(),
    'investment-portfolios': new PortfoliosSyncStrategy(),
    'foreign-currency': new ForeignCurrencySyncStrategy(),
    'mercury-checking': new MercurySyncStrategy(),
    'ibkr-flex': new IBKRFlexSyncStrategy(),
    'phoenix-pension': new PhoenixSyncStrategy()
  };

  logger.info('Sync strategies initialized and registered globally');
  return global.syncStrategies;
}

function getStrategy(name) {
  const registry = ensureInitialized();
  return registry[name] || null;
}

function getAvailableStrategies() {
  const registry = ensureInitialized();
  return Object.keys(registry);
}

module.exports = { ensureInitialized, getStrategy, getAvailableStrategies };
