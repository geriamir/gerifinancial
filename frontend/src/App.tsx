import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import AuthLayout from './components/layout/AuthLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Dashboard placeholder component
const Dashboard = () => (
  <div>
    <h1>Dashboard</h1>
    <p>Welcome to GeriFinancial! Your financial management dashboard is coming soon.</p>
  </div>
);

// Profile placeholder component
const Profile = () => (
  <div>
    <h1>Profile</h1>
    <p>Your profile settings will be available here.</p>
  </div>
);

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AuthLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
