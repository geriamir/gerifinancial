const mongoose = require('mongoose');
const transactionCategorizationService = require('../transactionCategorizationService');
const categoryMappingService = require('../categoryMappingService');
const transactionClassifier = require('../transactionClassifier');
const llmCategorizer = require('../llmCategorizer');
const scrapingQueue = require('../../../shared/services/scrapingQueue');
const sseService = require('../../../shared/services/sseService');
const { Transaction, Category, SubCategory } = require('../../models');
const { User } = require('../../../auth');
const llmService = require('../../../shared/services/ai/llmService');
const config = require('../../../shared/config');
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
  });
});
