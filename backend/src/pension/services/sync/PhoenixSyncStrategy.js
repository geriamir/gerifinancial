const BaseSyncStrategy = require('../../../banking/services/sync-strategies/BaseSyncStrategy');

/**
 * Sync strategy for Phoenix Insurance (הפניקס).
 * Phoenix requires interactive OTP login via browser — it cannot be run
 * from the job queue. All syncing is done through the pension OTP routes.
 */
class PhoenixSyncStrategy extends BaseSyncStrategy {
  constructor() {
    super({
      name: 'phoenix-pension',
      displayName: 'Phoenix Insurance (הפניקס)',
      icon: '🔥',
      statusUpdates: {
        start: { progress: 10, message: 'Connecting to Phoenix Insurance...' },
        fetching: { progress: 40, message: 'Fetching pension accounts...' },
        details: { progress: 70, message: 'Loading account details...' },
        error: (error) => ({ progress: 0, message: `Phoenix sync failed: ${error}` })
      }
    });
  }

  getEmptyResult() {
    return { pension: { synced: 0, errors: [] } };
  }

  /**
   * Phoenix only syncs via the OTP browser flow (pension routes).
   * This strategy cannot be run from the job queue.
   */
  async executeSync() {
    throw new Error('Phoenix sync requires OTP. Use the Sync (OTP) button on the Banks page.');
  }
}

module.exports = PhoenixSyncStrategy;
