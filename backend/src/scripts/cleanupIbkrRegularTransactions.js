/**
 * Migration: Remove IBKR transactions from the regular Transactions collection.
 * These were incorrectly stored as banking transactions before the fix that routes
 * them to InvestmentTransaction instead.
 *
 * Usage:
 *   node src/scripts/cleanupIbkrRegularTransactions.js
 *   node src/scripts/cleanupIbkrRegularTransactions.js --dry-run
 */
const mongoose = require('mongoose');
const config = require('../shared/config');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`Connecting to MongoDB at: ${config.mongodbUri}`);
  await mongoose.connect(config.mongodbUri);
  console.log('Connected.');

  const BankAccount = require('../banking/models/BankAccount');
  const Transaction = require('../banking/models/Transaction');

  // Find all IBKR bank accounts
  const ibkrAccounts = await BankAccount.find({ bankId: 'ibkr' });
  if (ibkrAccounts.length === 0) {
    console.log('No IBKR bank accounts found. Nothing to clean up.');
    process.exit(0);
  }

  const ibkrAccountIds = ibkrAccounts.map(a => a._id);
  console.log(`Found ${ibkrAccounts.length} IBKR account(s): ${ibkrAccounts.map(a => `${a.name} (${a._id})`).join(', ')}`);

  // Count matching regular transactions
  const count = await Transaction.countDocuments({ accountId: { $in: ibkrAccountIds } });
  console.log(`Found ${count} regular transaction(s) linked to IBKR accounts.`);

  if (count === 0) {
    console.log('Nothing to delete.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('[DRY RUN] Would delete these transactions. Run without --dry-run to execute.');
  } else {
    const result = await Transaction.deleteMany({ accountId: { $in: ibkrAccountIds } });
    console.log(`Deleted ${result.deletedCount} regular transaction(s).`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
