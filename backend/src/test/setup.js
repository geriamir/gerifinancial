// Mock services
jest.mock('../services/categoryAIService', () => require('./mocks/categoryAIService'));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { User } = require('../models');

// Global test helpers
global.createTestUser = async (userData = {}) => {
  const defaultData = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123',
    name: 'Test User'
  };
  
  const user = new User({ ...defaultData, ...userData });
  await user.save();
  return user;
};

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

  // Load models to ensure they're registered
  const models = require('../models');
  
  // Initialize required services after models are loaded
  const scrapingSchedulerService = require('../services/scrapingSchedulerService');
  
  // Initialize scheduler for tests (will find 0 active accounts in test environment)
  try {
    await scrapingSchedulerService.initialize();
  } catch (error) {
    console.log('Scheduler initialization skipped in test environment:', error.message);
  }
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
