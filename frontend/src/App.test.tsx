import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the AuthContext module
jest.mock('./contexts/AuthContext');

describe('App', () => {
  test('renders the sign-in screen when not authenticated', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByTestId('github-login-button')).toBeInTheDocument();
  });
});
