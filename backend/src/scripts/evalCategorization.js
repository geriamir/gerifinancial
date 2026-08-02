const path = require('path');
const mongoose = require('mongoose');
const config = require('../shared/config');

/**
 * Measures how well the existing categorisation cascade does on a labelled set.
 *
 * The point of this is to produce the number that any future change - an
 * embedding-based classifier, a language model, more keywords - has to beat. A
 * classifier that cannot be compared against the rules it replaces is a
 * classifier nobody can argue about, so this exists before any of that is built.
 *
 * Two sources of labels:
 *
 *   (default)   src/scripts/fixtures/categorizationEval.json - hand-written and
 *               committed, so the baseline runs anywhere including CI.
 *   --from-db   Transactions a real user corrected by hand, which is the only
 *               honest measure of production behaviour. Never committed.
 *
 * Usage:
 *   npm run eval:categorization
 *   npm run eval:categorization -- --seed-corpus
 *   npm run eval:categorization -- --from-db --user <userId> [--limit 500]
 *   npm run eval:categorization -- --json
 *
 * --seed-corpus exists because the last tier learns from the user's own past
 * corrections, and a fresh fixture run has none - so without it that tier is
 * measured as if it were switched off. It fabricates a correction per case under
 * a different string for the same merchant, which is the situation the tier is
 * built for: the user has categorised this shop before, but never under exactly
 * this description. It needs a real Azure OpenAI endpoint and is not a substitute
 * for --from-db against a user's actual corrections.
 */

const parseArgs = (argv) => {
  const args = { fromDb: false, json: false, limit: 500, user: null, seedCorpus: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from-db') args.fromDb = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--seed-corpus') args.seedCorpus = true;
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--user') args.user = argv[++i];
  }
  return args;
};

// Written to stderr so that --json produces a clean document on stdout.
const say = (message) => process.stderr.write(`${message}\n`);

const percent = (numerator, denominator) =>
  denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;

/**
 * Labels drawn from what a user actually corrected.
 *
 * A transaction the user re-categorised by hand is the strongest label
 * available: it is the one case where we know the machine's answer was checked.
 */
async function loadFromDatabase({ user, limit }) {
  const { Transaction } = require('../banking/models');

  const query = { categorizationMethod: 'manual', category: { $ne: null } };
  if (user) query.userId = new mongoose.Types.ObjectId(user);

  // Scoring is done under a single user, because the cascade resolves categories
  // per user. Mixing owners would score one person's labels against another
  // person's category tree and report the mismatch as classifier error, so
  // refuse rather than print a number that means nothing.
  if (!user) {
    const owners = await Transaction.distinct('userId', query);
    if (owners.length > 1) {
      throw new Error(
        `Found manually categorised transactions for ${owners.length} users. ` +
        `Pass --user <userId> to choose one: ${owners.map(String).join(', ')}`
      );
    }
  }

  const transactions = await Transaction.find(query)
    .populate('category', 'name type')
    .populate('subCategory', 'name')
    .limit(limit)
    .lean();

  if (transactions.length === 0) {
    throw new Error(
      'No manually categorised transactions found. Correct some transactions in the app first, ' +
      'or run without --from-db to use the committed fixtures.'
    );
  }

  const userId = transactions[0].userId;
  return {
    userId,
    cases: transactions.map((tx) => ({
      description: tx.description,
      memo: tx.memo || null,
      amount: tx.amount,
      rawCategory: tx.rawData && tx.rawData.category,
      expectedCategory: tx.category && tx.category.name,
      expectedSubCategory: tx.subCategory && tx.subCategory.name
    }))
  };
}

/**
 * Labels from the committed fixture file, evaluated against a throwaway user
 * seeded with the standard category tree.
 */
async function loadFromFixtures() {
  const { initializeUserCategories } = require('../monthly-budgets/services/userCategoryService');
  const fixturePath = path.join(__dirname, 'fixtures', 'categorizationEval.json');
  const { fixtures } = require(fixturePath);

  // A bare ObjectId is enough. Categories only hold a reference to their owner,
  // so no User document - and none of the credential machinery that comes with
  // one - has to exist for this.
  const userId = new mongoose.Types.ObjectId();
  await initializeUserCategories(userId);

  const { Category, SubCategory } = require('../banking/models');
  const categories = await Category.find({ userId }).lean();
  const subCategories = await SubCategory.find({ userId }).lean();

  const categoryNames = new Set(categories.map((c) => c.name));
  const subCategoryNames = new Set(subCategories.map((s) => s.name));

  // Fail loudly rather than quietly scoring against labels that no longer exist:
  // a renamed category would otherwise turn every case into a miss and look like
  // a regression in the classifier.
  const unknown = [];
  for (const fixture of fixtures) {
    if (!categoryNames.has(fixture.category)) {
      unknown.push(`category "${fixture.category}"`);
    }
    if (fixture.subCategory && !subCategoryNames.has(fixture.subCategory)) {
      unknown.push(`subcategory "${fixture.subCategory}"`);
    }
  }
  if (unknown.length) {
    throw new Error(
      `Fixture labels no longer exist in the default category tree: ${[...new Set(unknown)].join(', ')}. ` +
      'Update src/scripts/fixtures/categorizationEval.json to match userCategoryService.js.'
    );
  }

  return {
    userId,
    cases: fixtures.map((f) => ({
      description: f.description,
      memo: f.memo || null,
      amount: f.amount,
      rawCategory: f.rawCategory || null,
      expectedCategory: f.category,
      expectedSubCategory: f.subCategory || null
    }))
  };
}

