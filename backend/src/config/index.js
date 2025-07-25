require('dotenv').config();

const config = {
  port: process.env.PORT || 3001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27777/gerifinancial',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  env: process.env.NODE_ENV || 'development'
};

// Override configuration for test/e2e environments
if (process.env.NODE_ENV === 'test') {
  // Use in-memory database for unit tests
  config.mongodbUri = 'mongodb://localhost:27777/gerifinancial-test';
  config.jwtSecret = 'test-secret';
  config.jwtExpiration = '1h';
} else if (process.env.NODE_ENV === 'e2e') {
  // Use real database with e2e suffix for end-to-end tests
  config.mongodbUri = 'mongodb://localhost:27777/gerifinancial-e2e';
  config.jwtSecret = 'e2e-secret';
  config.jwtExpiration = '1h';
}

module.exports = config;
