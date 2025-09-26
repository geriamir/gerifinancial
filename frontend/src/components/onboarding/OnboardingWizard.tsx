import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  CheckingAccountSetup,
  TransactionImport,
  CreditCardDetection,
  CreditCardSetup,
  CreditCardVerification,
  OnboardingComplete
} from './index';
import { useOnboarding } from '../../hooks/useOnboarding';

export interface OnboardingStep {
  id: 'checking-account' | 'transaction-import' | 'credit-card-detection' | 'credit-card-setup' | 'credit-card-verification' | 'complete';
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
  isComplete: boolean;
  isSkippable?: boolean;
}

export interface OnboardingStepProps {
  onComplete: (nextStep?: OnboardingStep['id'], data?: any) => Promise<void>;
  onSkip?: () => void;
  onBack?: () => void;
  stepData?: any;
}

export interface OnboardingData {
  checkingAccount?: {
    bankId: string;
    name: string;
    accountId: string;
  };
  transactionImport?: {
    transactionsImported: number;
    categorized: number;
    importDate: Date;
  };
  creditCardAnalysis?: {
    hasCreditCardActivity: boolean;
    transactionCount: number;
    recommendation: 'connect' | 'optional' | 'skip';
    analysisDate: Date;
  };
  creditCards?: Array<{
    id: string;
    displayName: string;
    provider: string;
  }>;
}

export const OnboardingWizard: React.FC = () => {
  const [currentStepId, setCurrentStepId] = useState<OnboardingStep['id'] | null>(null);
  const [stepTransitionData, setStepTransitionData] = useState<any>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const {
    completedSteps,
    onboardingData,
    loading,
    error,
    updateOnboardingStatus,
    loadOnboardingStatus,
    clearError
  } = useOnboarding();

  // Determine current step based on completed steps
  const determineCurrentStep = (completedStepSet: Set<string>): OnboardingStep['id'] => {
    const stepOrder: OnboardingStep['id'][] = [
      'checking-account',
      'transaction-import', 
      'credit-card-detection',
      'credit-card-setup',
      'credit-card-verification',
      'complete'
    ];

    // If onboarding is complete, show complete step
    if (completedStepSet.has('complete')) {
      return 'complete';
    }

    // Find the first incomplete step
    for (const stepId of stepOrder) {
      if (!completedStepSet.has(stepId)) {
        return stepId;
      }
    }

    // All steps completed but not marked as complete - should go to complete step
    return 'complete';
  };

  // Load onboarding status on mount
  useEffect(() => {
    const initializeOnboarding = async () => {
      const status = await loadOnboardingStatus();
      if (status) {
        const currentStep = determineCurrentStep(new Set(status.completedSteps));
        setCurrentStepId(currentStep);
      } else {
        // Fallback to first step if load fails
        setCurrentStepId('checking-account');
      }
      setInitialLoadComplete(true);
    };

    initializeOnboarding();
  }, [loadOnboardingStatus]);

  // Don't render until initial load is complete
  if (!initialLoadComplete || currentStepId === null) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, textAlign: 'center' }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Loading your onboarding progress...
        </Typography>
      </Box>
    );
  }

  const steps: OnboardingStep[] = [
    {
      id: 'checking-account',
      title: 'Connect Checking Account',
      description: 'Connect your main checking account to start',
      component: CheckingAccountSetup,
      isComplete: completedSteps.has('checking-account')
    },
    {
      id: 'transaction-import',
      title: 'Import Transactions',
      description: 'Import 6 months of transaction history',
      component: TransactionImport,
      isComplete: completedSteps.has('transaction-import')
    },
    {
      id: 'credit-card-detection',
      title: 'Credit Card Analysis',
      description: 'Analyze your credit card usage',
      component: CreditCardDetection,
      isComplete: completedSteps.has('credit-card-detection')
    },
    {
      id: 'credit-card-setup',
      title: 'Connect Credit Cards',
      description: 'Add your credit card accounts',
      component: CreditCardSetup,
      isComplete: completedSteps.has('credit-card-setup'),
      isSkippable: true
    },
    {
      id: 'credit-card-verification',
      title: 'Verify Coverage',
      description: 'Verify your credit card coverage is complete',
      component: CreditCardVerification,
      isComplete: completedSteps.has('credit-card-verification')
    },
    {
      id: 'complete',
      title: 'Setup Complete',
      description: 'Your financial overview is ready',
      component: OnboardingComplete,
      isComplete: completedSteps.has('complete')
    }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStepId);
  const currentStep = steps[currentStepIndex];

  const handleStepComplete = async (nextStep?: OnboardingStep['id'], data?: any) => {
    clearError();
    
    // Store transition data for the next step
    if (data) {
      setStepTransitionData(data);
    }
    
    // Update backend onboarding status using the hook
    await updateOnboardingStatus(currentStepId, data);
    
    // Navigate to next step
    if (nextStep) {
      setCurrentStepId(nextStep);
    } else {
      // Auto-advance to next step
      const nextStepIndex = currentStepIndex + 1;
      if (nextStepIndex < steps.length) {
        setCurrentStepId(steps[nextStepIndex].id);
      }
    }
  };

  const handleStepSkip = () => {
    if (currentStep.isSkippable) {
      handleStepComplete();
    }
  };

  const handleStepBack = () => {
    const prevStepIndex = currentStepIndex - 1;
    if (prevStepIndex >= 0) {
      setCurrentStepId(steps[prevStepIndex].id);
    }
  };

  // Calculate overall progress
  // When on the complete step, show 100% progress for better UX
  const overallProgress = currentStepId === 'complete' ? 100 : (completedSteps.size / steps.length) * 100;

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
        <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      {/* Step Progress Indicator */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={currentStepIndex} alternativeLabel>
            {steps.map((step, index) => (
              <Step 
                key={step.id} 
                completed={step.isComplete}
              >
                <StepLabel>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" fontWeight={step.id === currentStepId ? 'bold' : 'normal'}>
                      {step.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {step.description}
                    </Typography>
                  </Box>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardContent>
          {loading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
            </Box>
          )}
          
          <currentStep.component
            onComplete={handleStepComplete}
            onSkip={currentStep.isSkippable ? handleStepSkip : undefined}
            onBack={currentStepIndex > 0 ? handleStepBack : undefined}
            stepData={{
              ...onboardingData,
              // For transaction-import step, also pass the fresh transition data
              ...(currentStepId === 'transaction-import' && stepTransitionData ? {
                bankAccountId: stepTransitionData.accountId,
                transitionData: stepTransitionData
              } : {}),
              // For credit-card-verification step, pass the transition data from credit card setup
              ...(currentStepId === 'credit-card-verification' && stepTransitionData ? {
                bankAccountId: stepTransitionData.bankAccountId,
                provider: stepTransitionData.provider,
                transitionData: stepTransitionData
              } : {})
            }}
          />
        </CardContent>
      </Card>

      {/* Debug Information (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" display="block">
            <strong>Debug Info:</strong>
          </Typography>
          <Typography variant="caption" display="block">
            Current Step: {currentStepId} ({currentStepIndex + 1}/{steps.length})
          </Typography>
          <Typography variant="caption" display="block">
            Completed: {Array.from(completedSteps).join(', ')}
          </Typography>
          <Typography variant="caption" display="block">
            Progress: {Math.round(overallProgress)}%
          </Typography>
        </Box>
      )}
    </Box>
  );
};
