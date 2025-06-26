const logger = require('../../utils/logger');

/**
 * Register hooks for the BankAccount model
 * @param {mongoose.Schema} schema - The BankAccount schema
 * @param {Object} schedulerService - The scraping scheduler service
 */
function registerSchedulerHooks(schema, schedulerService) {
  // Schedule scraping when account becomes active
  schema.post('save', async function(doc) {
    if (doc.status === 'active') {
      try {
        await schedulerService.scheduleAccount(doc);
        logger.info(`Scheduled scraping for bank account: ${doc._id}`);
      } catch (error) {
        logger.error(`Failed to schedule scraping for bank account ${doc._id}:`, error);
      }
    }
  });

  // Handle status changes
  schema.pre('findOneAndUpdate', async function(next) {
    const update = this.getUpdate();
    if (update.$set && update.$set.status === 'disabled') {
      const doc = await this.model.findOne(this.getQuery());
      if (doc && doc.status === 'active') {
        await schedulerService.stopAccount(doc._id);
        logger.info(`Stopped scraping for bank account: ${doc._id}`);
      }
    }
    next();
  });

  // Clean up scheduler when account is deleted
  schema.pre('remove', async function(next) {
    if (this.status === 'active') {
      await schedulerService.stopAccount(this._id);
      logger.info(`Stopped scraping for deleted bank account: ${this._id}`);
    }
    next();
  });
}

module.exports = {
  registerSchedulerHooks
};
