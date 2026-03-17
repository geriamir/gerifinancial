/**
 * Remove the incorrectly stored IBKR covered call option from Investments.
 * It was inserted before option support was added and lacks option-specific fields.
 * A re-sync will recreate it properly.
 *
 * Usage:
 *   node src/scripts/cleanupIbkrOption.js
 *   node src/scripts/cleanupIbkrOption.js --dry-run
 */
const mongoose = require('mongoose');
const config = require('../shared/config');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`Connecting to MongoDB at: ${config.mongodbUri}`);
  await mongoose.connect(config.mongodbUri);
  console.log('Connected.');

  const { Investment } = require('../investments/models');

  // Find option investments that lack option-specific fields
  const staleOptions = await Investment.find({
    'rawData.holdingType': 'option'
  });

  if (staleOptions.length === 0) {
    console.log('No stale option investments found.');
    await mongoose.disconnect();
    process.exit(0);
  }

  for (const inv of staleOptions) {
    console.log(`Found: ${inv.accountName} (${inv.accountNumber}), marketValue: ${inv.totalMarketValue}, portfolioId: ${inv.portfolioId}`);
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would delete ${staleOptions.length} option investment(s). Run without --dry-run to execute.`);
  } else {
    const ids = staleOptions.map(i => i._id);
    const result = await Investment.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${result.deletedCount} option investment(s). Re-sync to recreate with proper option fields.`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
