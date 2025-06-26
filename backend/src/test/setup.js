const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Create MongoDB Memory Server and expose it for tests
let mongod = null;
global.__MONGOD__ = mongod;

beforeAll(async () => {
  // Create MongoDB Memory Server
  mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  
  console.log('Connecting to MongoDB at:', mongoUri);

  // Connect to MongoDB
  await mongoose.connect(mongoUri);
  console.log('Successfully connected to MongoDB');

  // Only require models after mongoose is connected
  const { BankAccount } = require('../models');
  const scrapingSchedulerService = require('../services/scrapingSchedulerService');

  // Register hooks after models are loaded
  require('../models/hooks/bankAccountHooks')
    .registerSchedulerHooks(BankAccount.schema, scrapingSchedulerService);
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
  // Instead of clearing models, just clear the collections' data
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
});

afterAll(async () => {
  // Close mongoose connection
  await mongoose.connection.close();
  
  // Stop MongoDB Memory Server
  if (mongod) {
    await mongod.stop();
  }
});
