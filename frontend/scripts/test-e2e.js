const concurrently = require('concurrently');
const waitOn = require('wait-on');
const axios = require('axios');

async function checkBackendHealth() {
  try {
    const response = await axios.get('http://localhost:3001/api/auth/profile');
    return response.status === 401; // Unauthorized means the server is running
  } catch (error) {
    if (error.response?.status === 401) {
      return true; // Server is running but needs auth
    }
    return false;
  }
}

async function runTests() {
  let servers;

  try {
    // Start both servers
    servers = concurrently([
      { command: 'cd ../backend && npm run dev', name: 'backend' },
      { command: 'npm start', name: 'frontend' }
    ], {
      killOthers: ['failure', 'success'],
      successCondition: 'all'
    });

    console.log('Waiting for servers to start...');

    // Wait for frontend
    await waitOn({
      resources: ['http://localhost:3000'],
      timeout: 60000,
      delay: 1000,
      interval: 1000,
      log: true,
      verbose: true
    });

    // Wait for backend with custom health check
    let backendReady = false;
    const startTime = Date.now();
    while (!backendReady && Date.now() - startTime < 60000) {
      backendReady = await checkBackendHealth();
      if (!backendReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!backendReady) {
      throw new Error('Backend server failed to start');
    }

    console.log('Servers are ready. Running tests...');

    // Run Cypress tests
    const { result: testResult } = await concurrently([
      { command: 'npx cypress run --spec "cypress/e2e/auth/login.cy.ts"', name: 'cypress' }
    ], {
      successCondition: 'all'
    });

    console.log('Tests completed');
    process.exit(0);
  } catch (error) {
    console.error('Error occurred:', error);
    process.exit(1);
  } finally {
    if (servers) {
      console.log('Cleaning up servers...');
      servers.commands.forEach(command => {
        if (command.kill) command.kill('SIGTERM');
      });
    }
  }
}

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Cleaning up...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Cleaning up...');
  process.exit(0);
});

runTests();
