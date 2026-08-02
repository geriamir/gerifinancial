const mongoose = require('mongoose');
const transactionCategorizationService = require('../transactionCategorizationService');
const categoryMappingService = require('../categoryMappingService');
const transactionClassifier = require('../transactionClassifier');
const scrapingQueue = require('../../../shared/services/scrapingQueue');
const sseService = require('../../../shared/services/sseService');
const { Transaction, Category } = require('../../models');
const { User } = require('../../../auth');
const { createTestUser } = require('../../../test/testUtils');
const { TransactionStatus, TransactionType } = require('../../constants/enums');

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

      const complete = emit.mock.calls.find(([, type]) => type === 'categorization-complete');
      expect(complete).toBeDefined();
      expect(complete[2]).toMatchObject({ total: 1 });
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
