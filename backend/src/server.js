const app = require('./app');
const config = require('./config');
const startupInvestmentService = require('./services/startupInvestmentService');

const server = app.listen(config.port, async () => {
  console.log(`Server is running on port ${config.port}`);
  
  // Check and scrape account data in background after server starts
  try {
    // Wait a moment for the server to fully initialize
    setTimeout(async () => {
      await startupInvestmentService.checkAndScrapeAccounts();
    }, 5000); // 5 second delay to let server fully start
  } catch (error) {
    console.error('Error during startup account data sync check:', error.message);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});
