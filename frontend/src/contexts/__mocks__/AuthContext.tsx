import React from 'react';

const authContext = {
  isAuthenticated: false,
  isLoading: false,
  login: () => Promise.resolve(),
  logout: () => {},
  register: () => Promise.resolve(),
};

export const AuthContext = React.createContext(authContext);

export const useAuth = () => authContext;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: false,
        isLoading: false,
        login: () => Promise.resolve(),
        logout: () => {},
        register: () => Promise.resolve(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
