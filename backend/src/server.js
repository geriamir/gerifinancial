const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});
