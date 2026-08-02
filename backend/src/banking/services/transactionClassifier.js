const { llmService } = require('../../shared/services/ai');
const logger = require('../../shared/utils/logger');
const config = require('../../shared/config');
const ManualCategorized = require('../models/ManualCategorized');

/**
 * Categorises a transaction by comparing it against the corrections its owner
 * has already made.
 *
 * The rules ahead of this in the cascade match strings: an exact hit against a
 * past correction, or a keyword from the default category tree. They do well on
 * whatever they were written for and nothing else, which is why the
 * highest-frequency Israeli merchants - every supermarket chain, the coffee
 * chains, the delivery apps - come back uncategorised despite the user having
 * categorised them by hand many times under a slightly different string.
 *
 * Matching on meaning instead of characters fixes that class of miss, and it
 * does so from the user's own labels rather than a list someone has to maintain.
 *
 * Similarity is computed here rather than in the database on purpose. The
 * managed Mongo behind this does offer vector search, but adopting it would tie
 * categorisation to that specific product and, more importantly, to something
 * the in-memory Mongo used by the tests cannot emulate - so the tests would stop
 * exercising the real path. At one user's volume the arithmetic is trivial.
 */

// A correction only teaches something if the words it carries are the words a
// future transaction will carry, so the query is built the same way both times.
const textFor = ({ description, memo }) =>
  [description, memo].filter(Boolean).join(' ').trim();

const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
};

const normalise = (vector) => {
  const magnitude = Math.sqrt(dot(vector, vector));
  // A zero vector has no direction to compare, and dividing by its magnitude
  // would poison every later comparison with NaN.
  if (!magnitude) return null;
  return vector.map((value) => value / magnitude);
};

/**
 * One user's corrections, embedded and held in memory for the life of the
 * matcher.
 *
 * Scoped to a batch rather than cached globally with a TTL, because the thing
 * that invalidates it - the user correcting a category - is exactly what this
 * learns from. A stale cache would keep making the mistake the user just fixed,
 * which is the single most visible way for this to feel broken.
 */
class UserCorpus {
  constructor(userId, entries) {
    this.userId = userId;
    this.entries = entries;
  }

  get size() {
    return this.entries.length;
  }

