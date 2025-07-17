const mongoose = require('mongoose');
const { Transaction } = require('../models');
const logger = require('../utils/logger');

/**
 * Migration script to update Transaction date fields for Budget feature
 * 
 * Changes:
 * 1. Rename current 'processedDate' to 'syncedDate' (when we pulled data)
 * 2. Extract actual 'processedDate' from rawData (when money moved)
 * 3. Initialize empty 'tags' array for all transactions
 */
async function migrateDateFields() {
  try {
    logger.info('Starting date fields migration...');
    
    // Get total count for progress tracking
    const totalCount = await Transaction.countDocuments({});
    logger.info(`Found ${totalCount} transactions to migrate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process transactions in batches to avoid memory issues
    const batchSize = 100;
    
    for (let skip = 0; skip < totalCount; skip += batchSize) {
      const transactions = await Transaction.find({})
        .skip(skip)
        .limit(batchSize)
        .lean(); // Use lean for better performance
      
      const bulkOps = [];
      
      for (const transaction of transactions) {
        try {
          const updates = {};
          let needsUpdate = false;
          
          // 1. Rename processedDate to syncedDate
          if (transaction.processedDate) {
            updates.syncedDate = transaction.processedDate;
            updates.$unset = { processedDate: 1 }; // Remove old field
            needsUpdate = true;
          }
          
          // 2. Extract processedDate from rawData
          let newProcessedDate = null;
          
          if (transaction.rawData) {
            // Try different possible fields in rawData
            if (transaction.rawData.processedDate) {
              newProcessedDate = new Date(transaction.rawData.processedDate);
            } else if (transaction.rawData.chargedDate) {
              newProcessedDate = new Date(transaction.rawData.chargedDate);
            } else if (transaction.rawData.date) {
              newProcessedDate = new Date(transaction.rawData.date);
            }
          }
          
          // Fallback to transaction date if no processedDate found in rawData
          if (!newProcessedDate || isNaN(newProcessedDate)) {
            newProcessedDate = transaction.date;
          }
          
          updates.processedDate = newProcessedDate;
          needsUpdate = true;
          
          // 3. Initialize empty tags array if it doesn't exist
          if (!transaction.tags) {
            updates.tags = [];
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            bulkOps.push({
              updateOne: {
                filter: { _id: transaction._id },
                update: updates
              }
            });
          } else {
            skippedCount++;
          }
          
        } catch (error) {
          logger.error(`Error processing transaction ${transaction._id}:`, error);
          errorCount++;
        }
      }
      
      // Execute bulk operations
      if (bulkOps.length > 0) {
        await Transaction.bulkWrite(bulkOps);
        migratedCount += bulkOps.length;
      }
      
      // Log progress
      const processed = skip + transactions.length;
      const percentage = ((processed / totalCount) * 100).toFixed(1);
      logger.info(`Migration progress: ${processed}/${totalCount} (${percentage}%)`);
    }
    
    logger.info('Date fields migration completed successfully!');
    logger.info(`Summary:
      - Total transactions: ${totalCount}
      - Migrated: ${migratedCount}
      - Skipped: ${skippedCount}
      - Errors: ${errorCount}`);
    
    return {
      success: true,
      totalCount,
      migratedCount,
      skippedCount,
      errorCount
    };
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback function to reverse the migration if needed
 */
async function rollbackDateFields() {
  try {
    logger.info('Starting date fields rollback...');
    
    const result = await Transaction.updateMany(
      {},
      {
        $rename: { syncedDate: 'processedDate' },
        $unset: { tags: 1 }
      }
    );
    
    logger.info(`Rollback completed. Updated ${result.modifiedCount} transactions`);
    return { success: true, modifiedCount: result.modifiedCount };
    
  } catch (error) {
    logger.error('Rollback failed:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const command = process.argv[2];
  
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27777/gerifinancial', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(async () => {
    try {
      if (command === 'rollback') {
        await rollbackDateFields();
      } else {
        await migrateDateFields();
      }
      process.exit(0);
    } catch (error) {
      logger.error('Script execution failed:', error);
      process.exit(1);
    }
  }).catch(error => {
    logger.error('Database connection failed:', error);
    process.exit(1);
  });
}

module.exports = {
  migrateDateFields,
  rollbackDateFields
};
