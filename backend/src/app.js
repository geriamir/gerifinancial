const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const ensureLogsDir = require('./middleware/ensureLogsDir');

// Ensure logs directory exists in production
ensureLogsDir();
const scrapingSchedulerService = require('./services/scrapingSchedulerService');
const stockPriceService = require('./services/rsu/stockPriceService');
const vestingService = require('./services/rsu/vestingService');

// Import routes
const authRoutes = require('./routes/auth');
const bankAccountRoutes = require('./routes/bankAccounts');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const categoryBudgetRoutes = require('./routes/categoryBudgets');
const rsuRoutes = require('./routes/rsus');
const investmentRoutes = require('./routes/investments');
const portfolioRoutes = require('./routes/portfolios');
const onboardingRoutes = require('./routes/onboarding');
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

      // Only initialize schedulers in production and E2E environments
      if (process.env.NODE_ENV !== 'test' || process.env.NODE_ENV === 'e2e') {
        try {
          await scrapingSchedulerService.initialize();
          logger.info('Transaction scraping scheduler initialized');
        } catch (error) {
          logger.error('Failed to initialize transaction scraping scheduler:', error);
        }

        try {
          await stockPriceService.initialize();
          logger.info('Stock price service initialized');
        } catch (error) {
          logger.error('Failed to initialize stock price service:', error);
        }

        try {
          await vestingService.initialize();
          logger.info('Vesting service initialized');
        } catch (error) {
          logger.error('Failed to initialize vesting service:', error);
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
app.use('/api/users', require('./routes/users'));
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/category-budgets', categoryBudgetRoutes);
app.use('/api/rsus', rsuRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/onboarding', onboardingRoutes);

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
