const { Transaction } = require('../models');
const categoryMappingService = require('./categoryMappingService');
const transactionClassifier = require('./transactionClassifier');
const scrapingQueue = require('../../shared/services/scrapingQueue');
const sseService = require('../../shared/services/sseService');
const logger = require('../../shared/utils/logger');

const JOB_TYPE = 'categorize-transactions';

/**
 * Categorises freshly scraped transactions away from the scrape itself.
 *
 * Doing it inline meant every transaction paid for its own categorisation
 * before the next one could be read, so a scrape took as long as the bank plus
 * the categoriser, and a slow or unavailable categoriser held up the one part of
 * the job the user is actually waiting for - their transactions appearing.
 *
 * Splitting them also lets the whole batch share one load of the user's
 * corrections instead of re-reading and re-checking them per transaction.
 */
class TransactionCategorizationService {
  /**
   * Hands a batch of transaction ids to the queue.
   *
   * Ids rather than documents: by the time the job runs the transaction may
   * have been categorised by hand, and re-reading gives the worker the current
   * state instead of a snapshot taken before the user touched it.
   */
  async enqueue(userId, transactionIds) {
    if (!transactionIds.length) return null;

    try {
      return await scrapingQueue.addJob(
        JOB_TYPE,
        { userId: userId.toString(), transactionIds: transactionIds.map((id) => id.toString()) },
        { priority: 'low', attempts: 2 }
      );
    } catch (error) {
      // A scrape that saved its transactions has done the part that matters.
      // Failing it here would roll nothing back and would tell the user their
      // sync failed when it did not.
      logger.error(`Could not queue categorization for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Categorises a batch, reporting progress as it goes.
   */
  async processBatch({ userId, transactionIds }, job) {
    const corpus = await transactionClassifier.forUser(userId);
    // Clients are keyed by the string form of the id, and the job payload may
    // hold either that or an ObjectId depending on the caller. Emitting with
    // the wrong one finds no client and drops the event silently.
    const userIdStr = userId.toString();
    const results = { categorized: 0, uncategorized: 0, failed: 0 };

    for (let i = 0; i < transactionIds.length; i += 1) {
      try {
        const transaction = await Transaction.findById(transactionIds[i]);
        // Gone, or already dealt with by the user while this sat in the queue.
        if (!transaction || transaction.category) continue;

        const updated = await categoryMappingService.attemptAutoCategorization(transaction, { corpus });
        if (updated?.category) results.categorized += 1;
        else results.uncategorized += 1;
      } catch (error) {
        // One unparseable transaction must not cost the rest of the batch.
        results.failed += 1;
        logger.warn(`Could not categorize transaction ${transactionIds[i]}: ${error.message}`);
      }

      const done = i + 1;
      if (done % 10 === 0 || done === transactionIds.length) {
        // The job only exists while the queue is driving this. Whether the user
        // is told how far along their transactions are should not depend on
        // which caller happens to be running the batch.
        await job?.updateProgress(Math.round((done / transactionIds.length) * 100));
        sseService.emit(userIdStr, 'categorization:progress', {
          processed: done,
          total: transactionIds.length,
          ...results
        });
      }
    }

    sseService.emit(userIdStr, 'categorization:complete', {
      total: transactionIds.length,
      ...results
    });

    logger.info(
      `Categorized ${results.categorized}/${transactionIds.length} transactions for user ${userId} ` +
      `(${results.uncategorized} left for the user, ${results.failed} failed)`
    );

    return results;
  }

  registerProcessor() {
    scrapingQueue.registerProcessor(JOB_TYPE, this.processBatch.bind(this));
  }
}

module.exports = new TransactionCategorizationService();
module.exports.JOB_TYPE = JOB_TYPE;
