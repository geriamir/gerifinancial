const mongoose = require('mongoose');
const { ProjectBudget } = require('../models');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Migration script to remove stored actualAmount fields from ProjectBudget documents
 * These fields are now calculated dynamically from allocatedTransactions
 */

async function removeStoredActualAmounts() {
  try {
    logger.info('Starting removal of stored actualAmount fields from ProjectBudget documents...');

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.mongodbUri);
      logger.info(`Connected to MongoDB at ${config.mongodbUri}`);
    }

    // Find all ProjectBudget documents that have actualAmount fields in categoryBudgets
    const projectsWithActualAmounts = await ProjectBudget.find({
      'categoryBudgets.actualAmount': { $exists: true }
    });

    logger.info(`Found ${projectsWithActualAmounts.length} projects with stored actualAmount fields`);

    let updatedCount = 0;
    let errorCount = 0;

    // Process each project
    for (const project of projectsWithActualAmounts) {
      try {
        logger.info(`Processing project: ${project.name} (${project._id})`);

        // Remove actualAmount fields from categoryBudgets - approach 1: direct field removal
        const updateResult = await ProjectBudget.updateOne(
          { _id: project._id },
          { 
            $unset: { 
              'categoryBudgets.$[].actualAmount': '' 
            }
          }
        );

        // If the above didn't work, try approach 2: update each categoryBudget individually
        if (updateResult.modifiedCount === 0) {
          logger.info(`Trying alternative approach for project: ${project.name}`);
          
          // Get the project with populated data
          const fullProject = await ProjectBudget.findById(project._id);
          if (fullProject && fullProject.categoryBudgets) {
            // Remove actualAmount from each categoryBudget
            const updatedCategoryBudgets = fullProject.categoryBudgets.map(budget => {
              const budgetObj = budget.toObject ? budget.toObject() : budget;
              delete budgetObj.actualAmount;
              return budgetObj;
            });
            
            // Update the entire categoryBudgets array
            const alternativeResult = await ProjectBudget.updateOne(
              { _id: project._id },
              { $set: { categoryBudgets: updatedCategoryBudgets } }
            );
            
            if (alternativeResult.modifiedCount > 0) {
              logger.info(`✅ Alternative approach successful for: ${project.name}`);
            }
          }
        }

        if (updateResult.modifiedCount > 0) {
          updatedCount++;
          logger.info(`✅ Updated project: ${project.name}`);
        } else {
          logger.warn(`⚠️ No changes made to project: ${project.name}`);
        }

      } catch (error) {
        errorCount++;
        logger.error(`❌ Error updating project ${project.name} (${project._id}):`, error);
      }
    }

    // Summary
    logger.info('\n📊 Migration Summary:');
    logger.info(`✅ Projects updated: ${updatedCount}`);
    logger.info(`❌ Errors encountered: ${errorCount}`);
    logger.info(`📝 Total projects processed: ${projectsWithActualAmounts.length}`);

    // Verify the migration
    const remainingProjectsWithActualAmounts = await ProjectBudget.find({
      'categoryBudgets.actualAmount': { $exists: true }
    });

    if (remainingProjectsWithActualAmounts.length === 0) {
      logger.info('✅ Migration completed successfully! No stored actualAmount fields remain.');
    } else {
      logger.warn(`⚠️ Warning: ${remainingProjectsWithActualAmounts.length} projects still have actualAmount fields.`);
      logger.warn('Projects with remaining actualAmount fields:');
      remainingProjectsWithActualAmounts.forEach(project => {
        logger.warn(`  - ${project.name} (${project._id})`);
      });
    }

    logger.info('\n🎯 Migration completed. Actual amounts will now be calculated dynamically from allocatedTransactions.');

  } catch (error) {
    logger.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  removeStoredActualAmounts()
    .then(() => {
      logger.info('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = removeStoredActualAmounts;
