const app = require('./app');
const config = require('./shared/config');

const server = app.listen(config.port, async () => {
  console.log(`Server is running on port ${config.port}`);
  // Note: ScrapingSchedulerService handles startup sync initialization in app.js
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});
