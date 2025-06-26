const mongoose = require('mongoose');
const Category = require('./Category');
const SubCategory = require('./SubCategory');
const Transaction = require('./Transaction');
const User = require('./User');
const BankAccount = require('./BankAccount');

// Initialize models after mongoose is ready
mongoose.connection.once('open', () => {
  // Get the scheduler service only after mongoose is ready
  const scrapingSchedulerService = require('../services/scrapingSchedulerService');
  
  // Register hooks for BankAccount model
  try {
    require('./hooks/bankAccountHooks')
      .registerSchedulerHooks(BankAccount.schema, scrapingSchedulerService);
  } catch (error) {
    console.error('Failed to initialize model hooks:', error);
  }
});

// Export all models
module.exports = {
  Category,
  SubCategory,
  Transaction,
  User,
  BankAccount
};
