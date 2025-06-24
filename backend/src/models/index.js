const mongoose = require('mongoose');
const Category = require('./Category');
const SubCategory = require('./SubCategory');
const Transaction = require('./Transaction');
const User = require('./User');
const BankAccount = require('./BankAccount');

// Export all models
module.exports = {
  Category,
  SubCategory,
  Transaction,
  User,
  BankAccount
};
