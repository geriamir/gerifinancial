require('dotenv').config();

const config = {
  port: process.env.PORT || 3001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/gerifinancial',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  env: process.env.NODE_ENV || 'development'
};

// Override configuration for test environment
if (process.env.NODE_ENV === 'test') {
  config.mongodbUri = 'mongodb://localhost:27017/gerifinancial-test';
  config.jwtSecret = 'test-secret';
  config.jwtExpiration = '1h';
}

module.exports = config;