  /**
   * The nearest corrections, best first.
   */
  neighbours(queryVector, limit) {
    return this.entries
      .map((entry) => ({ entry, similarity: dot(queryVector, entry.vector) }))
      .filter((match) => match.similarity >= config.ai.knn.minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}

class TransactionClassifier {
  /**
   * Loads and, where necessary, embeds a user's corrections.
   *
   * Embedding happens here rather than when a correction is saved so that
   * re-categorising a transaction never fails because an AI service is
   * unreachable. The cost is a one-off backfill the first time a user's corpus
   * is used, in a single batched request.
   */
  async forUser(userId) {
    if (!llmService.isEmbeddingEnabled()) return null;

    // Vectors are tagged with the deployment that produced them, and compared
    // against that same tag on the next load. Without it there is nothing to
    // write, and `$set` would silently keep whatever tag was there before -
    // leaving a new vector wearing an old model's name.
    const model = config.ai.embeddingDeployment;
    if (!model) return null;

    const corrections = await ManualCategorized.find({ userId })
      .select('+descriptionEmbedding')
      .lean();

    if (corrections.length === 0) return new UserCorpus(userId, []);

    // A vector from another model describes a different space, so treat it as
    // absent rather than comparing across the two.
    const stale = corrections.filter(
      (c) => !c.descriptionEmbedding?.length || c.embeddingModel !== model
    );

    if (stale.length) {
      await this.backfill(userId, stale, model);
    }

    const entries = [];
    for (const correction of corrections) {
      // Anything the backfill could not refresh still carries another model's
      // vector. Leaving it in would mix two spaces in one comparison, so it sits
      // out until a later load re-embeds it.
      if (correction.embeddingModel !== model) continue;
      const vector = correction.descriptionEmbedding?.length
        ? normalise(correction.descriptionEmbedding)
        : null;
      if (!vector) continue;
      entries.push({
        vector,
        category: correction.category,
        subCategory: correction.subCategory || null,
        description: correction.description,
        matchCount: correction.matchCount || 1
      });
    }

    return new UserCorpus(userId, entries);
  }

  /**
   * Embeds corrections that have no usable vector and writes them back, so the
   * cost is paid once per correction rather than once per classification.
   */
  async backfill(userId, stale, model) {
    const texts = stale.map(textFor);

    let vectors;
    try {
      ({ vectors } = await llmService.embed({
        userId,
        texts,
        purpose: 'categorisation-corpus'
      }));
    } catch (error) {
      // Losing the backfill costs accuracy, not correctness: the tiers ahead of
      // this still run, and the next attempt will retry. Never let it take down
      // a scrape.
      logger.warn(`Could not embed ${stale.length} corrections for user ${userId}: ${error.message}`);
      return;
    }

    const writes = await Promise.allSettled(
      stale.map((correction, index) => {
        const vector = vectors[index];
        if (!vector) return Promise.resolve();
        // Mutated in place so the caller's already-loaded copies pick it up
        // without a second read.
        correction.descriptionEmbedding = vector;
        correction.embeddingModel = model;
        return ManualCategorized.updateOne(
          { _id: correction._id },
          { $set: { descriptionEmbedding: vector, embeddingModel: model } }
        );
      })
    );

    // A write that fails only means the vector is not saved yet: the in-memory
    // copy above still serves this run, and the next load retries. Same
    // reasoning as the embed failure above - a database blip must not take down
    // the scrape that happens to be loading the corpus.
    const failures = writes.filter((write) => write.status === 'rejected');
    if (failures.length) {
      logger.warn(
        `Could not persist ${failures.length} of ${stale.length} correction embeddings ` +
        `for user ${userId}: ${failures[0].reason?.message}`
      );
    }

    logger.info(`Embedded ${stale.length} corrections for user ${userId}`);
  }

  /**
   * Suggests a category for one transaction against an already-loaded corpus.
   *
   * Returns null rather than a low-confidence guess. A wrong category is worse
   * than no category: an empty one is visible and prompts the user to set it,
   * while a plausible wrong one is silently absorbed into their budgets.
   */
  async suggestFrom(corpus, { description, memo }) {
    if (!corpus || corpus.size === 0) return null;

    const text = textFor({ description, memo });
    if (!text) return null;

    let queryVector;
    try {
      const { vectors } = await llmService.embed({
        userId: corpus.userId,
        texts: [text],
        purpose: 'categorisation-query'
      });
      queryVector = normalise(vectors[0] || []);
    } catch (error) {
      logger.warn(`Could not embed "${text}" for user ${corpus.userId}: ${error.message}`);
      return null;
    }

    if (!queryVector) return null;

    const neighbours = corpus.neighbours(queryVector, config.ai.knn.neighbours);
    if (neighbours.length === 0) return null;

    // Neighbours vote by similarity, so a near-identical description counts for
    // more than one that merely clears the threshold.
    const votes = new Map();
    let totalWeight = 0;

    for (const { entry, similarity } of neighbours) {
      const key = `${entry.category}:${entry.subCategory || ''}`;
      const weight = similarity;
      totalWeight += weight;

      const existing = votes.get(key);
      if (existing) {
        existing.weight += weight;
        existing.best = Math.max(existing.best, similarity);
      } else {
        votes.set(key, {
          weight,
          best: similarity,
          category: entry.category,
          subCategory: entry.subCategory,
          example: entry.description
        });
      }
    }

    const winner = [...votes.values()].sort((a, b) => b.weight - a.weight)[0];
    const confidence = winner.weight / totalWeight;

    if (confidence < config.ai.knn.minConfidence) {
      logger.debug(`kNN undecided for "${text}": best share ${confidence.toFixed(2)}`);
      return null;
    }

    return {
      categoryId: winner.category,
      subCategoryId: winner.subCategory,
      confidence,
      reasoning:
        `Similar to a transaction you categorised before: "${winner.example}" ` +
        `(similarity ${winner.best.toFixed(2)}, ${neighbours.length} neighbour(s) considered, ` +
        `${(confidence * 100).toFixed(0)}% agreement)`
    };
  }

  /**
   * Convenience for callers handling a single transaction. Anything working
   * through a batch should load the corpus once with forUser() instead of
   * paying for it per transaction.
   */
  async suggest({ userId, description, memo }) {
    const corpus = await this.forUser(userId);
    return this.suggestFrom(corpus, { description, memo });
  }
}

module.exports = new TransactionClassifier();
module.exports.UserCorpus = UserCorpus;
module.exports._internals = { normalise, textFor };
