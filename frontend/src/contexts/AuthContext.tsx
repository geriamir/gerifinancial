import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, AuthUser } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Resolves once the session has been cleared. Never rejects: a failed
   *  request is reported and the local state is cleared regardless. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // There is no token to inspect: the session lives in an httpOnly cookie the
    // page cannot read, so the only way to know whether one exists is to ask.
    const initializeAuth = async () => {
      try {
        const response = await authApi.getProfile();
        setUser(response.user);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Deliberately not rethrown. The session cookie is httpOnly, so if the
      // request fails there is nothing the page can do to end the session
      // itself, and callers have no meaningful way to recover. Rejecting here
      // would only strand them mid-sign-out.
      console.error('Failed to clear the session on the server:', error);
    } finally {
      // Clear locally even if the request failed, so the user is not left
      // looking at a signed-in page they can no longer use.
      setUser(null);
    }
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
