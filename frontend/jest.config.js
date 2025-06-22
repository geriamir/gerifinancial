module.exports = {
  preset: 'react-scripts',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  // Make sure Jest can find node_modules
  moduleDirectories: ['node_modules', '<rootDir>/src'],

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
