const { Queue, Worker } = require('bullmq');
const logger = require('../utils/logger');

/**
 * Scraping Queue Service using BullMQ for producer-consumer pattern
 * Each job represents a specific strategy for a specific bank account instance
 */
class ScrapingQueueService {
  constructor() {
    this.queues = new Map();
    this.workers = new Map();
    this.processors = new Map();
    this.isInitialized = false;
    
    // Redis connection config (will use default Redis connection)
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true
    };

    // Queue configurations
    this.queueConfigs = {
      'scraping-high': {
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 10,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          delay: 0
        },
        concurrency: 3,
        priority: 'high'
      },
      'scraping-normal': {
        defaultJobOptions: {
          removeOnComplete: 20,
          removeOnFail: 20,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 },
          delay: 0
        },
        concurrency: 5,
        priority: 'normal'
      },
      'scraping-low': {
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 50,
          attempts: 2,
          backoff: { type: 'exponential', delay: 15000 },
          delay: 30000 // 30 second delay for low priority jobs
        },
        concurrency: 2,
        priority: 'low'
      }
    };
  }

  /**
   * Initialize the queue service
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Create queues for different priorities
      for (const [queueName, config] of Object.entries(this.queueConfigs)) {
        const queue = new Queue(queueName, {
          redis: this.redisConfig,
          defaultJobOptions: config.defaultJobOptions
        });

        // Setup queue event listeners
        this.setupQueueEventListeners(queue, queueName);

        this.queues.set(queueName, queue);
        logger.info(`Created scraping queue: ${queueName} with concurrency: ${config.concurrency}`);
      }

      this.isInitialized = true;
      logger.info('Scraping queue service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize scraping queue service:', error);
      throw error;
    }
  }

  /**
   * Register a job processor for a specific job type
   */
  registerProcessor(jobType, processorFunction) {
    logger.info(`🔧 Registering processor for job type: ${jobType}`);
    this.processors.set(jobType, processorFunction);
    logger.info(`✅ Successfully registered processor for job type: ${jobType}. Total processors: ${this.processors.size}`);
  }

  /**
   * Start processing jobs for all queues using BullMQ Workers
   */
  async startProcessing() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    for (const [queueName, queue] of this.queues) {
      const config = this.queueConfigs[queueName];
      
      // Create BullMQ Worker for this queue  
      logger.info(`🔧 Creating BullMQ Worker for queue: ${queueName}, concurrency: ${config.concurrency}`);
      
      const worker = new Worker(queueName, async (job) => {
        logger.info(`🎯 WORKER processing job ${job.id} (${job.name}) in queue ${queueName}`);
        return this.processJob(job);
      }, {
        connection: this.redisConfig,
        concurrency: config.concurrency
      });

      // Setup worker event listeners
      this.setupWorkerEventListeners(worker, queueName);

      this.workers.set(queueName, worker);
      logger.info(`🚀 Started BullMQ Worker for queue: ${queueName} with concurrency: ${config.concurrency}`);
    }

    // Start periodic stats monitoring
    this.startStatsMonitoring();
  }

  /**
   * Add a scraping job to the appropriate queue
   */
  async addScrapingJob(jobType, bankAccountId, strategyName, jobData, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Determine queue priority based on options or defaults
    const priority = options.priority || 'normal';
    const queueName = `scraping-${priority}`;
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const job = await queue.add(jobType, {
      bankAccountId,
      strategyName,
      ...jobData
    }, {
      // Override default options if provided
      attempts: options.attempts,
      delay: options.delay,
      removeOnComplete: options.removeOnComplete,
      removeOnFail: options.removeOnFail,
      // Add job metadata
      jobId: `${jobType}_${bankAccountId}_${strategyName}_${Date.now()}`,
      timeout: options.timeout || 300000 // 5 minutes default timeout
    });

    logger.info(`Added scraping job ${job.id} (${jobType}) for account ${bankAccountId} strategy ${strategyName} to ${queueName} queue`);
    
    return job.id;
  }

  /**
   * Process a job using the registered processor
   */
  async processJob(job) {
    // In BullMQ, job type is accessed via job.name, not job.type
    const jobType = job.name;
    const { data } = job;
    const { bankAccountId, strategyName } = data;

    logger.info(`🔄 BullMQ processing job ${job.id} (${jobType}) for account ${bankAccountId} strategy ${strategyName}`);

    const processor = this.processors.get(jobType);
    if (!processor) {
      logger.error(`❌ No processor registered for job type: ${jobType}. Available processors: ${Array.from(this.processors.keys()).join(', ')}`);
      throw new Error(`No processor registered for job type: ${jobType}`);
    }

    try {
      const result = await processor(data, job);
      
      logger.info(`✅ BullMQ job ${job.id} completed successfully for account ${bankAccountId} strategy ${strategyName}`);
      return result;

    } catch (error) {
      logger.error(`❌ BullMQ job ${job.id} failed for account ${bankAccountId} strategy ${strategyName}:`, error);
      logger.error(`❌ Error details:`, error.stack);
      throw error;
    }
  }

  /**
   * Setup event listeners for queue monitoring
   */
  setupQueueEventListeners(queue, queueName) {
    queue.on('completed', (job, result) => {
      logger.info(`✅ Queue job ${job.id} completed in ${queueName}`);
    });

    queue.on('failed', (job, err) => {
      logger.error(`❌ Queue job ${job.id} failed in ${queueName}:`, err.message);
    });

    queue.on('error', (error) => {
      logger.error(`💀 Queue ${queueName} error:`, error);
    });
  }

  /**
   * Setup event listeners for worker monitoring
   */
  setupWorkerEventListeners(worker, queueName) {
    worker.on('completed', (job, result) => {
      logger.info(`🎉 Worker job ${job.id} completed in ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`💥 Worker job ${job.id} failed in ${queueName}:`, err.message);
    });

    worker.on('stalled', (jobId) => {
      logger.warn(`⏰ Worker job ${jobId} stalled in ${queueName}`);
    });

    worker.on('progress', (job, progress) => {
      logger.info(`📈 Worker job ${job.id} progress in ${queueName}: ${progress}%`);
    });

    worker.on('active', (job) => {
      logger.info(`🔥 Worker job ${job.id} started in ${queueName}`);
    });

    worker.on('error', (err) => {
      logger.error(`💀 Worker error in ${queueName}:`, err);
    });

    worker.on('ready', () => {
      logger.info(`🚀 Worker ready for ${queueName}`);
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ]);

    // Check if queue is paused (isPaused is a synchronous method)
    const paused = queue.isPaused ? queue.isPaused() : false;

    return {
      queueName,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused ? 1 : 0,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllStats() {
    const stats = {};
    for (const queueName of this.queues.keys()) {
      stats[queueName] = await this.getQueueStats(queueName);
    }
    return stats;
  }

  /**
   * Clear all jobs from a queue
   */
  async clearQueue(queueName, status = 'all') {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    if (status === 'all') {
      await queue.empty();
      await queue.clean(0, 'completed');
      await queue.clean(0, 'failed');
    } else {
      await queue.clean(0, status);
    }

    logger.info(`Cleared ${status} jobs from queue: ${queueName}`);
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      logger.info(`Paused queue: ${queueName}`);
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      logger.info(`Resumed queue: ${queueName}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('🛑 Shutting down scraping queue service...');

    // Stop stats monitoring
    this.stopStatsMonitoring();

    const shutdownPromises = [];
    
    // Close all workers first
    for (const [queueName, worker] of this.workers) {
      logger.info(`🔒 Closing worker for ${queueName}`);
      shutdownPromises.push(worker.close());
    }
    
    // Close all queues
    for (const [queueName, queue] of this.queues) {
      logger.info(`🔒 Closing queue ${queueName}`);
      shutdownPromises.push(queue.close());
    }

    await Promise.all(shutdownPromises);
    
    this.workers.clear();
    this.queues.clear();
    this.isInitialized = false;

    logger.info('✅ Scraping queue service shutdown complete');
  }

  /**
   * Start periodic queue stats monitoring
   */
  startStatsMonitoring() {
    // Log stats every 30 seconds
    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.getAllStats();
        
        // Only log if there are jobs to monitor
        const hasJobs = Object.values(stats).some(s => s.total > 0);
        if (hasJobs) {
          logger.info('📊 Queue Stats:');
          Object.entries(stats).forEach(([queueName, stat]) => {
            if (stat.total > 0) {
              logger.info(`  ${queueName}: waiting=${stat.waiting}, active=${stat.active}, completed=${stat.completed}, failed=${stat.failed}, paused=${stat.paused}`);
              
              // AGGRESSIVE FIX: If queue is paused and has waiting jobs, force resume it
              if (stat.paused === 1 && stat.waiting > 0) {
                const queue = this.queues.get(queueName);
                if (queue) {
                  queue.resume().then(() => {
                    logger.warn(`🔄 FORCE RESUMED paused queue with waiting jobs: ${queueName}`);
                  }).catch(err => {
                    logger.error(`Failed to force resume queue ${queueName}:`, err);
                  });
                }
              }
            }
          });
        } else {
          logger.info('📊 Queue Stats: All queues empty');
        }
      } catch (error) {
        logger.error('Error getting queue stats:', error);
      }
    }, 30000); // 30 seconds

    logger.info('📊 Started queue stats monitoring (every 30 seconds)');
  }

  /**
   * Stop stats monitoring
   */
  stopStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      logger.info('📊 Stopped queue stats monitoring');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    try {
      const stats = await this.getAllStats();
      return {
        status: 'healthy',
        queues: Object.keys(stats).length,
        stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

// Singleton instance
const scrapingQueue = new ScrapingQueueService();

module.exports = scrapingQueue;