/**
 * Which rule in the cascade actually answered.
 *
 * `categorizationMethod` is too coarse to tune against: the stored enum records
 * `previous_data` both for a genuine match against the user's own corrections
 * and for a plain keyword hit off the default category tree. Those are entirely
 * different mechanisms with different failure modes, and knowing which one fired
 * is the whole point of measuring. The reasoning string is the only place the
 * distinction survives, so recover the tier from it.
 */
const deriveTier = ({ categorizationMethod, categorizationReasoning: why, category }) => {
  if (!category) return 'uncategorized';
  if (!why) return categorizationMethod || 'unknown';
  if (why.startsWith('Manual categorization match:')) return 'user-history';
  if (why.startsWith('Enhanced keyword match:')) {
    return why.includes('Matched subcategory:') ? 'keyword-subcategory' : 'keyword-category';
  }
  if (why.startsWith('AI categorization:')) return 'legacy-ai';
  if (why.startsWith('Similar to a transaction you categorised before:')) return 'knn';
  return categorizationMethod || 'unknown';
};

/**
 * Fabricates a plausible past correction for each case.
 *
 * The description has to differ from the one being scored, and must not contain
 * it: the exact-match tier falls back to a substring regex, so a correction that
 * merely wraps the query would be answered there and the tier under test would
 * never run. Keeping the merchant and replacing the rest is what a real corpus
 * looks like - the same shop, a different branch, a different reference number.
 */
const perturb = (description, index) => {
  const tokens = description.trim().split(/\s+/);
  const branch = ['סניף מרכז', 'סניף צפון', 'תל אביב', 'חיפה'][description.length % 4];
  // The reference number also keeps two merchants sharing a first word from
  // colliding on the corpus's unique index.
  const suffix = `${branch} ${1000 + index}`;
  if (tokens.length > 1) return `${tokens[0]} ${suffix}`;
  // A single token cannot be shortened without losing the merchant, so alter it
  // rather than extend it - extending would leave the query as a substring.
  return `${tokens[0].slice(0, -1)} ${suffix}`;
};

async function seedCorpus({ userId, cases }) {
  const { ManualCategorized, Category, SubCategory } = require('../banking/models');
  const llmService = require('../shared/services/ai/llmService');

  if (!llmService.isEmbeddingEnabled()) {
    say('--seed-corpus needs AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_EMBEDDING_DEPLOYMENT; skipping');
    return 0;
  }

  let seeded = 0;
  for (const [index, testCase] of cases.entries()) {
    const category = await Category.findOne({ userId, name: testCase.expectedCategory });
    if (!category) continue;
    const subCategory = testCase.expectedSubCategory
      ? await SubCategory.findOne({ userId, parentCategory: category._id, name: testCase.expectedSubCategory })
      : null;

    await ManualCategorized.create({
      description: perturb(testCase.description, index),
      userId,
      category: category._id,
      subCategory: subCategory?._id || null
    });
    seeded += 1;
  }

  say(`Seeded ${seeded} simulated corrections; embedding them now`);
  const transactionClassifier = require('../banking/services/transactionClassifier');
  const corpus = await transactionClassifier.forUser(userId);
  say(`Corpus holds ${corpus?.size ?? 0} usable vectors`);
  return seeded;
}

