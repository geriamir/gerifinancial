const mongoose = require('mongoose');
const testDb = require('./testDb');
const jwt = require('jsonwebtoken');
const config = require('../config');

let mongoServer;

// Set up database connection before all tests
beforeAll(async () => {
  await testDb.connect();
});

// Clear all collections between tests
beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (let collection of collections) {
    await collection.deleteMany({});
  }
});

// Close connection after all tests
afterAll(async () => {
  await testDb.disconnect();
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
