require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/gerifinancial',
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    expiresIn: process.env.JWT_EXPIRATION || '24h'
  },
  env: process.env.NODE_ENV || 'development'
};
