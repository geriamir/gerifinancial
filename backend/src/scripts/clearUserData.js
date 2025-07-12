const mongoose = require('mongoose');
const config = require('../config');
const { 
  User, 
  BankAccount, 
  Transaction, 
  Category, 
  SubCategory
} = require('../models');
const ManualCategorized = require('../models/ManualCategorized');

/**
 * Script to remove all users and their associated data
 * WARNING: This will permanently delete all user data!
 * Note: Translations are preserved as they can be reused
 */
async function clearAllUserData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri);
    console.log('✅ Connected to MongoDB');

    console.log('\n🗑️ Starting data cleanup...');

    // Get count of records before deletion
    const userCount = await User.countDocuments();
    const bankAccountCount = await BankAccount.countDocuments();
    const transactionCount = await Transaction.countDocuments();
    const categoryCount = await Category.countDocuments();
    const subCategoryCount = await SubCategory.countDocuments();
    const manualCategorizedCount = await ManualCategorized.countDocuments();

    console.log('\n📊 Current data counts:');
    console.log(`   Users: ${userCount}`);
    console.log(`   Bank Accounts: ${bankAccountCount}`);
    console.log(`   Transactions: ${transactionCount}`);
    console.log(`   Categories: ${categoryCount}`);
    console.log(`   SubCategories: ${subCategoryCount}`);
    console.log(`   Manual Categorizations: ${manualCategorizedCount}`);
    console.log('   Translations: preserved (not deleted)');

    if (userCount === 0) {
      console.log('\n✨ No user data found. Database is already clean.');
      return;
    }

    // Confirm deletion
    if (process.env.NODE_ENV === 'production') {
      console.error('\n❌ This script cannot be run in production environment!');
      process.exit(1);
    }

    console.log('\n⚠️ WARNING: This will permanently delete ALL user data!');
    console.log('   (Translations will be preserved)');
    
    // Delete all user-related data
    console.log('\n🧹 Deleting user data...');
    
    // Delete in order to respect foreign key constraints
    await ManualCategorized.deleteMany({});
    console.log('   ✅ Cleared manual categorizations');
    
    await Transaction.deleteMany({});
    console.log('   ✅ Cleared transactions');
    
    await BankAccount.deleteMany({});
    console.log('   ✅ Cleared bank accounts');
    
    await SubCategory.deleteMany({});
    console.log('   ✅ Cleared subcategories');
    
    await Category.deleteMany({});
    console.log('   ✅ Cleared categories');
    
    await User.deleteMany({});
    console.log('   ✅ Cleared users');

    console.log('\n🎉 All user data has been successfully deleted!');
    console.log('📝 Translations were preserved for reuse');
    
    // Verify deletion
    const remainingUsers = await User.countDocuments();
    const remainingTransactions = await Transaction.countDocuments();
    
    if (remainingUsers === 0 && remainingTransactions === 0) {
      console.log('✅ Verification successful: User data is clean');
    } else {
      console.log('⚠️ Warning: Some user data may still remain');
    }

  } catch (error) {
    console.error('❌ Error during data cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  clearAllUserData()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = clearAllUserData;
