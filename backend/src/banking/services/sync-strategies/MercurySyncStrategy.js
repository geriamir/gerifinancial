const logger = require('../../../shared/utils/logger');
const BaseSyncStrategy = require('./BaseSyncStrategy');
const MercuryApiClient = require('../mercuryApiClient');
const transactionService = require('../transactionService');

/**
 * Sync strategy for Mercury Bank using their public REST API.
 * Does not use israeli-bank-scrapers — calls the Mercury API directly.
 */
class MercurySyncStrategy extends BaseSyncStrategy {
  constructor() {
    super({
      name: 'mercury-checking',
      displayName: 'Mercury Checking Accounts',
      icon: '🏦',
      statusUpdates: {
        start: { progress: 20, message: 'Fetching Mercury account transactions...' },
        error: (error) => ({ progress: 0, message: `Mercury sync failed: ${error}` })
      }
    });
  }

  getEmptyResult() {
    return { transactions: { newTransactions: 0, errors: [] } };
  }

  /**
   * Execute sync by calling the Mercury API directly
   */
  async executeSync(bankAccount, options, context) {
    try {
      logger.info(`${this.icon} Starting Mercury sync for ${bankAccount._id}`);

      if (this.statusUpdates.start) {
        await this.updateStatus(bankAccount._id, {
          status: 'scraping',
          ...this.statusUpdates.start
        });
      }

      const client = new MercuryApiClient(bankAccount.credentials.apiToken);

      // Determine start date from strategy sync or default 6 months back
      const strategyData = bankAccount.strategySync?.['checking-accounts'];
      let startDate;
      if (strategyData?.lastScraped) {
        startDate = strategyData.lastScraped;
      } else {
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
      }

      // Fetch all Mercury accounts
      const mercuryAccounts = await client.getAccounts();
      logger.info(`Mercury returned ${mercuryAccounts.length} accounts`);

      // Fetch transactions for each account and map to scraper format
      const scrapedAccounts = [];
      for (const account of mercuryAccounts) {
        if (account.status !== 'active') continue;

        const transactions = await client.getTransactions(account.id, {
          startDate,
          endDate: new Date()
        });

        logger.info(`Mercury account ${account.name || account.id}: ${transactions.length} transactions`);

        scrapedAccounts.push({
          accountNumber: account.accountNumber || account.id,
          txns: transactions.map(txn => this.mapTransaction(txn))
        });
      }

      // Reuse existing transaction processing pipeline
      const transactionResults = await transactionService.processScrapedTransactions(
        scrapedAccounts,
        bankAccount
      );

      logger.info(`✅ Mercury sync completed for ${bankAccount._id}`);
      return {
        transactions: transactionResults,
        metadata: {
          scrapingTimestamp: new Date().toISOString(),
          accountType: 'mercury',
          totalAccounts: scrapedAccounts.length,
          totalTransactions: scrapedAccounts.reduce((sum, a) => sum + a.txns.length, 0)
        }
      };

    } catch (error) {
      logger.error(`❌ Mercury sync failed for ${bankAccount._id}: ${error.message}`);

      if (this.statusUpdates.error) {
        await this.updateStatus(bankAccount._id, {
          status: 'error',
          ...this.statusUpdates.error(error.message),
          isActive: false
        });
      }

      throw error;
    }
  }

  /**
   * Map a Mercury API transaction to the israeli-bank-scrapers format
   * so it can be processed by transactionService.processScrapedTransactions
   */
  mapTransaction(mercuryTxn) {
    return {
      identifier: mercuryTxn.id,
      date: mercuryTxn.createdAt,
      processedDate: mercuryTxn.postedAt || mercuryTxn.createdAt,
      description: mercuryTxn.counterpartyName || mercuryTxn.bankDescription || 'Mercury Transaction',
      memo: mercuryTxn.note || mercuryTxn.externalMemo || null,
      chargedAmount: mercuryTxn.amount,
      status: mercuryTxn.status === 'pending' ? 'pending' : 'completed',
      rawData: mercuryTxn
    };
  }
}

module.exports = MercurySyncStrategy;
