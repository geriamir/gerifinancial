import { useCallback, useEffect, useState } from 'react';
import { AuthResponse, authApi } from '../services/api/auth';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthResponse['user'] | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    console.log('Initial auth state:', { hasToken: !!token, hasUser: !!user });
    
    return {
      isAuthenticated: !!token && !!user,
      token,
      user
    };
  });

  const login = useCallback(async (email: string, password: string) => {
    console.log('Attempting login for:', email);
    const response = await authApi.login({ email, password });
    
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    setAuthState({
      isAuthenticated: true,
      token: response.token,
      user: response.user
    });

    console.log('Login successful:', { user: response.user.email });
  }, []);

  const logout = useCallback(() => {
    console.log('Logging out user:', authState.user?.email);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthState({
      isAuthenticated: false,
      token: null,
      user: null
    });
  }, [authState.user?.email]);

  // Verify token and load user profile on mount
  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          console.log('Verifying stored token...');
          const { user } = await authApi.getProfile();
          localStorage.setItem('user', JSON.stringify(user));
          setAuthState({
            isAuthenticated: true,
            token,
            user
          });
          console.log('Token verification successful:', { user: user.email });
        } catch (error) {
          console.error('Token verification failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setAuthState({
            isAuthenticated: false,
            token: null,
            user: null
          });
        }
      }
    };

    verifyAuth();
  }, []);

  return {
    ...authState,
    login,
    logout
  };
};
