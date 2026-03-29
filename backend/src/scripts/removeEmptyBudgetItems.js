const mongoose = require('mongoose');
const { ProjectBudget } = require('../project-budgets/models');
const logger = require('../shared/utils/logger');
const config = require('../shared/config');

/**
 * Migration script to remove empty categoryBudget entries from ProjectBudget documents.
 * Empty = no description, no budgetedAmount, and no allocated transactions.
 * These are leftover entries from before template defaults included descriptions.
 */

async function removeEmptyBudgetItems() {
  try {
    logger.info('Starting removal of empty categoryBudget items from ProjectBudget documents...');

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.mongodbUri);
      logger.info(`Connected to MongoDB at ${config.mongodbUri}`);
    }

    const allProjects = await ProjectBudget.find({
      'categoryBudgets.0': { $exists: true }
    });

    logger.info(`Found ${allProjects.length} projects with categoryBudgets`);

    let updatedCount = 0;
    let removedItemsTotal = 0;
    let errorCount = 0;

    for (const project of allProjects) {
      try {
        const originalCount = project.categoryBudgets.length;

        const cleanedBudgets = project.categoryBudgets.filter(budget => {
          const hasDescription = budget.description && budget.description.trim().length > 0;
          const hasBudget = budget.budgetedAmount > 0;
          const hasTransactions = budget.allocatedTransactions && budget.allocatedTransactions.length > 0;
          return hasDescription || hasBudget || hasTransactions;
        });

        const removedCount = originalCount - cleanedBudgets.length;

        if (removedCount > 0) {
          await ProjectBudget.updateOne(
            { _id: project._id },
            { $set: { categoryBudgets: cleanedBudgets } }
          );
          updatedCount++;
          removedItemsTotal += removedCount;
          logger.info(`✅ ${project.name}: removed ${removedCount} empty budget item(s) (${originalCount} → ${cleanedBudgets.length})`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`❌ Error updating project ${project.name} (${project._id}):`, error);
      }
    }

    logger.info('\n📊 Migration Summary:');
    logger.info(`✅ Projects updated: ${updatedCount}`);
    logger.info(`🗑️  Empty budget items removed: ${removedItemsTotal}`);
    logger.info(`❌ Errors encountered: ${errorCount}`);
    logger.info(`📝 Total projects scanned: ${allProjects.length}`);

  } catch (error) {
    logger.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

if (require.main === module) {
  removeEmptyBudgetItems()
    .then(() => {
      logger.info('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = removeEmptyBudgetItems;
