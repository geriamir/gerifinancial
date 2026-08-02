// Mock services
jest.mock('../banking/services/categoryAIService', () => require('./mocks/categoryAIService'));
jest.mock('../banking/services/scrapingSchedulerService', () => require('./mocks/scrapingSchedulerService'));
// The one seam to a language model, and the budget that meters it. Mocked
// globally so no test can reach the network, spend money, or depend on an
// Azure OpenAI deployment existing.
jest.mock('../shared/services/ai/llmService', () => require('./mocks/llmService'));
jest.mock('../shared/services/ai/aiBudget', () => require('./mocks/aiBudget'));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { User } = require('../auth');
const { githubIdentity } = require('./testUtils');

// Global test helpers
global.createTestUser = async (userData = {}) => {
  const defaultData = {
    email: `test-${Date.now()}@example.com`,
    ...githubIdentity(),
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
  // Create MongoDB Memory Server with increased timeout
  mongod = await MongoMemoryServer.create({
    instance: {
      startupTimeout: 30000, // 30 seconds timeout
    }
  });
  const mongoUri = mongod.getUri();
  
  console.log('Connecting to MongoDB at:', mongoUri);

  // Set encryption key for tests (must be exactly 32 bytes for AES-256-CBC)
  const crypto = require('crypto');
  // Generate a fixed test key using a repeatable pattern
  process.env.ENCRYPTION_KEY = "ws4Y832ySLsuPeUaoHIQ0a4ZNuSpBECb";

  // Connect to MongoDB
  await mongoose.connect(mongoUri);
  console.log('Successfully connected to MongoDB');

  // Load models to ensure they're registered - no longer needed with new modular structure
  
  // Initialize required services after models are loaded
  const scrapingSchedulerService = require('../banking/services/scrapingSchedulerService');
  
  // Initialize scheduler for tests (will find 0 active accounts in test environment)
  try {
    await scrapingSchedulerService.initialize();
  } catch (error) {
    console.log('Scheduler initialization skipped in test environment:', error.message);
  }
}, 45000); // 45 second timeout for setup

beforeEach(async () => {
  // Reset AI test doubles first, before any early return below: a canned chat
  // response or a spent budget leaking into the next test would be a confusing
  // failure to trace back.
  require('./mocks/llmService').__reset();
  require('./mocks/aiBudget').__reset();

  // Skip cleanup for RSUGrant model tests to avoid timeout issues
  const testPath = expect.getState().testPath;
  if (testPath && testPath.includes('RSUGrant.test.js')) {
    return; // Skip cleanup for RSUGrant model tests
  }
  
  // Ultra-fast cleanup - only clear RSU collections for other RSU tests
  try {
    if (mongoose.connection.collections['rsugrants']) {
      await mongoose.connection.collections['rsugrants'].deleteMany({});
    }
    if (mongoose.connection.collections['users']) {
      await mongoose.connection.collections['users'].deleteMany({});
    }
    // Users are wiped between tests, so their cached encryption keys must go
    // too or a later test could reuse a key belonging to a deleted user.
    require('../shared/services/credentialEncryption').clearCache();
  } catch (error) {
    // Ignore cleanup errors - tests will handle duplicates
    console.warn('Cleanup warning (ignored):', error.message);
  }
}, 3000); // 3 second timeout for cleanup

afterEach(async () => {
  // Minimal cleanup - don't wait for completion
  try {
    if (mongoose.connection.collections['rsugrants']) {
      mongoose.connection.collections['rsugrants'].deleteMany({}).catch(() => {});
    }
  } catch (error) {
    // Ignore all cleanup errors
  }
}, 1000); // 1 second timeout for cleanup

afterAll(async () => {
  try {
    // Clean up any running scheduler jobs first
    const scrapingSchedulerService = require('../banking/services/scrapingSchedulerService');
    scrapingSchedulerService.stopAll();

    // Force close any pending database operations
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close(true); // Force close
    }
    
    // Stop MongoDB Memory Server with proper timeout handling
    if (mongod) {
      let timeoutId;
      await Promise.race([
        mongod.stop(),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('MongoDB stop timeout')), 10000);
        })
      ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
    }
  } catch (error) {
    console.warn('Test teardown warning (non-blocking):', error.message);
  }
}, 15000); // 15 second timeout for teardown
