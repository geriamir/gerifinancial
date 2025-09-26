import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { onboardingApi } from '../../services/api/onboarding';

interface OnboardingStatus {
  isComplete: boolean;
  hasCheckingAccount: boolean;
  completedSteps: string[];
}

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isOnboardingPage = location.pathname === '/onboarding';

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isAuthenticated || !user) {
        setLoading(false);
        return;
      }

      try {
        // Check if user has onboarding status
        const status = await onboardingApi.getStatus();
        setOnboardingStatus(status);
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        // Fallback: assume onboarding is needed for new users
        setOnboardingStatus({
          isComplete: false,
          hasCheckingAccount: false,
          completedSteps: []
        });
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkOnboardingStatus();
    }
  }, [isAuthenticated, user, authLoading]);

  // Also check onboarding status when location changes (helps with race conditions)
  useEffect(() => {
    const recheckOnboardingStatus = async () => {
      if (!isAuthenticated || !user || authLoading) return;

      try {
        const status = await onboardingApi.getStatus();
        setOnboardingStatus(status);
      } catch (error) {
        console.error('Failed to recheck onboarding status:', error);
      }
    };

    // Recheck status when navigating to/from onboarding page
    if (isAuthenticated && user && !authLoading) {
      recheckOnboardingStatus();
    }
  }, [location.pathname, isAuthenticated, user, authLoading]);

  // Show loading while checking auth and onboarding status
  if (authLoading || loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          gap: 2
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="body1" color="text.secondary">
          Loading your account...
        </Typography>
      </Box>
    );
  }

  // If not authenticated, let the normal auth flow handle it
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // If we don't have onboarding status, assume complete (fallback)
  if (!onboardingStatus) {
    return <>{children}</>;
  }

  // If user has completed onboarding, allow access to all pages
  if (onboardingStatus.isComplete) {
    // If user is on onboarding page but already completed, redirect to overview
    if (isOnboardingPage) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  // If user has not completed onboarding
  if (!onboardingStatus.isComplete) {
    // If user is not on onboarding page, redirect them to onboarding
    if (!isOnboardingPage) {
      return <Navigate to="/onboarding" replace />;
    }
    // If they're already on onboarding page, let them proceed
    return <>{children}</>;
  }

  // Default fallback
  return <>{children}</>;
};
