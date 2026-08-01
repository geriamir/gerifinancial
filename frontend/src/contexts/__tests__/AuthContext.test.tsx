import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';
import { authApi } from '../../services/api';

jest.mock('../../services/api', () => ({
  authApi: {
    getProfile: jest.fn(),
    logout: jest.fn()
  }
}));

const mockedApi = authApi as jest.Mocked<typeof authApi>;

let logoutResult: Promise<void> | null = null;

const Consumer: React.FC = () => {
  const { isAuthenticated, isLoading, logout } = useAuth();

  return (
    <div>
      <span data-testid="status">
        {isLoading ? 'loading' : isAuthenticated ? 'signed-in' : 'signed-out'}
      </span>
      <button
        onClick={() => {
          logoutResult = logout();
        }}
      >
        logout
      </button>
    </div>
  );
};

const renderSignedIn = async () => {
  mockedApi.getProfile.mockResolvedValue({
    user: { id: '1', email: 'someone@example.com', name: 'Someone' }
  } as Awaited<ReturnType<typeof authApi.getProfile>>);

  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  );

  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed-in'));
};

describe('AuthContext logout', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logoutResult = null;
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('clears the session and resolves on success', async () => {
    mockedApi.logout.mockResolvedValue(undefined);
    await renderSignedIn();

    await userEvent.click(screen.getByText('logout'));

    await expect(logoutResult).resolves.toBeUndefined();
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out');
  });

  // Callers navigate away once this resolves, so a rejection would leave them
  // stranded mid-sign-out with an unhandled promise rejection.
  it('signs out locally and still resolves when the request fails', async () => {
    mockedApi.logout.mockRejectedValue(new Error('network is down'));
    await renderSignedIn();

    await userEvent.click(screen.getByText('logout'));

    await expect(logoutResult).resolves.toBeUndefined();
    expect(screen.getByTestId('status')).toHaveTextContent('signed-out');
    expect(consoleError).toHaveBeenCalled();
  });
});
