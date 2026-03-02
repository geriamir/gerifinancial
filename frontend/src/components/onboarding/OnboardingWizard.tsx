import React from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  CheckingAccountSetup,
  TransactionImport,
  CreditCardDetection,
  CreditCardSetup,
  CreditCardVerification,
  OnboardingComplete
} from './index';
import { useOnboarding, useOnboardingStep } from '../../hooks/useOnboarding';

export interface OnboardingStepProps {
  onComplete?: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  stepData?: any;
}

export const OnboardingWizard: React.FC = () => {
  const {
    status,
    loading,
    error,
    addCheckingAccount,
    addCreditCardAccount,
    proceedToCreditCardSetup,
    skipCreditCards,
    completeOnboarding,
    refetch
  } = useOnboarding();

  // Handler to go back to credit card setup from verification
  const handleAddMoreCards = async () => {
    try {
      await proceedToCreditCardSetup();
    } catch (err) {
      console.error('Failed to navigate back to credit card setup:', err);
    }
  };

  const currentUI = useOnboardingStep(status);

  // Loading state
  if (loading && !status) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Loading your onboarding progress...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error && !status) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Alert severity="error">
          Failed to load onboarding status. Please refresh the page.
        </Alert>
      </Box>
    );
  }

  if (!status) {
    return null;
  }

  // Define steps for progress indicator
  const steps = [
    { 
      id: 'checking-account', 
      title: 'Connect Account', 
      description: 'Link your checking account' 
    },
    { 
      id: 'transaction-import', 
      title: 'Import Data', 
      description: 'Import your transactions' 
    },
    { 
      id: 'credit-card-detection', 
      title: 'Analyze Usage', 
      description: 'Detect credit card usage' 
    },
    { 
      id: 'credit-card-setup', 
      title: 'Credit Cards', 
      description: 'Connect credit cards' 
    },
    { 
      id: 'credit-card-matching', 
      title: 'Match Payments', 
      description: 'Link payments to cards' 
    },
    { 
      id: 'complete', 
      title: 'Complete', 
      description: 'Setup finished' 
    }
  ];

  // Map current step to index
  const stepMap: Record<string, number> = {
    'checking-account': 0,
    'transaction-import': 1,
    'credit-card-detection': 2,
    'credit-card-setup': 3,
    'credit-card-matching': 4,
    'complete': 5
  };

  const currentStepIndex = stepMap[status.currentStep] || 0;
  const completedStepsCount = status.completedSteps.length;
  const overallProgress = status.isComplete ? 100 : (completedStepsCount / steps.length) * 100;

  // Render current step component based on UI state
  const renderCurrentStep = () => {
    const commonProps = {
      onComplete: refetch,
      stepData: status
    };

    switch (currentUI) {
      case 'connect-checking':
        return (
          <CheckingAccountSetup
            {...commonProps}
            onConnect={addCheckingAccount}
          />
        );

      case 'importing':
      case 'waiting':
        return (
          <TransactionImport
            {...commonProps}
            importStatus={status.transactionImport}
            scrapingStatus={status.transactionImport.scrapingStatus}
          />
        );

      case 'analyzing':
        return (
          <CreditCardDetection
            {...commonProps}
            detection={status.creditCardDetection}
            onProceed={proceedToCreditCardSetup}
            onSkip={skipCreditCards}
          />
        );

      case 'credit-card-setup':
        return (
          <CreditCardSetup
            {...commonProps}
            detection={status.creditCardDetection}
            onConnect={addCreditCardAccount}
            onSkip={skipCreditCards}
          />
        );

      case 'matching':
      case 'matching-complete':
        return (
          <CreditCardVerification
            {...commonProps}
            matching={status.creditCardMatching}
            onAddMoreCards={handleAddMoreCards}
            onCompleteOnboarding={completeOnboarding}
          />
        );

      case 'complete':
        return (
          <OnboardingComplete
            {...commonProps}
            onboardingStatus={status}
          />
        );

      default:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Loading...
            </Typography>
          </Box>
        );
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to GeriFinancial
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Let's set up your financial overview in a few simple steps
        </Typography>

        {/* Overall Progress */}
        <Box sx={{ mt: 2, mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Step {currentStepIndex + 1} of {steps.length}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={overallProgress}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error.message || 'An error occurred. Please try again.'}
        </Alert>
      )}

      {/* Step Progress Indicator */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={currentStepIndex} alternativeLabel>
            {steps.map((step, index) => {
              const isCompleted = status.completedSteps.includes(step.id);
              const isCurrent = status.currentStep === step.id;

              return (
                <Step key={step.id} completed={isCompleted}>
                  <StepLabel>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography 
                        variant="body2" 
                        fontWeight={isCurrent ? 'bold' : 'normal'}
                      >
                        {step.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {step.description}
                      </Typography>
                    </Box>
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardContent>
          {renderCurrentStep()}
        </CardContent>
      </Card>

    </Box>
  );
};
