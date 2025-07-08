import { useCallback } from 'react';
import { analytics } from '../utils/analytics';

interface VerificationEventData {
  transactionId: string;
  success: boolean;
  duration?: number;
  method?: 'single' | 'batch';
}

interface VerificationStats {
  totalVerified: number;
  totalPending: number;
  avgVerificationTime: number;
  batchVerificationRate: number;
}

export const useVerificationAnalytics = () => {
  const trackVerification = useCallback((transactionId: string, success: boolean, data?: Partial<VerificationEventData>) => {
    analytics.logEvent(
      'verification',
      success ? 'success' : 'failure',
      transactionId,
      data?.duration
    );

    analytics.track('transaction_verification', {
      transactionId,
      success,
      ...data,
      timestamp: new Date().toISOString()
    });
  }, []);

  const trackVerificationStats = useCallback((stats: VerificationStats) => {
    analytics.track('verification_stats_update', {
      ...stats,
      timestamp: new Date().toISOString()
    });
  }, []);

  const trackVerificationBatch = useCallback((
    transactionIds: string[],
    success: boolean,
    duration?: number
  ) => {
    analytics.logEvent(
      'verification_batch',
      success ? 'success' : 'failure',
      `count:${transactionIds.length}`,
      duration
    );

    analytics.track('batch_verification', {
      transactionIds,
      success,
      count: transactionIds.length,
      duration,
      timestamp: new Date().toISOString()
    });
  }, []);

  return {
    trackVerification,
    trackVerificationStats,
    trackVerificationBatch
  };
};
