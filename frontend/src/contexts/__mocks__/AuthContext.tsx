import React from 'react';

const authContext = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  logout: () => Promise.resolve(),
};

export const AuthContext = React.createContext(authContext);

export const useAuth = () => authContext;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>;
};
