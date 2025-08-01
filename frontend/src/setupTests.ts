import '@testing-library/jest-dom';
// Skip configure import due to React 19 compatibility issues
// import { configure } from '@testing-library/react';

// Add missing TextEncoder/TextDecoder implementations
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Skip testing library configuration due to React 19 compatibility issues
// configure({
//   testIdAttribute: 'data-testid',
// });

// Mock window.matchMedia for Material-UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.ResizeObserver for Material-UI
window.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
