const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const ensureLogsDir = require('./middleware/ensureLogsDir');

// Ensure logs directory exists in production
ensureLogsDir();
const scrapingSchedulerService = require('./services/scrapingSchedulerService');

// Import routes
const authRoutes = require('./routes/auth');
const bankAccountRoutes = require('./routes/bankAccounts');
const transactionRoutes = require('./routes/transactions');
const testRoutes = require('./routes/test');

// Create Express app
const app = express();

// Connect to MongoDB (skip only in test environment for unit tests)
if (config.env === 'test') {
  console.log('Skipping MongoDB connection in test environment (for unit tests)');
} else {
  console.log('Connecting to MongoDB at:', config.mongodbUri);
  mongoose.connect(config.mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
    .then(async () => {
      console.log('Connected to MongoDB');
      // Only initialize scheduler in production and E2E environments
      if (process.env.NODE_ENV !== 'test' || process.env.NODE_ENV === 'e2e') {
        try {
          await scrapingSchedulerService.initialize();
          logger.info('Transaction scraping scheduler initialized');
        } catch (error) {
          logger.error('Failed to initialize transaction scraping scheduler:', error);
        }
      }
    })
    .catch(err => console.error('MongoDB connection error:', err));
}

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  // Check MongoDB connection state
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  if (mongoStatus === 'connected') {
    res.status(200).json({ 
      status: 'ok',
      mongo: mongoStatus
    });
  } else {
    res.status(503).json({ 
      status: 'error',
      mongo: mongoStatus
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/transactions', transactionRoutes);

// Test routes (enabled in test and e2e environments)
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e') {
  app.use('/api/test', testRoutes);
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
