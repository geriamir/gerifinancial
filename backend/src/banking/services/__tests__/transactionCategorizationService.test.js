const mongoose = require('mongoose');
const transactionCategorizationService = require('../transactionCategorizationService');
const categoryMappingService = require('../categoryMappingService');
const transactionClassifier = require('../transactionClassifier');
const llmCategorizer = require('../llmCategorizer');
const scrapingQueue = require('../../../shared/services/scrapingQueue');
const sseService = require('../../../shared/services/sseService');
const { Transaction, Category, SubCategory } = require('../../models');
const ManualCategorized = require('../../models/ManualCategorized');
const { User } = require('../../../auth');
const llmService = require('../../../shared/services/ai/llmService');
const { AiBudgetExceededError } = require('../../../shared/services/ai/aiBudget');
const config = require('../../../shared/config');
const logger = require('../../../shared/utils/logger');
const { createTestUser } = require('../../../test/testUtils');
const { TransactionStatus, TransactionType, CategorizationMethod } = require('../../constants/enums');

describe('transactionCategorizationService', () => {
  let user;
  let category;

  beforeEach(async () => {
    const testData = await createTestUser(User, { email: `cat${Date.now()}@example.com` });
    user = testData.user;
    category = await Category.create({ name: 'Food', type: 'Expense', userId: user._id });
    jest.restoreAllMocks();
  });

  const makeTransaction = (description = 'Some Shop') =>
    Transaction.create({
      identifier: `tx-${Math.random()}`,
      accountId: new mongoose.Types.ObjectId(),
      userId: user._id,
      amount: -50,
      currency: 'ILS',
      date: new Date(),
      type: TransactionType.EXPENSE,
      description,
      status: TransactionStatus.VERIFIED,
      rawData: { description, chargedAmount: -50 }
    });

  describe('enqueue', () => {
    it('queues one job for the whole batch', async () => {
      const addJob = jest.spyOn(scrapingQueue, 'addJob').mockResolvedValue('job-1');
      const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

      const jobId = await transactionCategorizationService.enqueue(user._id, ids);

      expect(jobId).toBe('job-1');
      expect(addJob).toHaveBeenCalledTimes(1);
      const [jobType, jobData] = addJob.mock.calls[0];
      expect(jobType).toBe('categorize-transactions');
      expect(jobData.transactionIds).toEqual(ids.map((id) => id.toString()));
      expect(jobData.userId).toBe(user._id.toString());
    });

    it('does not queue an empty batch', async () => {
      const addJob = jest.spyOn(scrapingQueue, 'addJob').mockResolvedValue('job-1');

      expect(await transactionCategorizationService.enqueue(user._id, [])).toBeNull();
      expect(addJob).not.toHaveBeenCalled();
    });

    // The transactions are already saved by this point. Reporting a failed sync
    // because the follow-up work could not be queued would be a lie.
    it('does not fail the scrape when the queue is unreachable', async () => {
      jest.spyOn(scrapingQueue, 'addJob').mockRejectedValue(new Error('Redis is down'));

      await expect(
        transactionCategorizationService.enqueue(user._id, [new mongoose.Types.ObjectId()])
      ).resolves.toBeNull();
    });
  });

  describe('processBatch', () => {
    it('loads the corpus once for the whole batch', async () => {
      const forUser = jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      const transactions = await Promise.all([makeTransaction(), makeTransaction(), makeTransaction()]);

      await transactionCategorizationService.processBatch({
        userId: user._id,
        transactionIds: transactions.map((t) => t._id)
      });

      expect(forUser).toHaveBeenCalledTimes(1);
    });

    // The point of the two passes: the category list is nearly the whole prompt
    // and is the same for every transaction, so it is sent once rather than once
    // per transaction that the cheap tiers could not place.
    describe('asking the model about the whole batch at once', () => {
      const seedCatalogue = async () => {
        const catalogue = await llmCategorizer.forUser(user._id);
        jest.spyOn(llmCategorizer, 'forUser').mockResolvedValue(catalogue);
        return catalogue;
      };

      beforeEach(() => {
        jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      });

      const llmCategorizationDefault = config.ai.llm.categorization;
      afterEach(() => {
        config.ai.llm.categorization = llmCategorizationDefault;
      });

      it('collects everything the cheap tiers declined into one prefetch', async () => {
        const catalogue = await seedCatalogue();
        const prefetch = jest.spyOn(llmCategorizer, 'prefetch').mockResolvedValue(undefined);
        const transactions = await Promise.all([
          makeTransaction('שופרסל'), makeTransaction('ארומה'), makeTransaction('דלק')
        ]);

        await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: transactions.map((t) => t._id)
        });

        expect(prefetch).toHaveBeenCalledTimes(1);
        expect(prefetch).toHaveBeenCalledWith(catalogue, expect.arrayContaining([
          expect.objectContaining({ description: 'שופרסל' }),
          expect.objectContaining({ description: 'ארומה' }),
          expect.objectContaining({ description: 'דלק' })
        ]));
      });

      it('does not prefetch when every transaction was already placed', async () => {
        await seedCatalogue();
        const prefetch = jest.spyOn(llmCategorizer, 'prefetch').mockResolvedValue(undefined);
        jest.spyOn(categoryMappingService, 'attemptAutoCategorization')
          .mockResolvedValue({ category: category._id });
        const transaction = await makeTransaction();

        await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: [transaction._id]
        });

        expect(prefetch).not.toHaveBeenCalled();
      });

      it('still counts every transaction once across both passes', async () => {
        await seedCatalogue();
        jest.spyOn(llmCategorizer, 'prefetch').mockResolvedValue(undefined);
        const [placed, deferred] = await Promise.all([makeTransaction(), makeTransaction()]);
        jest.spyOn(categoryMappingService, 'attemptAutoCategorization')
          .mockResolvedValueOnce({ category: category._id })
          .mockResolvedValueOnce(categoryMappingService.DEFERRED);
        jest.spyOn(categoryMappingService, 'finishDeferred').mockResolvedValue(undefined);

        const results = await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: [placed._id, deferred._id]
        });

        expect(results).toEqual({ categorized: 1, uncategorized: 1, failed: 0 });
      });

      // A deferred transaction is not finished, and reporting it as processed
      // would mean a progress total that later has to move backwards.
      it('reports a batch as complete only once the deferred pass has run', async () => {
        await seedCatalogue();
        jest.spyOn(llmCategorizer, 'prefetch').mockResolvedValue(undefined);
        jest.spyOn(categoryMappingService, 'finishDeferred').mockResolvedValue(undefined);
        const emit = jest.spyOn(sseService, 'emit').mockImplementation(() => {});
        const transactions = await Promise.all([makeTransaction(), makeTransaction()]);

        await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: transactions.map((t) => t._id)
        });

        const progress = emit.mock.calls.filter(([, event]) => event === 'categorization:progress');
        expect(progress.at(-1)[2]).toMatchObject({ processed: 2, total: 2 });
        // Monotonic: nothing is ever counted and then uncounted.
        const counts = progress.map(([, , payload]) => payload.processed);
        expect(counts).toEqual([...counts].sort((a, b) => a - b));
      });

      // The prefetch is a real model call taking seconds, and the user is very
      // likely looking at the same uncategorised list while it runs. The
      // document held from the first pass does not know they acted.
      it('does not overwrite a category the user set while the model was answering', async () => {
        config.ai.llm.categorization = true;
        llmService.__setEnabled(true);
        const shopping = await Category.create({ name: 'Shopping', type: 'Expense', userId: user._id });
        await SubCategory.create({
          name: 'Groceries', parentCategory: shopping._id, userId: user._id
        });
        const chosen = await Category.create({ name: 'Chosen', type: 'Expense', userId: user._id });
        await seedCatalogue();
        const transaction = await makeTransaction('שופרסל');

        // The user acts while the request is in flight. Driving it from inside
        // chat rather than mocking prefetch keeps the real batching path -- the
        // cache genuinely fills, and the second pass genuinely reads from it.
        const prefetch = jest.spyOn(llmCategorizer, 'prefetch');
        llmService.chat.mockImplementation(async () => {
          const fresh = await Transaction.findById(transaction._id);
          await fresh.categorize(chosen._id, null, CategorizationMethod.MANUAL);
          return {
            content: JSON.stringify({
              answers: [{ id: 1, category: 'Shopping', subCategory: 'Groceries', confidence: 0.95 }]
            }),
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
          };
        });

        const results = await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: [transaction._id]
        });

        const after = await Transaction.findById(transaction._id);
        expect(after.category).toEqual(chosen._id);
        expect(after.categorizationMethod).toBe(CategorizationMethod.MANUAL);
        // Theirs, not ours - counted the way the first pass counts one they had
        // already dealt with.
        expect(results).toEqual({ categorized: 0, uncategorized: 0, failed: 0 });
        // Guards the test itself: if the transaction stopped being deferred
        // this would pass without ever exercising the second pass.
        expect(prefetch).toHaveBeenCalled();
        expect(llmService.chat).toHaveBeenCalled();
      });

      // An empty batch is a real case: every transaction in the job may have
      // been deleted or categorised by hand before the worker picked it up.
      // Nothing to do is 100% done, and a progress bar fed NaN stops moving.
      it('reports an empty batch as complete rather than NaN', async () => {
        const job = { updateProgress: jest.fn().mockResolvedValue(undefined) };
        const emit = jest.spyOn(sseService, 'emit').mockImplementation(() => {});

        const results = await transactionCategorizationService.processBatch(
          { userId: user._id, transactionIds: [] }, job
        );

        expect(results).toEqual({ categorized: 0, uncategorized: 0, failed: 0 });
        for (const [progress] of job.updateProgress.mock.calls) {
          expect(Number.isFinite(progress)).toBe(true);
        }
        expect(job.updateProgress).toHaveBeenLastCalledWith(100);
        const reported = emit.mock.calls.filter(([, event]) => event === 'categorization:progress');
        for (const [, , payload] of reported) {
          expect(Number.isFinite(payload.processed)).toBe(true);
          expect(Number.isFinite(payload.total)).toBe(true);
        }
      });
    });

    it('counts what it categorized and what it left alone', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      const [first, second] = await Promise.all([makeTransaction(), makeTransaction()]);
      jest.spyOn(categoryMappingService, 'attemptAutoCategorization')
        .mockResolvedValueOnce({ category: category._id })
        .mockResolvedValueOnce(null);

      const results = await transactionCategorizationService.processBatch({
        userId: user._id,
        transactionIds: [first._id, second._id]
      });

      expect(results).toEqual({ categorized: 1, uncategorized: 1, failed: 0 });
    });

    // A job can sit in the queue for a while, and the user may well have
    // categorised the transaction themselves in the meantime.
    it('leaves a transaction the user has since categorized', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      const transaction = await makeTransaction();
      transaction.category = category._id;
      await transaction.save();
      const attempt = jest.spyOn(categoryMappingService, 'attemptAutoCategorization');

      await transactionCategorizationService.processBatch({
        userId: user._id,
        transactionIds: [transaction._id]
      });

      expect(attempt).not.toHaveBeenCalled();
    });

    it('skips a transaction that has been deleted', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      const attempt = jest.spyOn(categoryMappingService, 'attemptAutoCategorization');

      const results = await transactionCategorizationService.processBatch({
        userId: user._id,
        transactionIds: [new mongoose.Types.ObjectId()]
      });

      expect(attempt).not.toHaveBeenCalled();
      expect(results.failed).toBe(0);
    });

    it('carries on after one transaction fails', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      const [first, second] = await Promise.all([makeTransaction(), makeTransaction()]);
      jest.spyOn(categoryMappingService, 'attemptAutoCategorization')
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ category: category._id });

      const results = await transactionCategorizationService.processBatch({
        userId: user._id,
        transactionIds: [first._id, second._id]
      });

      expect(results).toEqual({ categorized: 1, uncategorized: 0, failed: 1 });
    });

    it('tells the user when the batch is done', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      const emit = jest.spyOn(sseService, 'emit').mockImplementation(() => {});
      const transaction = await makeTransaction();

      await transactionCategorizationService.processBatch({
        userId: user._id,
        transactionIds: [transaction._id]
      });

      const complete = emit.mock.calls.find(([, type]) => type === 'categorization:completed');
      expect(complete).toBeDefined();
      expect(complete[2]).toMatchObject({ total: 1 });
    });

    // Clients register under the string form of the id, so an ObjectId here
    // matches nothing and the browser is never told the batch finished.
    it('addresses events to the user id the SSE clients are keyed by', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      const emit = jest.spyOn(sseService, 'emit').mockImplementation(() => {});
      const transaction = await makeTransaction();

      await transactionCategorizationService.processBatch({
        userId: user._id,
        transactionIds: [transaction._id]
      });

      expect(emit).toHaveBeenCalled();
      for (const [addressee] of emit.mock.calls) {
        expect(addressee).toBe(user._id.toString());
      }
    });

    it('reports progress as it goes so the browser can follow along', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      const emit = jest.spyOn(sseService, 'emit').mockImplementation(() => {});
      const transaction = await makeTransaction();

      await transactionCategorizationService.processBatch({
        userId: user._id,
        transactionIds: [transaction._id]
      });

      const progress = emit.mock.calls.find(([, type]) => type === 'categorization:progress');
      expect(progress).toBeDefined();
      expect(progress[2]).toMatchObject({ processed: 1, total: 1 });
    });

    it('reports progress to the job so a stalled batch is visible', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      jest.spyOn(sseService, 'emit').mockImplementation(() => {});
      const transaction = await makeTransaction();
      const job = { updateProgress: jest.fn() };

      await transactionCategorizationService.processBatch(
        { userId: user._id, transactionIds: [transaction._id] },
        job
      );

      expect(job.updateProgress).toHaveBeenCalledWith(100);
    });

    // The daily ceiling has to be picked from a real number, and until now the
    // only evidence was per-call log lines that nobody added up over a run.
    describe('what the run cost', () => {
      const llmDefault = config.ai.llm.categorization;
      const deploymentDefault = config.ai.embeddingDeployment;
      let subCategory;

      beforeEach(async () => {
        config.ai.llm.categorization = true;
        // Embedding is off by default in the suite, and with it off the kNN tier
        // never calls out - so a run would spend only on chat and this would
        // test half of what it claims to.
        config.ai.embeddingDeployment = 'text-embedding-3-small';
        llmService.__setEnabled(true);
        jest.spyOn(sseService, 'emit').mockImplementation(() => {});
        subCategory = await SubCategory.create({
          name: 'Groceries', parentCategory: category._id, userId: user._id
        });
      });

      afterEach(() => {
        config.ai.llm.categorization = llmDefault;
        config.ai.embeddingDeployment = deploymentDefault;
      });

      const answeringBatch = (count) => llmService.__setChatResponse({
        content: JSON.stringify({
          answers: Array.from({ length: count }, (_, index) => ({
            id: index + 1, category: 'Food', subCategory: 'Groceries', confidence: 0.9
          }))
        })
      });

      const costLine = (info) => {
        const call = info.mock.calls.find(([message]) => String(message).startsWith('Categorization cost'));
        return call && call[0];
      };

      // Three different services spend on one run - the classifier embedding the
      // corpus, the classifier embedding each query, the categoriser asking the
      // model - and the total is only worth having if it covers all of them.
      // That is the reason the meter follows the async context rather than being
      // an argument each of them has to remember to pass on.
      it('adds up every service that spent, not just the one that logs', async () => {
        // Hand-picked so the corpus sits far from both transactions: a chance
        // kNN match would place them, the model would never be asked, and this
        // would quietly become a test of something else.
        llmService.__setEmbedding('שופרסל דיל', [1, 0, 0, 0]);
        llmService.__setEmbedding('ארומה', [0, 1, 0, 0]);
        llmService.__setEmbedding('דלק', [0, 0, 1, 0]);
        await ManualCategorized.create({
          description: 'שופרסל דיל',
          userId: user._id,
          category: category._id,
          subCategory: subCategory._id
        });
        answeringBatch(2);
        const transactions = await Promise.all([makeTransaction('ארומה'), makeTransaction('דלק')]);
        const info = jest.spyOn(logger, 'info');

        await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: transactions.map((t) => t._id)
        });

        // One corpus embed and two query embeds, a token each in the mock, plus
        // one batched chat covering both transactions.
        expect(costLine(info)).toContain('tokens=23 calls=4');
        expect(costLine(info)).toContain('categorisation-fallback-batch=20 in 1 call');
        expect(costLine(info)).toContain('categorisation-corpus=1 in 1 call');
        expect(costLine(info)).toContain('categorisation-query=2 in 2 calls');
      });

      // The figure the budget is chosen from, stated outright rather than left
      // to be worked out from two other numbers on the line.
      it('states the per-transaction cost the budget has to be sized against', async () => {
        jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
        answeringBatch(2);
        const transactions = await Promise.all([makeTransaction('ארומה'), makeTransaction('דלק')]);
        const info = jest.spyOn(logger, 'info');

        await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: transactions.map((t) => t._id)
        });

        expect(costLine(info)).toContain('transactions=2');
        expect(costLine(info)).toContain('tokens=20');
        expect(costLine(info)).toContain('perTransaction=10.0');
      });

      // With AI off - which is every environment that has not configured it -
      // this would otherwise be a line per batch reporting that nothing happened.
      it('says nothing at all when the run spent nothing', async () => {
        llmService.__setEnabled(false);
        jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
        const transaction = await makeTransaction();
        const info = jest.spyOn(logger, 'info');

        await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: [transaction._id]
        });

        expect(costLine(info)).toBeUndefined();
      });

      // Loading the corpus spends before any transaction is looked at, so the
      // division genuinely can have a zero in it - and a stray Infinity would
      // discredit the one line this whole change exists to produce.
      it('does not divide by an empty batch', async () => {
        await ManualCategorized.create({
          description: 'שופרסל דיל',
          userId: user._id,
          category: category._id,
          subCategory: subCategory._id
        });
        const info = jest.spyOn(logger, 'info');

        await transactionCategorizationService.processBatch({
          userId: user._id,
          transactionIds: []
        });

        expect(costLine(info)).toContain('transactions=0');
        expect(costLine(info)).not.toContain('Infinity');
        expect(costLine(info)).not.toContain('NaN');
      });
    });
  });

  // The queue is fed only by newly-saved transactions, so without this a
  // transaction the budget cut off before the model ever saw it stays
  // uncategorised for good and the daily ceiling becomes a cliff.
  describe('resuming what the budget cut off', () => {
    const owed = async (description = 'Some Shop', overrides = {}) => {
      const transaction = await makeTransaction(description);
      transaction.awaitingModelCategorization = true;
      Object.assign(transaction, overrides);
      await transaction.save();
      return transaction;
    };

    describe('outstanding', () => {
      it('returns the transactions the model never saw', async () => {
        const waiting = await owed();
        await makeTransaction('never deferred');

        const ids = await transactionCategorizationService.outstanding(user._id);

        expect(ids.map(String)).toEqual([String(waiting._id)]);
      });

      // Paying the model to have an opinion about a transaction the user has
      // already filed themselves is pure waste.
      it('leaves out one the user has categorised in the meantime', async () => {
        await owed('Some Shop', { category: category._id });

        expect(await transactionCategorizationService.outstanding(user._id)).toEqual([]);
      });

      it('does not hand one user another user\'s backlog', async () => {
        await owed();
        const other = await createTestUser(User, { email: `other${Date.now()}@example.com` });

        expect(await transactionCategorizationService.outstanding(other.user._id)).toEqual([]);
      });

      // Enqueuing more than a day's allowance can pay for just runs into the
      // same spent budget and marks them outstanding all over again, so the
      // backlog is taken newest first rather than all at once.
      it('takes the newest first, up to the limit', async () => {
        const older = await owed('older');
        older.date = new Date('2024-01-01');
        await older.save();
        const newer = await owed('newer');
        newer.date = new Date('2024-06-01');
        await newer.save();

        const ids = await transactionCategorizationService.outstanding(user._id, 1);

        expect(ids.map(String)).toEqual([String(newer._id)]);
      });

      // The off switch. `AI_LLM_RESUME_LIMIT=0` has to survive being read from
      // the environment, so config uses `numberFromEnv` rather than `||`.
      it('resumes nothing at all when the limit is zero', async () => {
        await owed();

        expect(await transactionCategorizationService.outstanding(user._id, 0)).toEqual([]);
      });

      // Catching up is not what the user is waiting for; the scrape that saved
      // their transactions has already done that part.
      it('does not fail a scrape when the backlog cannot be read', async () => {
        jest.spyOn(Transaction, 'find').mockImplementation(() => {
          throw new Error('Mongo is down');
        });

        await expect(transactionCategorizationService.outstanding(user._id)).resolves.toEqual([]);
      });
    });

    // The whole point, end to end: a batch that runs out of budget comes back
    // and finishes on the next run instead of being abandoned.
    it('categorises on a later run what the budget cut off on an earlier one', async () => {
      jest.spyOn(transactionClassifier, 'forUser').mockResolvedValue(null);
      await SubCategory.create({ name: 'Groceries', parentCategory: category._id, userId: user._id });
      const llmDefault = config.ai.llm.categorization;
      config.ai.llm.categorization = true;
      llmService.__setEnabled(true);

      try {
        const transactions = await Promise.all([makeTransaction('שופרסל'), makeTransaction('ארומה')]);
        const ids = transactions.map((t) => t._id);
        llmService.__setChatError(new AiBudgetExceededError(user._id, 200000, 200000));

        const first = await transactionCategorizationService.processBatch({ userId: user._id, transactionIds: ids });
        expect(first).toMatchObject({ categorized: 0, uncategorized: 2 });

        const waiting = await transactionCategorizationService.outstanding(user._id);
        expect(waiting.map(String).sort()).toEqual(ids.map(String).sort());

        // Next day: the allowance has rolled over.
        llmService.__setChatResponse({
          content: JSON.stringify({ category: 'Food', subCategory: 'Groceries', confidence: 0.9 })
        });

        const second = await transactionCategorizationService.processBatch({ userId: user._id, transactionIds: waiting });
        expect(second).toMatchObject({ categorized: 2, uncategorized: 0 });

        const saved = await Transaction.find({ _id: { $in: ids } });
        expect(saved.map((t) => t.categorizationMethod)).toEqual([CategorizationMethod.AI, CategorizationMethod.AI]);
        // Cleared, so the backlog drains instead of circling.
        expect(await transactionCategorizationService.outstanding(user._id)).toEqual([]);
      } finally {
        config.ai.llm.categorization = llmDefault;
      }
    });
  });
});
