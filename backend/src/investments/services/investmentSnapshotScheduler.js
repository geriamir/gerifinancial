const cron = require('node-cron');
const { Investment } = require('../models');
const investmentService = require('./investmentService');
const logger = require('../utils/logger');

class InvestmentSnapshotScheduler {
  constructor() {
    this.isRunning = false;
    this.scheduledTask = null;
  }

  // Create daily snapshots for all active investments
  async createDailySnapshotsForAllUsers() {
    if (this.isRunning) {
      logger.warn('Daily snapshot creation already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    
    try {
      logger.info('Starting daily investment snapshots creation...');
      
      // Get all active investments
      const activeInvestments = await Investment.find({ 
        status: 'active' 
      }).populate('bankAccountId', 'name userId');
      
      if (activeInvestments.length === 0) {
        logger.info('No active investments found for snapshot creation');
        return;
      }

      const results = {
        totalInvestments: activeInvestments.length,
        successfulSnapshots: 0,
        failedSnapshots: 0,
        errors: []
      };

      // Process investments in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < activeInvestments.length; i += batchSize) {
        const batch = activeInvestments.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (investment) => {
            try {
              await investmentService.createDailySnapshot(investment);
              results.successfulSnapshots++;
              logger.debug(`Created snapshot for investment ${investment._id}`);
            } catch (error) {
              results.failedSnapshots++;
              results.errors.push({
                investmentId: investment._id,
                accountNumber: investment.accountNumber,
                error: error.message
              });
              logger.error(`Failed to create snapshot for investment ${investment._id}: ${error.message}`);
            }
          })
        );

        // Small delay between batches to be gentle on the database
        if (i + batchSize < activeInvestments.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const endTime = new Date();
      const duration = endTime - startTime;

      logger.info(`Daily investment snapshots completed in ${duration}ms:`, {
        totalInvestments: results.totalInvestments,
        successful: results.successfulSnapshots,
        failed: results.failedSnapshots,
        errorCount: results.errors.length
      });

      if (results.errors.length > 0) {
        logger.warn('Snapshot creation errors:', results.errors);
      }

      return results;
    } catch (error) {
      logger.error(`Critical error during daily snapshot creation: ${error.message}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Schedule daily snapshots to run every day at midnight
  startDailyScheduler() {
    if (this.scheduledTask) {
      logger.warn('Daily scheduler is already running');
      return;
    }

    // Run every day at 00:05 (5 minutes after midnight to avoid midnight load)
    this.scheduledTask = cron.schedule('5 0 * * *', async () => {
      try {
        logger.info('Daily investment snapshot scheduler triggered');
        await this.createDailySnapshotsForAllUsers();
      } catch (error) {
        logger.error(`Daily snapshot scheduler failed: ${error.message}`);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Jerusalem' // Israeli timezone
    });

    logger.info('Daily investment snapshot scheduler started (runs at 00:05 IST)');
  }

  // Stop the daily scheduler
  stopDailyScheduler() {
    if (this.scheduledTask) {
      this.scheduledTask.destroy();
      this.scheduledTask = null;
      logger.info('Daily investment snapshot scheduler stopped');
    }
  }

  // Manual trigger for testing or immediate execution
  async triggerManualSnapshot() {
    logger.info('Manual snapshot creation triggered');
    return await this.createDailySnapshotsForAllUsers();
  }

  // Get scheduler status
  getStatus() {
    return {
      isScheduled: !!this.scheduledTask,
      isRunning: this.isRunning,
      nextRun: this.scheduledTask ? 'Daily at 00:05 IST' : null,
      timezone: 'Asia/Jerusalem'
    };
  }

  // Create snapshots for specific user (useful for testing)
  async createSnapshotsForUser(userId) {
    try {
      logger.info(`Creating snapshots for user ${userId}`);
      
      const userInvestments = await Investment.find({ 
        userId, 
        status: 'active' 
      });
      
      if (userInvestments.length === 0) {
        logger.info(`No active investments found for user ${userId}`);
        return { success: true, snapshotsCreated: 0 };
      }

      let successCount = 0;
      const errors = [];

      for (const investment of userInvestments) {
        try {
          await investmentService.createDailySnapshot(investment);
          successCount++;
        } catch (error) {
          errors.push({
            investmentId: investment._id,
            error: error.message
          });
        }
      }

      logger.info(`Created ${successCount}/${userInvestments.length} snapshots for user ${userId}`);
      return {
        success: true,
        totalInvestments: userInvestments.length,
        snapshotsCreated: successCount,
        errors
      };
    } catch (error) {
      logger.error(`Error creating snapshots for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new InvestmentSnapshotScheduler();
