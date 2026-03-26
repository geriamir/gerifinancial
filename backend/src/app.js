const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./shared/config');
const logger = require('./shared/utils/logger');
const ensureLogsDir = require('./shared/middleware/ensureLogsDir');

const strategyRegistry = require('./shared/services/strategyRegistry');

// Ensure logs directory exists in production
ensureLogsDir();

// Global strategy registry placeholder (initialized lazily via strategyRegistry)
global.syncStrategies = null;

const scrapingSchedulerService = require('./banking/services/scrapingSchedulerService');
const scrapingEventHandlers = require('./banking/services/scrapingEventHandlers');
const onboardingEventHandlers = require('./onboarding/services/onboardingEventHandlers');
const eventBridge = require('./shared/services/eventBridge');
const stockPriceService = require('./rsu/services/stockPriceService');
const vestingService = require('./rsu/services/vestingService');
const currencyExchangeService = require('./foreign-currency/services/currencyExchangeService');

// Import routes
const authRoutes = require('./auth/routes/auth');
const bankAccountRoutes = require('./banking/routes/bankAccounts');
const creditCardRoutes = require('./banking/routes/creditCards');
const transactionRoutes = require('./banking/routes/transactions');
const budgetRoutes = require('./shared/routes/budgets');
const categoryBudgetRoutes = require('./monthly-budgets/routes/categoryBudgets');
const patternRoutes = require('./monthly-budgets/routes/patterns');
const rsuRoutes = require('./rsu/routes/rsus');
const investmentRoutes = require('./investments/routes/investments');
const portfolioRoutes = require('./investments/routes/portfolios');
const foreignCurrencyRoutes = require('./foreign-currency/routes/foreignCurrency');
const onboardingRoutes = require('./onboarding/routes/onboarding');
const pensionRoutes = require('./pension/routes/pension');
const realEstateRoutes = require('./real-estate/routes/realEstate');
const eventsRoutes = require('./shared/routes/events');
const testRoutes = require('./shared/routes/test');

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

      // Initialize sync strategies first to avoid circular dependencies
      try {
        strategyRegistry.ensureInitialized();
        logger.info('Sync strategies initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize sync strategies:', error);
      }

      // Initialize scraping event handlers for async post-processing
      try {
        scrapingEventHandlers.initialize();
        logger.info('Scraping event handlers initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize scraping event handlers:', error);
      }

      // Initialize onboarding event handlers for progress tracking
      try {
        onboardingEventHandlers.initialize();
        logger.info('Onboarding event handlers initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize onboarding event handlers:', error);
      }

      // Initialize event bridge for SSE real-time updates
      try {
        eventBridge.initialize();
        logger.info('Event bridge initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize event bridge:', error);
      }

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

        try {
          await currencyExchangeService.initialize();
          logger.info('Currency exchange service initialized');
        } catch (error) {
          logger.error('Failed to initialize currency exchange service:', error);
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
app.use('/api/users', require('./auth/routes/users'));
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/credit-cards', creditCardRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/budgets/patterns', patternRoutes);
app.use('/api/category-budgets', categoryBudgetRoutes);
app.use('/api/rsus', rsuRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/foreign-currency', foreignCurrencyRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/pension', pensionRoutes);
app.use('/api/real-estate', realEstateRoutes);
app.use('/api/events', eventsRoutes);

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
