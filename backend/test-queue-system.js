const queuedDataSyncService = require('./src/banking/services/queuedDataSyncService');
const scrapingJobProcessors = require('./src/banking/services/scrapingJobProcessors');
const { BankAccount } = require('./src/banking/models');
const logger = require('./src/shared/utils/logger');

/**
 * Test script for the new queue-based scraping system
 */
async function testQueueSystem() {
  console.log('🧪 Testing Queue-Based Scraping System...\n');

  try {
    // Initialize the queue system
    console.log('1️⃣ Initializing queue system...');
    await queuedDataSyncService.initialize();
    console.log('✅ Queue system initialized successfully\n');

    // Get health status
    console.log('2️⃣ Checking queue health...');
    const health = await queuedDataSyncService.getHealthStatus();
    console.log('📊 Queue Health:', JSON.stringify(health, null, 2));
    console.log();

    // Get queue statistics
    console.log('3️⃣ Getting queue stats...');
    const stats = await queuedDataSyncService.getQueueStats();
    console.log('📈 Queue Stats:', JSON.stringify(stats, null, 2));
    console.log();

    // Test finding a bank account (if any exist)
    console.log('4️⃣ Looking for test bank accounts...');
    const testAccount = await BankAccount.findOne().limit(1);
    
    if (testAccount) {
      console.log(`📋 Found test account: ${testAccount.name} (${testAccount._id})`);
      
      // Test queueing a single strategy
      console.log('\n5️⃣ Testing single strategy queue...');
      const strategyResult = await queuedDataSyncService.queueStrategySync(
        testAccount._id,
        'checking-accounts',
        { priority: 'high' }
      );
      console.log('✅ Strategy queued:', JSON.stringify(strategyResult, null, 2));

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check updated stats
      console.log('\n6️⃣ Checking updated queue stats...');
      const updatedStats = await queuedDataSyncService.getQueueStats();
      console.log('📈 Updated Stats:', JSON.stringify(updatedStats, null, 2));

    } else {
      console.log('⚠️ No bank accounts found for testing');
      
      // Test queue operations without actual account
      console.log('\n5️⃣ Testing queue operations without account...');
      try {
        await queuedDataSyncService.queueStrategySync('fake-id', 'checking-accounts');
      } catch (error) {
        console.log('✅ Expected error caught:', error.message);
      }
    }

    console.log('\n7️⃣ Testing queue pause/resume...');
    await queuedDataSyncService.pauseQueues();
    console.log('✅ Queues paused');
    
    await queuedDataSyncService.resumeQueues();
    console.log('✅ Queues resumed');

    console.log('\n🎉 Queue system test completed successfully!');

  } catch (error) {
    console.error('❌ Queue system test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      await queuedDataSyncService.shutdown();
      console.log('✅ Queue system shut down gracefully');
    } catch (error) {
      console.error('⚠️ Cleanup error:', error.message);
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  // Connect to MongoDB first
  const mongoose = require('mongoose');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gerifinancial';
  
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('📦 Connected to MongoDB');
      return testQueueSystem();
    })
    .then(() => {
      console.log('\n✨ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = testQueueSystem;
