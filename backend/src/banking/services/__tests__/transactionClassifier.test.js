const mongoose = require('mongoose');
const transactionClassifier = require('../transactionClassifier');
const { UserCorpus, _internals } = require('../transactionClassifier');
const ManualCategorized = require('../../models/ManualCategorized');
const llmService = require('../../../shared/services/ai/llmService');
const config = require('../../../shared/config');

const { normalise, textFor } = _internals;

// A tiny hand-built space where "near" and "far" are exact, so a threshold
// change shows up as a test failure rather than as a flake.
const GROCERIES = [1, 0, 0, 0];
const NEARLY_GROCERIES = [0.99, 0.141, 0, 0];
const COFFEE = [0, 1, 0, 0];
const UNRELATED = [0, 0, 1, 0];

describe('transactionClassifier', () => {
  let userId;
  let categoryId;
  let subCategoryId;
  let otherCategoryId;
  const originalDeployment = config.ai.embeddingDeployment;

  beforeEach(async () => {
    userId = new mongoose.Types.ObjectId();
    categoryId = new mongoose.Types.ObjectId();
    subCategoryId = new mongoose.Types.ObjectId();
    otherCategoryId = new mongoose.Types.ObjectId();
    config.ai.embeddingDeployment = 'text-embedding-3-small';
    llmService.__reset();
    llmService.__setEnabled(true);
    await ManualCategorized.deleteMany({});
  });

  afterAll(() => {
    config.ai.embeddingDeployment = originalDeployment;
    llmService.__reset();
  });

  const correction = (description, overrides = {}) =>
    ManualCategorized.create({
      description,
      userId,
      category: categoryId,
      subCategory: subCategoryId,
      ...overrides
    });

  describe('textFor', () => {
    it('builds the same string from a correction and from a transaction', () => {
      expect(textFor({ description: 'שופרסל דיל', memo: 'סניף רמת גן' }))
        .toBe('שופרסל דיל סניף רמת גן');
    });

    it('omits a missing memo rather than leaving a gap', () => {
      expect(textFor({ description: 'רמי לוי', memo: null })).toBe('רמי לוי');
      expect(textFor({ description: 'רמי לוי' })).toBe('רמי לוי');
    });
  });

  describe('normalise', () => {
    it('scales a vector to unit length', () => {
      const unit = normalise([3, 4]);
      expect(Math.hypot(...unit)).toBeCloseTo(1);
    });

    // Dividing by a zero magnitude yields NaN, which then silently wins or
    // loses every comparison it takes part in.
    it('refuses a zero vector instead of producing NaN', () => {
      expect(normalise([0, 0, 0])).toBeNull();
    });
  });

  describe('forUser', () => {
    it('stands down when embeddings are not configured', async () => {
      llmService.__setEnabled(false);
      await correction('שופרסל דיל');

      expect(await transactionClassifier.forUser(userId)).toBeNull();
      expect(llmService.embed).not.toHaveBeenCalled();
    });

    // Without a deployment name there is nothing to tag a vector with, and an
    // untagged vector cannot be told apart from one produced by another model.
    it('stands down when no deployment is named', async () => {
      config.ai.embeddingDeployment = undefined;
      await correction('שופרסל דיל');

      expect(await transactionClassifier.forUser(userId)).toBeNull();
      expect(llmService.embed).not.toHaveBeenCalled();
    });

    it('returns an empty corpus for a user who has corrected nothing', async () => {
      const corpus = await transactionClassifier.forUser(userId);

      expect(corpus.size).toBe(0);
      expect(llmService.embed).not.toHaveBeenCalled();
    });

    // The field is select:false so it never rides along on unrelated reads;
    // this is the one place that has to opt back in.
    it('embeds corrections that have no vector and persists them', async () => {
      await correction('שופרסל דיל');

      const corpus = await transactionClassifier.forUser(userId);
      expect(corpus.size).toBe(1);

      const stored = await ManualCategorized.findOne({ userId })
        .select('+descriptionEmbedding')
        .lean();
      expect(stored.descriptionEmbedding).toHaveLength(8);
      expect(stored.embeddingModel).toBe(config.ai.embeddingDeployment);
    });

    it('does not re-embed on a second load', async () => {
      await correction('שופרסל דיל');
      await transactionClassifier.forUser(userId);
      expect(llmService.embed).toHaveBeenCalledTimes(1);

      const corpus = await transactionClassifier.forUser(userId);
      expect(llmService.embed).toHaveBeenCalledTimes(1);
      expect(corpus.size).toBe(1);
    });

    it('embeds a whole backlog in one request rather than one each', async () => {
      await Promise.all([
        correction('שופרסל דיל'),
        correction('רמי לוי'),
        correction('יינות ביתן')
      ]);

      await transactionClassifier.forUser(userId);

      expect(llmService.embed).toHaveBeenCalledTimes(1);
      expect(llmService.embed.mock.calls[0][0].texts).toHaveLength(3);
    });

    // A vector from another model describes a different space; comparing across
    // the two would return confident nonsense.
    it('re-embeds vectors left behind by a previous model', async () => {
      await correction('שופרסל דיל', {
        descriptionEmbedding: [1, 0, 0, 0],
        embeddingModel: 'some-older-model'
      });

      await transactionClassifier.forUser(userId);

      expect(llmService.embed).toHaveBeenCalledTimes(1);
      const stored = await ManualCategorized.findOne({ userId })
        .select('+descriptionEmbedding')
        .lean();
      expect(stored.embeddingModel).toBe(config.ai.embeddingDeployment);
      expect(stored.descriptionEmbedding).toHaveLength(8);
    });

    it('leaves another user\'s corrections out of the corpus', async () => {
      await correction('שופרסל דיל');
      await ManualCategorized.create({
        description: 'רמי לוי',
        userId: new mongoose.Types.ObjectId(),
        category: otherCategoryId
      });

      const corpus = await transactionClassifier.forUser(userId);

      expect(corpus.size).toBe(1);
      expect(corpus.entries[0].description).toBe('שופרסל דיל');
    });

    // Categorisation runs inside a scrape. An AI outage must cost accuracy,
    // never the scrape itself.
    it('survives the embedding service being down', async () => {
      await correction('שופרסל דיל');
      llmService.embed.mockRejectedValueOnce(new Error('503 Service Unavailable'));

      const corpus = await transactionClassifier.forUser(userId);

      expect(corpus.size).toBe(0);
    });

    // A failed backfill leaves the old vector in place. Using it anyway would
    // compare two different embedding spaces and call the result a match.
    it('leaves a correction out while its vector is from another model', async () => {
      await correction('שופרסל דיל', {
        descriptionEmbedding: [1, 0, 0, 0],
        embeddingModel: 'some-older-model'
      });
      llmService.embed.mockRejectedValueOnce(new Error('503 Service Unavailable'));

      const corpus = await transactionClassifier.forUser(userId);

      expect(corpus.size).toBe(0);
    });
  });

  describe('suggestFrom', () => {
    const corpusOf = (entries) =>
      new UserCorpus(
        userId,
        entries.map(({ vector, category, subCategory, description }) => ({
          vector: normalise(vector),
          category: category || categoryId,
          subCategory: subCategory === undefined ? subCategoryId : subCategory,
          description: description || 'past correction',
          matchCount: 1
        }))
      );

    const ask = (corpus, description, vector) => {
      llmService.__setEmbedding(description, vector);
      return transactionClassifier.suggestFrom(corpus, { description });
    };

    it('returns nothing when the user has corrected nothing yet', async () => {
      expect(await transactionClassifier.suggestFrom(corpusOf([]), { description: 'שופרסל' })).toBeNull();
      expect(llmService.embed).not.toHaveBeenCalled();
    });

    it('returns nothing when there is no corpus at all', async () => {
      expect(await transactionClassifier.suggestFrom(null, { description: 'שופרסל' })).toBeNull();
    });

    it('picks up a description close to a past correction', async () => {
      const corpus = corpusOf([{ vector: GROCERIES, description: 'שופרסל דיל' }]);

      const suggestion = await ask(corpus, 'שופרסל שלי רמת גן', NEARLY_GROCERIES);

      expect(suggestion.categoryId).toBe(categoryId);
      expect(suggestion.subCategoryId).toBe(subCategoryId);
      expect(suggestion.reasoning).toContain('שופרסל דיל');
    });

    // The whole point of the tier: a wrong answer is worse than none, because
    // an empty category is visible and a plausible wrong one is not.
    it('declines a description unlike anything the user has corrected', async () => {
      const corpus = corpusOf([{ vector: GROCERIES, description: 'שופרסל דיל' }]);

      expect(await ask(corpus, 'תשלום למס הכנסה', UNRELATED)).toBeNull();
    });

    it('declines when the neighbours disagree', async () => {
      const corpus = corpusOf([
        { vector: GROCERIES, category: categoryId, description: 'שופרסל' },
        { vector: NEARLY_GROCERIES, category: otherCategoryId, subCategory: null, description: 'ארומה' }
      ]);

      expect(await ask(corpus, 'משהו באמצע', GROCERIES)).toBeNull();
    });

    it('lets the closer neighbour outvote a further one', async () => {
      const corpus = corpusOf([
        { vector: GROCERIES, category: categoryId, description: 'שופרסל' },
        { vector: GROCERIES, category: categoryId, description: 'רמי לוי' },
        { vector: NEARLY_GROCERIES, category: otherCategoryId, subCategory: null, description: 'ארומה' }
      ]);

      const suggestion = await ask(corpus, 'יינות ביתן', GROCERIES);

      expect(suggestion.categoryId).toBe(categoryId);
      expect(suggestion.confidence).toBeGreaterThan(config.ai.knn.minConfidence);
    });

    it('considers no more neighbours than configured', async () => {
      const entries = Array.from({ length: config.ai.knn.neighbours + 3 }, (_, i) => ({
        vector: GROCERIES,
        description: `correction ${i}`
      }));

      const suggestion = await ask(corpusOf(entries), 'שופרסל', GROCERIES);

      expect(suggestion.reasoning).toContain(`${config.ai.knn.neighbours} neighbour(s)`);
    });

    it('keeps a category-only correction category-only', async () => {
      const corpus = corpusOf([
        { vector: GROCERIES, subCategory: null, description: 'משכורת' }
      ]);

      const suggestion = await ask(corpus, 'משכורת ינואר', GROCERIES);

      expect(suggestion.categoryId).toBe(categoryId);
      expect(suggestion.subCategoryId).toBeNull();
    });

    it('returns nothing for a transaction with no text to match on', async () => {
      const corpus = corpusOf([{ vector: GROCERIES }]);

      expect(await transactionClassifier.suggestFrom(corpus, { description: '' })).toBeNull();
      expect(llmService.embed).not.toHaveBeenCalled();
    });

    it('returns nothing when the query cannot be embedded', async () => {
      const corpus = corpusOf([{ vector: GROCERIES }]);
      llmService.embed.mockRejectedValueOnce(new Error('429 Too Many Requests'));

      expect(await transactionClassifier.suggestFrom(corpus, { description: 'שופרסל' })).toBeNull();
    });

    it('matches on description and memo together', async () => {
      const corpus = corpusOf([{ vector: COFFEE, description: 'ארומה' }]);
      llmService.__setEmbedding('ארומה תל אביב', COFFEE);

      const suggestion = await transactionClassifier.suggestFrom(corpus, {
        description: 'ארומה',
        memo: 'תל אביב'
      });

      expect(suggestion).not.toBeNull();
      expect(llmService.embed.mock.calls[0][0].texts).toEqual(['ארומה תל אביב']);
    });
  });

  describe('suggest', () => {
    it('loads the corpus and matches in one call', async () => {
      await correction('שופרסל דיל');
      llmService.__setEmbedding('שופרסל דיל', GROCERIES);
      llmService.__setEmbedding('שופרסל שלי', NEARLY_GROCERIES);

      const suggestion = await transactionClassifier.suggest({
        userId,
        description: 'שופרסל שלי'
      });

      expect(suggestion.categoryId.toString()).toBe(categoryId.toString());
    });

    it('returns nothing when embeddings are unavailable', async () => {
      llmService.__setEnabled(false);
      await correction('שופרסל דיל');

      expect(await transactionClassifier.suggest({ userId, description: 'שופרסל' })).toBeNull();
    });
  });
});
