const { spawn, execSync } = require('child_process');
const waitOn = require('wait-on');
const { MongoClient } = require('mongodb');

// Clear the E2E test database before starting
async function clearDatabase() {
  console.log('Clearing E2E test database...');
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('gerifinancial-e2e');
    await db.dropDatabase();
    console.log('✅ Database cleared successfully');
  } catch (error) {
    console.warn('⚠️ Warning: Could not clear database:', error.message);
    console.log('Continuing with tests...');
  } finally {
    await client.close();
  }
}

// Start backend and frontend servers
async function startTests() {
  // Clear database first
  await clearDatabase();
  
  console.log('Starting servers...');
const backend = spawn('npm', ['run', 'backend'], { 
  stdio: 'inherit',
  shell: true,
  detached: true,
  env: {
    ...process.env,
    NODE_ENV: 'e2e',
    MONGODB_URI: 'mongodb://localhost:27017/gerifinancial-e2e'
  }
});

const frontend = spawn('npm', ['run', 'frontend'], { 
  stdio: 'inherit',
  shell: true,
  detached: true,
  env: {
    ...process.env,
    MONGODB_URI: 'mongodb://localhost:27017/gerifinancial-e2e'
  }
});

// Function to kill processes and their children
const cleanup = () => {
  try {
    process.kill(-backend.pid);
  } catch (error) {
    console.warn(`Failed to kill backend process: ${error.message}`);
  }
  try {
    process.kill(-frontend.pid);
  } catch (error) {
    console.warn(`Failed to kill frontend process: ${error.message}`);
  }
  execSync('npm run kill-ports', { stdio: 'inherit' });
};

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Wait for both servers to be ready
waitOn({
  resources: [
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001/health'
  ],
  timeout: 90000
}).then(() => {
  console.log('Servers are ready, running E2E tests...');
  try {
    // Run Cypress tests
    execSync('cd frontend && npm run cypress:run', {
      stdio: 'inherit',
      env: {
        ...process.env,
        MONGODB_URI: 'mongodb://localhost:27017/gerifinancial-e2e'
      }
    });
    console.log('Tests completed successfully');
    cleanup();
    process.exit(0);
  } catch (error) {
    console.error('Tests failed');
    cleanup();
    process.exit(1);
  }
}).catch((err) => {
  console.error('Servers failed to start', err);
  cleanup();
  process.exit(1);
});
}

// Run the tests
startTests().catch((err) => {
  console.error('Failed to start tests:', err);
  process.exit(1);
});
