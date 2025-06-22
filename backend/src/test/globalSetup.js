const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  // Create test data directory if it doesn't exist
  const testDataPath = path.join(__dirname, '../../test-data');
  try {
    await fs.mkdir(testDataPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  // Configure mongodb-memory-server to use a specific version that works on Windows
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbPath: testDataPath,
      storageEngine: 'wiredTiger'
    },
    binary: {
      version: '5.0.0',
      downloadDir: path.join(testDataPath, 'mongodb-binaries'),
    },
  });

  // Store the URI for later use
  global.__MONGOD__ = mongod;
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  console.log('MongoDB Memory Server started at:', uri);
};
