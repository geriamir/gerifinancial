const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod = null;

beforeAll(async () => {
  // Create MongoDB Memory Server
  mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();

  // Connect to MongoDB
  await mongoose.connect(mongoUri);
});

beforeEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});

afterEach(async () => {
  // Clear mongoose models to prevent OverwriteModelError
  Object.keys(mongoose.models).forEach(key => {
    delete mongoose.models[key];
  });
});

afterAll(async () => {
  // Close mongoose connection
  await mongoose.connection.close();
  
  // Stop MongoDB Memory Server
  if (mongod) {
    await mongod.stop();
  }
});
