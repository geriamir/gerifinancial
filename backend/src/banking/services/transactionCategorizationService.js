const { Transaction } = require('../models');
const categoryMappingService = require('./categoryMappingService');
const transactionClassifier = require('./transactionClassifier');
const llmCategorizer = require('./llmCategorizer');
const scrapingQueue = require('../../shared/services/scrapingQueue');
const sseService = require('../../shared/services/sseService');
const aiCostMeter = require('../../shared/services/ai/aiCostMeter');
const config = require('../../shared/config');
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
   * The transactions the model never saw because the budget ran out on an
   * earlier run, newest first.
   *
   * This is what keeps a budget ceiling from being a cliff. Nothing else ever
   * revisits an uncategorised transaction - the queue is fed only by
   * newly-saved ones - so without this, everything past the day's allowance
   * stays uncategorised for good.
   *
   * `category: null` is checked as well as the flag because the user may have
   * categorised it themselves in the meantime, and paying the model to have an
   * opinion about a transaction they have already filed is pure waste.
   */
  async outstanding(userId, limit = config.ai.llm.resumeLimit) {
    if (!limit || limit <= 0) return [];

    try {
      const rows = await Transaction.find({
        userId,
        awaitingModelCategorization: true,
        category: null
      })
        .select('_id')
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      return rows.map((row) => row._id);
    } catch (error) {
      // Resuming is catch-up work. A scrape that saved its transactions has
      // done the part the user is waiting for, and failing it because the
      // backlog could not be read would be a worse outcome than trying again
      // on the next scrape.
      logger.error(`Could not read outstanding categorization for user ${userId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Categorises a batch, reporting progress as it goes, and reports what the
   * batch cost.
   *
   * The cost is the reason for the split: the per-transaction token figure the
   * daily budget is sized against was never anything but an estimate, because
   * every call logged its own tokens and nothing added them up over a run.
   */
  async processBatch({ userId, transactionIds }, job) {
    const { result, cost } = await aiCostMeter.measure(
      () => this.runBatch({ userId, transactionIds }, job)
    );

    // Only when something was actually spent. With AI switched off every batch
    // would otherwise log a line saying nothing was spent, and this line exists
    // to be found in the logs of the one import worth measuring.
    if (cost.calls > 0) {
      // Loading the corpus costs tokens before any transaction is looked at, so
      // an empty batch can still spend - and dividing by it would print the
      // Infinity that makes the whole line untrustworthy.
      const perTransaction = transactionIds.length
        ? ` perTransaction=${(cost.tokens / transactionIds.length).toFixed(1)}`
        : '';
      logger.info(
        `Categorization cost user=${userId} transactions=${transactionIds.length} ` +
        `tokens=${cost.tokens} calls=${cost.calls}${perTransaction} ` +
        `(${cost.breakdown})`
      );
    }

    return result;
  }

  async runBatch({ userId, transactionIds }, job) {
    const corpus = await transactionClassifier.forUser(userId);
    const catalogue = await llmCategorizer.forUser(userId);
    // Clients are keyed by the string form of the id, and the job payload may
    // hold either that or an ObjectId depending on the caller. Emitting with
    // the wrong one finds no client and drops the event silently.
    const userIdStr = userId.toString();
    const results = { categorized: 0, uncategorized: 0, failed: 0 };
    // The ids, not just the count. A transaction can only be matched to a
    // project once it has a category to match a budget line with, so this batch
    // is the first moment the question can be asked - and asking about only
    // what just changed keeps a scrape from re-examining the whole history.
    const categorizedIds = [];

    let settled = 0;
    const report = async (force = false) => {
      if (!force && settled % 10 !== 0) return;
      // An empty batch is trivially finished, and 0/0 would otherwise hand the
      // progress bar a NaN it never recovers from.
      const percent = transactionIds.length === 0
        ? 100
        : Math.round((settled / transactionIds.length) * 100);
      // The job only exists while the queue is driving this. Whether the user
      // is told how far along their transactions are should not depend on
      // which caller happens to be running the batch.
      await job?.updateProgress(percent);
      sseService.emit(userIdStr, 'categorization:progress', {
        processed: settled,
        total: transactionIds.length,
        ...results
      });
    };

    // First pass: everything the cheap tiers can place. Whatever they cannot is
    // held back rather than asked about one at a time, so the model sees them
    // together and the category list is sent once instead of once each.
    const deferred = [];
    for (const transactionId of transactionIds) {
      try {
        const transaction = await Transaction.findById(transactionId);
        // Gone, or already dealt with by the user while this sat in the queue.
        if (!transaction || transaction.category) {
          settled += 1;
          await report();
          continue;
        }

        const updated = await categoryMappingService.attemptAutoCategorization(
          transaction, { corpus, catalogue, deferModel: true }
        );

        // Not finished - it still has the model tier to come, and counting it
        // now would mean reporting a total that later has to move backwards.
        if (updated === categoryMappingService.DEFERRED) {
          deferred.push(transaction);
          continue;
        }

        if (updated?.category) {
          results.categorized += 1;
          categorizedIds.push(transaction._id);
        } else results.uncategorized += 1;
      } catch (error) {
        // One unparseable transaction must not cost the rest of the batch.
        results.failed += 1;
        logger.warn(`Could not categorize transaction ${transactionId}: ${error.message}`);
      }

      settled += 1;
      await report();
    }

    if (deferred.length > 0) {
      await llmCategorizer.prefetch(catalogue, deferred.map(
        (transaction) => categoryMappingService.toModelRequest(transaction)
      ));

      // Second pass reads the answers the prefetch already collected, so this
      // loop normally makes no requests at all.
      for (const transaction of deferred) {
        try {
          const updated = await categoryMappingService.finishDeferred(transaction, catalogue);
          // Deleted, or the user categorised it while the model was answering.
          // Counted as neither, exactly as the first pass counts one they had
          // already dealt with.
          if (updated !== categoryMappingService.SKIPPED) {
            if (updated?.category) {
              results.categorized += 1;
              categorizedIds.push(transaction._id);
            } else results.uncategorized += 1;
          }
        } catch (error) {
          results.failed += 1;
          logger.warn(`Could not categorize transaction ${transaction._id}: ${error.message}`);
        }

        settled += 1;
        await report();
      }
    }

    await report(true);

    sseService.emit(userIdStr, 'categorization:completed', {
      total: transactionIds.length,
      ...results
    });

    logger.info(
      `Categorized ${results.categorized}/${transactionIds.length} transactions for user ${userId} ` +
      `(${results.uncategorized} left for the user, ${results.failed} failed)`
    );

    await this.offerToProjects(userId, userIdStr, categorizedIds);

    return results;
  }

  /**
   * Offers what was just categorised to whichever projects could own it.
   *
   * Runs after the completion event rather than before it, because the user is
   * waiting to be told their transactions are categorised and should not also
   * be waiting on a model deciding which of them belong to a renovation.
   *
   * Required lazily so that banking does not load the project-budgets subsystem
   * at startup - the matcher reads banking's own Transaction model, and taking
   * the dependency at require time would close the loop.
   */
  async offerToProjects(userId, userIdStr, categorizedIds) {
    if (categorizedIds.length === 0) return;

    try {
      const matcher = require('../../project-budgets/services/projectTransactionMatcher');
      const { added } = await matcher.matchNewlyCategorized(userId, categorizedIds);
      if (added > 0) {
        sseService.emit(userIdStr, 'projects:suggestions', { added });
      }
    } catch (error) {
      // Suggestions are an extra. A scrape that categorised everything correctly
      // has succeeded whether or not anything could be offered to a project.
      logger.error(`Could not offer transactions to projects: ${error.message}`);
    }
  }

  registerProcessor() {
    scrapingQueue.registerProcessor(JOB_TYPE, this.processBatch.bind(this));
  }
}

module.exports = new TransactionCategorizationService();
module.exports.JOB_TYPE = JOB_TYPE;
