const scrapingQueue = require('../../shared/services/scrapingQueue');
const strategyRegistry = require('../../shared/services/strategyRegistry');
const distributedLock = require('../../shared/services/distributedLock');
const scrapingEvents = require('./scrapingEvents');
const { BankAccount } = require('../models');
const logger = require('../../shared/utils/logger');

/**
 * Generic Scraping Job Processor for Bull Queue
 * Handles any strategy type for any bank account instance
 */
class ScrapingJobProcessors {
  constructor() {
    this.isRegistered = false;
  }

  /**
   * Register the generic job processor
   */
  async registerProcessors() {
    if (this.isRegistered) {
      logger.info('🔄 Processors already registered, skipping');
      return;
    }

    logger.info('🔧 Starting processor registration...');

    // Single generic processor for all strategy types
    scrapingQueue.registerProcessor('scrape-strategy', this.processStrategyJob.bind(this));

    this.isRegistered = true;
    logger.info('✅ Registered generic scraping job processor for job type: scrape-strategy');
  }

  /**
   * Generic strategy job processor
   * Handles any strategy type based on job data
   */
  async processStrategyJob(jobData, job) {
    const { bankAccountId, strategyName, options = {} } = jobData;
    let bankAccount = null; // Declare outside try block for error handling access
    
    logger.info(`🚀 Starting job processing for ${strategyName} - account ${bankAccountId}`);
    
    try {
      // BullMQ uses updateProgress instead of progress
      await job.updateProgress(10);
      
      // Get bank account
      bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) {
        // Handle stale/invalid jobs gracefully - account might have been deleted
        logger.warn(`🗑️ Stale job detected: Bank account ${bankAccountId} no longer exists. Marking job as completed to prevent retry.`);
        
        await job.updateProgress(100);
        
        return {
          strategyName,
          bankAccountId,
          success: false,
          stale: true,
          reason: 'Bank account not found - likely deleted',
          message: `Bank account ${bankAccountId} no longer exists. Job marked as stale.`
        };
      }

      await job.updateProgress(20);
      
      // Debug: Check strategy registry
      logger.info(`🔍 Checking strategy registry - global.syncStrategies exists: ${!!global.syncStrategies}`);
      
      // Ensure strategies are initialized (handles startup race with stale Redis jobs)
      strategyRegistry.ensureInitialized();
      
      if (global.syncStrategies) {
        logger.info(`🔍 Available strategies: ${Object.keys(global.syncStrategies).join(', ')}`);
      }
      
      const strategy = strategyRegistry.getStrategy(strategyName);
      if (!strategy) {
        throw new Error(`Strategy not found: ${strategyName}. Available strategies: ${strategyRegistry.getAvailableStrategies().join(', ')}`);
      }

      logger.info(`✅ Found strategy ${strategyName}, processing sync job for account ${bankAccount.name} (${bankAccountId})`);

      await job.updateProgress(30);
      
      // Emit event for strategy start (for onboarding progress tracking)
      scrapingEvents.emitStrategySyncStarted({
        strategyName,
        bankAccountId,
        userId: bankAccount.userId
      });
      
      // Acquire distributed lock to prevent concurrent scraping of the same account
      const lockResourceId = `scraping:${bankAccountId}`;
      const lockTTL = 600000; // 10 minutes lock TTL
      const maxRetries = 60; // Retry for up to 10 minutes (60 retries * 10 seconds)
      const retryDelay = 10000; // 10 seconds between retries
      
      logger.info(`🔒 Attempting to acquire lock for account ${bankAccountId} (will wait if locked)`);
      
      const result = await distributedLock.withLock(
        lockResourceId,
        async () => {
          logger.info(`🔓 Lock acquired for account ${bankAccountId}, executing ${strategyName} strategy`);
          
          // Execute the strategy with lock held
          const strategyResult = await strategy.executeSync(bankAccount, options, this.createJobContext(job));
          
          logger.info(`✅ Strategy ${strategyName} executed successfully for account ${bankAccountId}`);
          return strategyResult;
        },
        {
          ttl: lockTTL,
          maxRetries: maxRetries,
          retryDelay: retryDelay,
          throwOnLockFailure: true // Throw error if unable to acquire lock after all retries
        }
      );
      
      await job.updateProgress(90);
      
      // Extract latest transaction date from result for accurate lastScraped tracking
      const lastTransactionDate = result?.transactions?.mostRecentTransactionDate || null;

      // Update strategy-specific sync status - SUCCESS
      bankAccount.updateStrategySync(strategyName, true, null, lastTransactionDate);
      await bankAccount.save();
      
      await job.updateProgress(100);
      
      logger.info(`✅ ${strategyName} sync completed successfully for account ${bankAccountId} - strategy sync updated`);
      
      // Emit event for strategy completion (async listeners can handle post-processing)
      scrapingEvents.emitStrategySyncCompleted({
        strategyName,
        bankAccountId,
        userId: bankAccount.userId,
        result
      });
      
      return {
        strategyName,
        bankAccountId,
        success: true,
        result,
        syncStatus: {
          lastScraped: bankAccount.strategySync[strategyName].lastScraped,
          status: bankAccount.strategySync[strategyName].status
        }
      };

    } catch (error) {
      logger.error(`❌ ${strategyName} sync failed for account ${bankAccountId}:`, error);
      logger.error(`❌ Error stack:`, error.stack);
      
      // Update strategy-specific sync status - FAILURE (only if bankAccount was found)
      if (bankAccount) {
        try {
          bankAccount.updateStrategySync(strategyName, false, error.message);
          await bankAccount.save();
          logger.info(`📝 Updated ${strategyName} sync status to 'failed' for account ${bankAccountId}`);
          
          // Emit failure event (for onboarding error tracking)
          scrapingEvents.emitStrategySyncFailed({
            strategyName,
            bankAccountId,
            userId: bankAccount.userId,
            error
          });
        } catch (saveError) {
          logger.error(`Failed to save strategy sync status for ${strategyName}:`, saveError);
        }
      } else {
        logger.warn(`Cannot update sync status - bank account ${bankAccountId} not found`);
      }
      
      throw error;
    }
  }

  /**
   * Create job context with utilities
   */
  createJobContext(job) {
    return {
      updateProgress: async (progress) => {
        await job.updateProgress(progress);
      },
      
      jobId: job.id,
      jobType: job.name,
      createdAt: new Date(job.timestamp)
    };
  }
}

// Singleton instance
const scrapingJobProcessors = new ScrapingJobProcessors();

module.exports = scrapingJobProcessors;
