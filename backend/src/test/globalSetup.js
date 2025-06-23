const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  // If we're in CI, use the MongoDB service container
  if (process.env.CI) {
    process.env.MONGO_URI = process.env.MONGODB_URI;
  }

  // Create test data directory if it doesn't exist
  const testDataPath = path.join(__dirname, '../../test-data');
  try {
    await fs.mkdir(testDataPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  // The actual connection will be handled by testDb.js
  console.log('Test environment setup complete');
};
