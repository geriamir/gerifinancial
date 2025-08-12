import { useState, useCallback } from 'react';
import { onboardingApi, OnboardingStatus, UpdateOnboardingStatusDto } from '../services/api/onboarding';

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

export const useOnboarding = () => {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStepData = useCallback((stepId: string, data: any) => {
    setOnboardingData(prev => ({
      ...prev,
      [stepId.replace('-', '')]: data
    }));
  }, []);

  const markStepComplete = useCallback((stepId: string) => {
    setCompletedSteps(prev => new Set([...Array.from(prev), stepId]));
  }, []);

  const updateOnboardingStatus = useCallback(async (stepId: string, stepData?: any) => {
    setLoading(true);
    setError(null);
    
    try {
      // Update local state first
      markStepComplete(stepId);
      if (stepData) {
        updateStepData(stepId, stepData);
      }

      // Prepare data for backend update
      const newCompletedSteps = new Set([...Array.from(completedSteps), stepId]);
      const isComplete = stepId === 'complete' || newCompletedSteps.has('complete');
      
      const updateData: UpdateOnboardingStatusDto = {
        isComplete,
        completedSteps: Array.from(newCompletedSteps),
        hasCheckingAccount: newCompletedSteps.has('checking-account'),
        hasCreditCards: newCompletedSteps.has('credit-card-setup') && 
                       onboardingData.creditCards && 
                       onboardingData.creditCards.length > 0,
        creditCardAnalysisResults: onboardingData.creditCardAnalysis ? {
          transactionCount: onboardingData.creditCardAnalysis.transactionCount,
          recommendation: onboardingData.creditCardAnalysis.recommendation,
          analyzedAt: onboardingData.creditCardAnalysis.analysisDate instanceof Date 
            ? onboardingData.creditCardAnalysis.analysisDate 
            : new Date(onboardingData.creditCardAnalysis.analysisDate)
        } : undefined
      };

      // Update backend
      await onboardingApi.updateStatus(updateData);
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update onboarding status';
      setError(errorMessage);
      console.error('Failed to update onboarding status:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [completedSteps, onboardingData, markStepComplete, updateStepData]);

  const loadOnboardingStatus = useCallback(async (): Promise<OnboardingStatus | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const status = await onboardingApi.getStatus();
      setCompletedSteps(new Set(status.completedSteps));
      return status;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load onboarding status';
      setError(errorMessage);
      console.error('Failed to load onboarding status:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    completedSteps,
    onboardingData,
    loading,
    error,
    updateStepData,
    markStepComplete,
    updateOnboardingStatus,
    loadOnboardingStatus,
    clearError
  };
};