async function scoreCase({ testCase, userId, accountId, index, corpus }) {
  const { Transaction } = require('../banking/models');
  const categoryMappingService = require('../banking/services/categoryMappingService');

  const transaction = new Transaction({
    identifier: `eval-${index}-${Date.now()}`,
    userId,
    accountId,
    amount: testCase.amount,
    currency: 'ILS',
    date: new Date(),
    description: testCase.description,
    memo: testCase.memo,
    rawData: { description: testCase.description, memo: testCase.memo, category: testCase.rawCategory }
  });
  await transaction.save();

  const startedAt = Date.now();
  await categoryMappingService.attemptAutoCategorization(transaction, { corpus });
  const elapsedMs = Date.now() - startedAt;

  const populated = await Transaction.findById(transaction._id)
    .populate('category', 'name')
    .populate('subCategory', 'name')
    .lean();

  const actualCategory = populated.category ? populated.category.name : null;
  const actualSubCategory = populated.subCategory ? populated.subCategory.name : null;

  // Only judge the subcategory when the label carries one. Income and Transfer
  // categories legitimately have none, so demanding one would mark every correct
  // salary as wrong.
  const categoryCorrect = actualCategory === testCase.expectedCategory;
  const subCategoryCorrect = !testCase.expectedSubCategory || actualSubCategory === testCase.expectedSubCategory;

  return {
    description: testCase.description,
    expected: [testCase.expectedCategory, testCase.expectedSubCategory].filter(Boolean).join(' / '),
    actual: [actualCategory, actualSubCategory].filter(Boolean).join(' / ') || null,
    method: populated.categorizationMethod || null,
    tier: deriveTier(populated),
    categorized: Boolean(actualCategory),
    correct: categoryCorrect && subCategoryCorrect,
    categoryOnlyCorrect: categoryCorrect,
    elapsedMs
  };
}

function summarise(results) {
  const total = results.length;
  const categorized = results.filter((r) => r.categorized).length;
  const correct = results.filter((r) => r.correct).length;
  const categoryOnly = results.filter((r) => r.categoryOnlyCorrect).length;
  const totalMs = results.reduce((sum, r) => sum + r.elapsedMs, 0);

  const byMethod = {};
  for (const result of results) {
    const key = result.tier || 'uncategorized';
    byMethod[key] = byMethod[key] || { total: 0, correct: 0 };
    byMethod[key].total += 1;
    if (result.correct) byMethod[key].correct += 1;
  }

  return {
    total,
    // How often it ventured an answer at all.
    coveragePct: percent(categorized, total),
    // How often the full answer was right. This is the number to beat.
    accuracyPct: percent(correct, total),
    // Right category, possibly wrong subcategory - a softer bar worth watching
    // separately, since the two are usually fixed by different means.
    categoryAccuracyPct: percent(categoryOnly, total),
    // Precision among the answers it did give: a classifier that stays silent is
    // not the same as one that is confidently wrong.
    precisionWhenAnsweredPct: percent(correct, categorized),
    meanMs: total === 0 ? 0 : Math.round(totalMs / total),
    byMethod
  };
}

function report(summary, results) {
  say('');
  say('Categorisation baseline');
  say('-----------------------');
  say(`cases                   ${summary.total}`);
  say(`coverage                ${summary.coveragePct}%  (answered at all)`);
  say(`accuracy                ${summary.accuracyPct}%  (category + subcategory)`);
  say(`category-only accuracy  ${summary.categoryAccuracyPct}%`);
  say(`precision when answered ${summary.precisionWhenAnsweredPct}%`);
  say(`mean latency            ${summary.meanMs} ms/transaction`);
  say('');
  say('by tier that answered');
  for (const [method, stats] of Object.entries(summary.byMethod)) {
    say(`  ${method.padEnd(22)} ${String(stats.total).padStart(4)} cases, ${percent(stats.correct, stats.total)}% correct`);
  }

  const misses = results.filter((r) => !r.correct);
  if (misses.length) {
    say('');
    say(`misses (${misses.length})`);
    for (const miss of misses) {
      say(`  ${miss.description}`);
      say(`      expected ${miss.expected}`);
      say(`      actual   ${miss.actual || '(uncategorized)'}`);
    }
  }
  say('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let memoryServer = null;

  try {
    if (args.fromDb) {
      await mongoose.connect(config.mongodbUri);
      say(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
    } else {
      // Self-contained by default so the baseline is reproducible and never
      // touches anyone's real data.
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      await mongoose.connect(memoryServer.getUri());
      say('Using an in-memory database with the default category tree');
    }

    const { userId, cases } = args.fromDb
      ? await loadFromDatabase(args)
      : await loadFromFixtures();

    say(`Scoring ${cases.length} labelled transactions...`);

    if (args.seedCorpus) {
      await seedCorpus({ userId, cases });
    }

    const accountId = new mongoose.Types.ObjectId();
    // Loaded once, as the batch worker does, so the timings reflect production
    // rather than a corpus reload per transaction.
    const transactionClassifier = require('../banking/services/transactionClassifier');
    const corpus = await transactionClassifier.forUser(userId);
    const results = [];
    for (let i = 0; i < cases.length; i += 1) {
      results.push(await scoreCase({ testCase: cases[i], userId, accountId, index: i, corpus }));
    }

    const summary = summarise(results);

    if (args.json) {
      process.stdout.write(`${JSON.stringify({ summary, results }, null, 2)}\n`);
    } else {
      report(summary, results);
    }
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.connection.close();
    if (memoryServer) await memoryServer.stop();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      say(`Eval failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { summarise, parseArgs };
