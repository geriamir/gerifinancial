module.exports = {
  // Use react-scripts' default configuration
  ...require('react-scripts/config/jest/babelTransform'),
  
  // Make sure Jest can find node_modules
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // Add root directory to module name mapper
  moduleNameMapper: {
    '^react-router-dom$': '<rootDir>/node_modules/react-router-dom',
  },

  // Add test setup file
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Test environment setup
  testEnvironment: 'jsdom',

  // Include TypeScript files
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}'
  ],
};
