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

  // Set encryption key for tests (must be exactly 32 bytes for AES-256-CBC)
  const crypto = require('crypto');
  // Generate a fixed test key using a repeatable pattern
  process.env.ENCRYPTION_KEY = "ws4Y832ySLsuPeUaoHIQ0a4ZNuSpBECb";

  // Connect to MongoDB
  await mongoose.connect(mongoUri);
  console.log('Successfully connected to MongoDB');

  // Initialize required services
  const scrapingSchedulerService = require('../services/scrapingSchedulerService');
  
  // Load models
  const models = require('../models');
  
  // Initialize scheduler for tests
  await scrapingSchedulerService.initialize();
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
  // Clean up any running scheduler jobs
  const scrapingSchedulerService = require('../services/scrapingSchedulerService');
  scrapingSchedulerService.stopAll();

  // Close mongoose connection
  await mongoose.connection.close();
  
  // Stop MongoDB Memory Server
  if (mongod) {
    await mongod.stop();
  }
});
