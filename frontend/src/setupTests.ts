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

// Mock window.matchMedia for Material-UI.
// NOTE: react-scripts sets `resetMocks: true`, which clears implementations of
// `jest.fn()` before every test. These globals must therefore be plain
// functions, not jest mocks, or they return `undefined` inside tests and MUI's
// useMediaQuery throws "Cannot read properties of undefined (reading 'matches')".
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock window.ResizeObserver for Material-UI (plain class for the same reason)
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// Mock useSSE hook for testing
jest.mock('./hooks/useSSE', () => ({
  useSSE: jest.fn(() => ({
    connected: false,
    error: null,
    lastEvent: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));
