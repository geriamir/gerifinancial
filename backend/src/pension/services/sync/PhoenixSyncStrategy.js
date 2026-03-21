const logger = require('../../../shared/utils/logger');
const BaseSyncStrategy = require('../../../banking/services/sync-strategies/BaseSyncStrategy');
const PhoenixApiClient = require('../phoenixApiClient');
const pensionService = require('../pensionService');
const { decrypt } = require('../../../shared/utils/encryption');

/**
 * Sync strategy for Phoenix Insurance (הפניקס).
 * Uses Auth0 passwordless OTP — requires user to provide an OTP code.
 *
 * Flow:
 *   1. Frontend initiates sync → backend sends OTP to user's phone/email
 *   2. User enters OTP in frontend → frontend sends it to backend
 *   3. Backend exchanges OTP for JWT → fetches all products and details
 *
 * This strategy supports two modes:
 *   - Manual sync with OTP (triggered from UI)
 *   - Token-based sync (if a valid JWT is provided, skip OTP)
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
   * Execute sync — called by the scraping job processor.
   * For Phoenix, `options` may include:
   *   - options.phoenixToken: pre-authenticated JWT (skip OTP)
   *   - options.otp + options.connection + options.destination: for OTP verification
   */
  async executeSync(bankAccount, options, context) {
    try {
      logger.info(`${this.icon} Starting Phoenix sync for ${bankAccount._id}`);
      await this.updateStatus(bankAccount._id, { status: 'scraping', ...this.statusUpdates.start });

      const client = new PhoenixApiClient();

      // Authenticate
      if (options.phoenixToken) {
        client.setToken(options.phoenixToken);
      } else if (options.otp && options.connection && options.destination) {
        await client.verifyOtp(options.otp, options.connection, options.destination);
      } else {
        throw new Error('Phoenix sync requires either a token or OTP credentials');
      }

      // Fetch all products
      await this.updateStatus(bankAccount._id, { status: 'scraping', ...this.statusUpdates.fetching });
      const allProducts = await client.getAllProducts();
      logger.info(`Phoenix returned product categories: ${Object.keys(allProducts).join(', ')}`);

      // Process all products (upserts PensionAccount records + snapshots)
      const results = await pensionService.processAllProducts(
        allProducts,
        bankAccount.userId,
        bankAccount._id
      );

      // Fetch detailed data for savings products (gemel, hishtalmut, etc.)
      await this.updateStatus(bankAccount._id, { status: 'scraping', ...this.statusUpdates.details });
      const savingsCategories = ['gemel', 'gemelInvestment', 'hishtalmut', 'lifeSaving', 'pension', 'pizuim'];
      let detailCount = 0;

      for (const category of savingsCategories) {
        const products = allProducts[category];
        if (!Array.isArray(products)) continue;

        for (const product of products) {
          const policyNum = product.policyNumber || product.policyId;
          if (!policyNum) continue;

          try {
            const detail = await client.getAccountDetail(policyNum);
            await pensionService.processAccountDetail(detail, policyNum);
            detailCount++;
          } catch (err) {
            logger.warn(`Failed to fetch detail for ${policyNum}: ${err.message}`);
            results.errors.push(`Detail fetch failed for ${policyNum}: ${err.message}`);
          }
        }
      }

      logger.info(`✅ Phoenix sync completed: ${results.synced} accounts, ${detailCount} details fetched`);

      return {
        pension: results,
        metadata: {
          scrapingTimestamp: new Date().toISOString(),
          accountType: 'phoenix',
          totalAccounts: results.synced,
          detailsFetched: detailCount
        }
      };

    } catch (error) {
      logger.error(`❌ Phoenix sync failed for ${bankAccount._id}: ${error.message}`);
      await this.updateStatus(bankAccount._id, {
        status: 'error',
        ...this.statusUpdates.error(error.message),
        isActive: false
      });
      throw error;
    }
  }
}

module.exports = PhoenixSyncStrategy;
