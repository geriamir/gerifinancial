import { useState, useEffect, useCallback } from 'react';
import { onboardingApi, OnboardingStatus } from '../services/api/onboarding';
import { useSSE } from './useSSE';

interface UseOnboardingResult {
  status: OnboardingStatus | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<OnboardingStatus>;
  addCheckingAccount: (bankId: string, credentials: any, displayName?: string) => Promise<any>;
  addCreditCardAccount: (bankId: string, credentials: any, displayName?: string) => Promise<any>;
  proceedToCreditCardSetup: () => Promise<void>;
  skipCreditCards: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

/**
 * Custom hook for managing onboarding state
 * 
 * Features:
 * - Fetches onboarding status
 * - Real-time updates via SSE
 * - Methods for onboarding actions
 * - Error handling
 * 
 * @returns Onboarding state and methods
 */
export const useOnboarding = (): UseOnboardingResult => {

  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch current onboarding status
   */
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await onboardingApi.getOnboardingStatus();
      setStatus(data);
      setLoading(false);
      return data;
    } catch (err) {
      setError(err as Error);
      setLoading(false);
      throw err;
    }
  }, []);

  /**
   * Handle SSE events - refetch status when events occur
   */
  const handleSSEEvent = useCallback(async (event: any) => {
    console.log('[useOnboarding] Received SSE event:', event.type);
    
    // Refetch status on relevant events
    switch (event.type) {
      case 'scraping:started':
      case 'scraping:progress':
      case 'scraping:completed':
      case 'scraping:failed':
      case 'onboarding:credit-card-detection':
      case 'onboarding:credit-card-matching':
        await fetchStatus();
        break;
    }
  }, [fetchStatus]);

  // Connect to SSE for real-time updates
  useSSE(handleSSEEvent, { autoConnect: true });

  /**
   * Add checking account during onboarding
   */
  const addCheckingAccount = useCallback(async (
    bankId: string, 
    credentials: any, 
    displayName?: string
  ) => {
    try {
      setError(null);
      const result = await onboardingApi.addCheckingAccount(bankId, credentials, displayName);
      // Delay to let backend update before refetching (3 seconds to ensure backend has started scraping)
      await new Promise(resolve => setTimeout(resolve, 3000));
      // Refetch status after adding account
      await fetchStatus();
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [fetchStatus]);

  /**
   * Add credit card account during onboarding
   */
  const addCreditCardAccount = useCallback(async (
    bankId: string,
    credentials: any,
    displayName?: string
  ) => {
    try {
      setError(null);
      const result = await onboardingApi.addCreditCardAccount(bankId, credentials, displayName);
      // Refetch status after adding account
      await fetchStatus();
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [fetchStatus]);

  /**
   * Skip credit card setup
   */
  const proceedToCreditCardSetup = useCallback(async () => {
    try {
      setError(null);
      await onboardingApi.proceedToCreditCardSetup();
      // Refetch status after proceeding
      await fetchStatus();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [fetchStatus]);

  const skipCreditCards = useCallback(async () => {
    try {
      setError(null);
      await onboardingApi.skipCreditCards();
      // Refetch status after skipping
      await fetchStatus();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [fetchStatus]);

  /**
   * Complete onboarding (with or without full coverage)
   */
  const completeOnboarding = useCallback(async () => {
    try {
      setError(null);
      await onboardingApi.completeOnboarding();
      // Refetch status after completing
      await fetchStatus();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [fetchStatus]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus,
    addCheckingAccount,
    addCreditCardAccount,
    proceedToCreditCardSetup,
    skipCreditCards,
    completeOnboarding
  };
};

/**
 * Helper hook to determine what UI to show based on current step
 */
export const useOnboardingStep = (status: OnboardingStatus | null) => {
  if (!status) {
    return 'loading';
  }

  switch (status.currentStep) {
    case 'checking-account':
      return 'connect-checking';
      
    case 'transaction-import':
      if (status.transactionImport.scrapingStatus.isActive) {
        return 'importing';
      }
      return 'waiting';
      
    case 'credit-card-detection':
      return 'analyzing';
      
    case 'credit-card-setup':
      return 'credit-card-setup';
      
    case 'credit-card-matching':
      if (!status.creditCardMatching.completed) {
        return 'matching';
      }
      return 'matching-complete';
      
    case 'complete':
      return 'complete';
      
    default:
      return 'unknown';
  }
};
