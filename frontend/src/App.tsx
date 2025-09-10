import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { he } from 'date-fns/locale';
import { AuthProvider } from './contexts/AuthContext';
import { BudgetProvider } from './contexts/BudgetContext';
import { RSUProvider } from './contexts/RSUContext';
import { InvestmentProvider } from './contexts/InvestmentContext';
import { ProjectProvider } from './contexts/ProjectContext';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import AuthLayout from './components/layout/AuthLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { OnboardingGuard } from './components/auth/OnboardingGuard';
import Overview from './pages/Overview';
import TransactionsPage from './pages/Transactions';
import BudgetsPage from './pages/Budgets';
import BudgetSubcategoryDetail from './pages/BudgetSubcategoryDetail';
import RSUs from './pages/RSUs';
import Investments from './pages/Investments';
import Projects from './pages/Projects';
import ForeignCurrency from './pages/ForeignCurrency';
import OnboardingPage from './pages/Onboarding';
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
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={he}>
      <AuthProvider>
        <Router>
          <OnboardingGuard>
            <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
            
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <BudgetProvider>
                    <RSUProvider>
                      <InvestmentProvider>
                        <ProjectProvider>
                          <AuthLayout />
                        </ProjectProvider>
                      </InvestmentProvider>
                    </RSUProvider>
                  </BudgetProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              {/* New simplified budget detail route */}
              <Route path="budgets/detail" element={<BudgetSubcategoryDetail />} />
              {/* Legacy routes for backward compatibility */}
              <Route path="budgets/subcategory/:year/:month/:categoryId/:subcategoryId" element={<BudgetSubcategoryDetail />} />
              <Route path="budgets/income/:year/:month/:categoryId" element={<BudgetSubcategoryDetail />} />
              <Route path="rsus" element={<RSUs />} />
              <Route path="investments" element={<Investments />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:projectId" element={<Projects />} />
              <Route path="foreign-currency" element={<ForeignCurrency />} />
              <Route path="foreign-currency/accounts/:accountNumber" element={<ForeignCurrency />} />
              <Route path="foreign-currency/accounts/:accountNumber/transactions" element={<ForeignCurrency />} />
              <Route path="foreign-currency/convert" element={<ForeignCurrency />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            </Routes>
          </OnboardingGuard>
        </Router>
      </AuthProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default App;
