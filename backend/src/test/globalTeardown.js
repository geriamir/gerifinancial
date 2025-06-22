const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  const mongod = global.__MONGOD__;
  if (mongod) {
    await mongod.stop();
    delete global.__MONGOD__;
  }

  // Clean up test data directory
  const testDataPath = path.join(__dirname, '../../test-data');
  try {
    await fs.rm(testDataPath, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up test data directory:', error);
  }
};
