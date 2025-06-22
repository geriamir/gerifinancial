const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../config');

let mongoServer;

// Set up MongoDB Memory Server before all tests
beforeAll(async () => {
  // Use the URI from globalSetup
  await mongoose.connect(process.env.MONGO_URI);
});

// Clear all collections between tests
beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (let collection of collections) {
    await collection.deleteMany({});
  }
});

// Close connection and stop server after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// Helper function to generate test JWT tokens
global.generateTestToken = (userId) => {
  return jwt.sign({ userId: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiration,
  });
};

// Helper function to create test users
global.createTestUser = async (User, userData = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
    ...userData
  };
  return await User.create(defaultUser);
};
