import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the AuthContext module
jest.mock('./contexts/AuthContext', () => require('./test/__mocks__/AuthContext'));

describe('App', () => {
  test('renders login form when not authenticated', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
  });
});
