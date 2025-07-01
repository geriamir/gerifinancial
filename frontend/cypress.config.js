const { defineConfig } = require('cypress');
const db = require('./cypress/tasks/db');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      on('task', {
        'db:addTransactions': db.addTransactions,
        'db:clearTestData': db.clearTestData,
        'console:log': (message) => {
          console.log(message);
          return null; // Cypress tasks must return something
        }
      });
      
      // Set environment variables
      config.env = {
        ...config.env,
        apiUrl: 'http://localhost:3001'
      };

      return config;
    },
  }
});
