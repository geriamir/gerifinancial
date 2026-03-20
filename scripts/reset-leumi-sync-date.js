/**
 * Reset Leumi sync date to fetch older transactions.
 * 
 * Usage:
 *   node scripts/reset-leumi-sync-date.js [YYYY-MM-DD]
 * 
 * Examples:
 *   node scripts/reset-leumi-sync-date.js 2025-01-01   # Resync from Jan 2025
 *   node scripts/reset-leumi-sync-date.js 2024-06-01   # Resync from June 2024
 *   node scripts/reset-leumi-sync-date.js              # Defaults to 1 year ago
 * 
 * After running, trigger a sync for the Leumi account. The dedup logic
 * (uniqueId + fallback matching) will prevent duplicates while picking
 * up any missing transactions.
 * 
 * Note: Leumi scraper enforces a max of 3 years back.
 */

const path = require('path');
require(path.join(__dirname, '..', 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', 'backend', '.env')
});
const { MongoClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'mongodb'));

async function main() {
  const dateArg = process.argv[2];
  let newDate;

  if (dateArg) {
    newDate = new Date(dateArg);
    if (isNaN(newDate.getTime())) {
      console.error(`Invalid date: "${dateArg}". Use YYYY-MM-DD format.`);
      process.exit(1);
    }
  } else {
    newDate = new Date();
    newDate.setFullYear(newDate.getFullYear() - 1);
  }

  // Leumi scraper enforces max 3 years back
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  if (newDate < threeYearsAgo) {
    console.warn(`Warning: Leumi scraper only supports up to 3 years back.`);
    console.warn(`Clamping date from ${newDate.toISOString().split('T')[0]} to ${threeYearsAgo.toISOString().split('T')[0]}`);
    newDate = threeYearsAgo;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gerifinancial';
  const database = process.env.MONGO_DATABASE || new URL(uri).pathname.slice(1) || 'gerifinancial';

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(database);
    const bankAccounts = db.collection('bankaccounts');

    // Find Leumi accounts
    const leumiAccounts = await bankAccounts.find({
      bankId: { $in: ['leumi', 'leumiCard'] }
    }).toArray();

    if (leumiAccounts.length === 0) {
      console.log('No Leumi bank accounts found.');
      return;
    }

    console.log(`Found ${leumiAccounts.length} Leumi account(s):\n`);

    for (const account of leumiAccounts) {
      const strategies = account.strategySync || {};
      console.log(`  Account: ${account.bankId} (${account._id})`);
      
      for (const [strategyName, strategyData] of Object.entries(strategies)) {
        if (strategyData?.lastScraped) {
          console.log(`    Strategy "${strategyName}": lastScraped = ${strategyData.lastScraped.toISOString().split('T')[0]}`);
        }
      }
    }

    console.log(`\nResetting "checking-accounts" lastScraped to: ${newDate.toISOString().split('T')[0]}\n`);

    // Update only the checking-accounts strategy for Leumi accounts
    for (const account of leumiAccounts) {
      const checkingStrategy = account.strategySync?.['checking-accounts'];

      if (checkingStrategy?.lastScraped) {
        await bankAccounts.updateOne(
          { _id: account._id },
          { $set: { 'strategySync.checking-accounts.lastScraped': newDate } }
        );
        console.log(`  ✓ Updated ${account.bankId} (${account._id})`);
      } else {
        console.log(`  - Skipped ${account.bankId} (no checking-accounts lastScraped)`);
      }
    }

    console.log('\nDone! Now trigger a Leumi sync to fetch the older transactions.');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
