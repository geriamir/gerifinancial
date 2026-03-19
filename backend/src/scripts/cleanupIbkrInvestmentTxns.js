/**
 * Cleanup IBKR investment transactions for re-sync
 * Removes all investment transactions linked to IBKR bank accounts
 * so they can be re-imported with correct transaction types
 * 
 * Usage: node src/scripts/cleanupIbkrInvestmentTxns.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { InvestmentTransaction } = require('../investments/models');
const BankAccount = require('../banking/models/BankAccount');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Drop the old unique compound index that prevents legitimate duplicates
    try {
      const collection = mongoose.connection.collection('investmenttransactions');
      const indexes = await collection.indexes();
      const oldIndex = indexes.find(idx => 
        idx.unique && idx.key?.userId && idx.key?.investmentId && idx.key?.paperId && 
        idx.key?.executionDate && idx.key?.amount && idx.key?.value
      );
      if (oldIndex) {
        await collection.dropIndex(oldIndex.name);
        console.log(`Dropped old unique index: ${oldIndex.name}`);
      } else {
        console.log('Old unique compound index not found (already removed)');
      }
    } catch (err) {
      console.log(`Index drop note: ${err.message}`);
    }

    // Find all IBKR bank accounts
    const ibkrAccounts = await BankAccount.find({ bankId: 'ibkr' }).lean();
    console.log(`Found ${ibkrAccounts.length} IBKR account(s)`);

    if (ibkrAccounts.length === 0) {
      console.log('No IBKR accounts found. Nothing to clean.');
      process.exit(0);
    }

    for (const account of ibkrAccounts) {
      const bankAccountId = account._id;

      // Count existing transactions
      const count = await InvestmentTransaction.countDocuments({ bankAccountId });
      console.log(`Account ${account.name || account._id}: ${count} investment transactions`);

      if (count > 0) {
        const result = await InvestmentTransaction.deleteMany({ bankAccountId });
        console.log(`  Deleted ${result.deletedCount} transactions`);
      }
    }

    console.log('\nCleanup complete. Run a sync to re-import transactions.');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

cleanup();
