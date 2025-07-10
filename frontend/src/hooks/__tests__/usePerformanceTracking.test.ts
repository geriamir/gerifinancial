import { renderHook, act } from '@testing-library/react';
import { usePerformanceTracking } from '../usePerformanceTracking';
import { analytics } from '../../utils/analytics';

// Mock analytics
jest.mock('../../utils/analytics', () => ({
  analytics: {
    startPerformanceTracking: jest.fn()
  }
}));

describe('usePerformanceTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockTracker = {
    finish: jest.fn(),
    addData: jest.fn(),
    addTag: jest.fn(),
    getMetrics: jest.fn(() => ({
      duration: 1000,
      startTime: 0,
      endTime: 1000,
      tags: {},
      data: {}
    }))
  };

  beforeEach(() => {
    (analytics.startPerformanceTracking as jest.Mock).mockReturnValue(mockTracker);
  });

  it('starts tracking automatically when autoStart is true', () => {
    renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      category: 'test'
    }));

    expect(analytics.startPerformanceTracking).toHaveBeenCalledWith(
      'test-operation',
      expect.objectContaining({
        category: 'test'
      })
    );
  });

  it('does not start tracking when autoStart is false', () => {
    renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      autoStart: false
    }));

    expect(analytics.startPerformanceTracking).not.toHaveBeenCalled();
  });

  it('handles manual tracking control', () => {
    const { result } = renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      autoStart: false
    }));

    // Start tracking manually
    act(() => {
      result.current.startTracking();
    });

    expect(analytics.startPerformanceTracking).toHaveBeenCalledWith(
      'test-operation',
      expect.any(Object)
    );

    // Stop tracking
    act(() => {
      const metrics = result.current.stopTracking();
      expect(metrics).toEqual({
        duration: 1000,
        startTime: 0,
        endTime: 1000,
        tags: {},
        data: {}
      });
    });

    expect(mockTracker.finish).toHaveBeenCalled();
  });

  it('allows adding data and tags during tracking', () => {
    const { result } = renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      autoStart: true
    }));

    act(() => {
      result.current.addData({ test: 'data' });
      result.current.addTag('test-tag', 'value');
    });

    expect(mockTracker.addData).toHaveBeenCalledWith({ test: 'data' });
    expect(mockTracker.addTag).toHaveBeenCalledWith('test-tag', 'value');
  });

  it('handles onComplete callback', () => {
    const onComplete = jest.fn();
    const { unmount } = renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      onComplete
    }));

    // Unmount should trigger completion
    unmount();

    expect(mockTracker.finish).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith({
      duration: 1000,
      startTime: 0,
      endTime: 1000,
      tags: {},
      data: {}
    });
  });

  it('warns when trying to start tracking while already tracking', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const { result } = renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      autoStart: true
    }));

    act(() => {
      result.current.startTracking();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Performance tracking already started');
    consoleSpy.mockRestore();
  });

  it('warns when trying to stop tracking when not tracking', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const { result } = renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      autoStart: false
    }));

    act(() => {
      result.current.stopTracking();
    });

    expect(consoleSpy).toHaveBeenCalledWith('No active performance tracking to stop');
    consoleSpy.mockRestore();
  });

  it('provides tracking status through isTracking', () => {
    const { result } = renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      autoStart: false
    }));

    expect(result.current.isTracking).toBe(false);

    act(() => {
      result.current.startTracking();
    });

    expect(result.current.isTracking).toBe(true);

    act(() => {
      result.current.stopTracking();
    });

    expect(result.current.isTracking).toBe(false);
  });

  it('returns null metrics when not tracking', () => {
    const { result } = renderHook(() => usePerformanceTracking({
      name: 'test-operation',
      autoStart: false
    }));

    expect(result.current.getMetrics()).toBeNull();
  });

  it('cleans up tracking on unmount', () => {
    const { unmount } = renderHook(() => usePerformanceTracking({
      name: 'test-operation'
    }));

    unmount();

    expect(mockTracker.finish).toHaveBeenCalled();
  });
});
