// Utility to suppress React act warnings in tests
// This is needed for Material-UI components and async operations that are difficult to wrap in act()

const originalError = console.error;

export const suppressActWarnings = () => {
  console.error = (...args) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('Warning: An update to') ||
       message.includes('not wrapped in act(...)') ||
       message.includes('The current testing environment is not configured to support act'))
    ) {
      return; // Suppress these warnings
    }
    originalError(...args);
  };
};

export const restoreConsoleError = () => {
  console.error = originalError;
};
