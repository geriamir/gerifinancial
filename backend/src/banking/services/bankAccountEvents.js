const EventEmitter = require('events');
const logger = require('../../shared/utils/logger');

/**
 * Shared event emitter for bank account related events
 * This avoids circular dependencies between services
 */
class BankAccountEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Allow multiple listeners
  }

  /**
   * Emit when a new bank account is created
   * @param {Object} bankAccount - The created bank account
   */
  emitAccountCreated(bankAccount) {
    logger.info(`Emitting accountCreated event for bank account: ${bankAccount._id}`);
    this.emit('accountCreated', bankAccount);
  }

  /**
   * Emit when a bank account is activated
   * @param {Object} bankAccount - The activated bank account
   */
  emitAccountActivated(bankAccount) {
    logger.info(`Emitting accountActivated event for bank account: ${bankAccount._id}`);
    this.emit('accountActivated', bankAccount);
  }

  /**
   * Emit when a bank account is deactivated
   * @param {Object} data - Object containing accountId and bankAccount
   */
  emitAccountDeactivated(data) {
    logger.info(`Emitting accountDeactivated event for bank account: ${data.accountId}`);
    this.emit('accountDeactivated', data);
  }

  /**
   * Emit when a bank account is deleted
   * @param {Object} data - Object containing accountId and bankAccount
   */
  emitAccountDeleted(data) {
    logger.info(`Emitting accountDeleted event for bank account: ${data.accountId}`);
    this.emit('accountDeleted', data);
  }
}

// Export a singleton instance
module.exports = new BankAccountEvents();
