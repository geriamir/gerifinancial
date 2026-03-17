/**
 * Remove duplicate IBKR investment transactions.
 * Keeps the earliest entry for each unique (userId, paperId, executionDate, amount, value) combo.
 *
 * Usage:
 *   node src/scripts/cleanupDuplicateInvestmentTxns.js
 *   node src/scripts/cleanupDuplicateInvestmentTxns.js --dry-run
 */
const mongoose = require('mongoose');
const config = require('../shared/config');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`Connecting to MongoDB at: ${config.mongodbUri}`);
  await mongoose.connect(config.mongodbUri);
  console.log('Connected.');

  const InvestmentTransaction = require('../investments/models/InvestmentTransaction');

  // Find duplicates by grouping on key fields
  const dupes = await InvestmentTransaction.aggregate([
    {
      $group: {
        _id: { userId: '$userId', paperId: '$paperId', executionDate: '$executionDate', amount: '$amount', value: '$value' },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  if (dupes.length === 0) {
    console.log('No duplicate transactions found.');
    await mongoose.disconnect();
    process.exit(0);
  }

  let totalToDelete = 0;
  const idsToDelete = [];

  for (const group of dupes) {
    // Keep the first (oldest) entry, delete the rest
    const toDelete = group.ids.slice(1);
    idsToDelete.push(...toDelete);
    totalToDelete += toDelete.length;
    console.log(`Duplicate: paperId=${group._id.paperId}, date=${group._id.executionDate}, count=${group.count}, removing ${toDelete.length}`);
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would delete ${totalToDelete} duplicate transaction(s).`);
  } else {
    const result = await InvestmentTransaction.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`Deleted ${result.deletedCount} duplicate transaction(s).`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
