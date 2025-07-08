import { renderHook, act } from '@testing-library/react';
import { useVerificationAnalytics } from '../useVerificationAnalytics';
import { analytics } from '../../utils/analytics';

// Mock the analytics service
jest.mock('../../utils/analytics', () => ({
  analytics: {
    track: jest.fn(),
    logEvent: jest.fn()
  }
}));

describe('useVerificationAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tracks successful verification', () => {
    const { result } = renderHook(() => useVerificationAnalytics());

    act(() => {
      result.current.trackVerification('123', true, { duration: 1000 });
    });

    expect(analytics.logEvent).toHaveBeenCalledWith(
      'verification',
      'success',
      '123',
      1000
    );

    expect(analytics.track).toHaveBeenCalledWith(
      'transaction_verification',
      expect.objectContaining({
        transactionId: '123',
        success: true,
        duration: 1000,
        timestamp: expect.any(String)
      })
    );
  });

  it('tracks failed verification', () => {
    const { result } = renderHook(() => useVerificationAnalytics());

    act(() => {
      result.current.trackVerification('123', false);
    });

    expect(analytics.logEvent).toHaveBeenCalledWith(
      'verification',
      'failure',
      '123',
      undefined
    );

    expect(analytics.track).toHaveBeenCalledWith(
      'transaction_verification',
      expect.objectContaining({
        transactionId: '123',
        success: false,
        timestamp: expect.any(String)
      })
    );
  });

  it('tracks verification stats updates', () => {
    const { result } = renderHook(() => useVerificationAnalytics());
    const mockStats = {
      totalVerified: 100,
      totalPending: 50,
      avgVerificationTime: 2000,
      batchVerificationRate: 0.75
    };

    act(() => {
      result.current.trackVerificationStats(mockStats);
    });

    expect(analytics.track).toHaveBeenCalledWith(
      'verification_stats_update',
      expect.objectContaining({
        ...mockStats,
        timestamp: expect.any(String)
      })
    );
  });

  it('tracks batch verification', () => {
    const { result } = renderHook(() => useVerificationAnalytics());
    const transactionIds = ['123', '456', '789'];
    const duration = 3000;

    act(() => {
      result.current.trackVerificationBatch(transactionIds, true, duration);
    });

    expect(analytics.logEvent).toHaveBeenCalledWith(
      'verification_batch',
      'success',
      'count:3',
      duration
    );

    expect(analytics.track).toHaveBeenCalledWith(
      'batch_verification',
      expect.objectContaining({
        transactionIds,
        success: true,
        count: 3,
        duration,
        timestamp: expect.any(String)
      })
    );
  });

  it('tracks batch verification failure', () => {
    const { result } = renderHook(() => useVerificationAnalytics());
    const transactionIds = ['123', '456'];

    act(() => {
      result.current.trackVerificationBatch(transactionIds, false);
    });

    expect(analytics.logEvent).toHaveBeenCalledWith(
      'verification_batch',
      'failure',
      'count:2',
      undefined
    );
  });

  it('includes timestamps in all events', () => {
    const { result } = renderHook(() => useVerificationAnalytics());

    act(() => {
      result.current.trackVerification('123', true);
      result.current.trackVerificationStats({
        totalVerified: 100,
        totalPending: 50,
        avgVerificationTime: 2000,
        batchVerificationRate: 0.75
      });
      result.current.trackVerificationBatch(['123', '456'], true, 2000);
    });

    // Check all track calls include a timestamp
    (analytics.track as jest.Mock).mock.calls.forEach(call => {
      expect(call[1].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
