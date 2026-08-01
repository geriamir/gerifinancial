import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthLayout from '../AuthLayout';

const mockNavigate = jest.fn();
const mockLogout = jest.fn();

jest.mock('react-router-dom', () => ({
  Outlet: () => null,
  useNavigate: () => mockNavigate
}));

jest.mock('../NavigationMenu', () => ({
  NavigationMenu: () => null
}));

jest.mock('../../../contexts/ThemeContext', () => ({
  useThemeMode: () => ({ mode: 'light', toggleTheme: jest.fn() })
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'logout@example.com', name: 'Logout User' },
    logout: mockLogout
  })
}));

describe('AuthLayout logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The session is an httpOnly cookie, so only the server can clear it.
  // Navigating before that request resolves can abort it, which would leave the
  // user looking at the login page while their cookie still works.
  it('waits for the session to be cleared before navigating away', async () => {
    const user = userEvent.setup();
    let resolveLogout: () => void = () => {};
    mockLogout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        })
    );

    render(<AuthLayout />);

    await user.click(screen.getByTestId('user-avatar'));
    await user.click(screen.getByText('Logout'));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();

    resolveLogout();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });
});
