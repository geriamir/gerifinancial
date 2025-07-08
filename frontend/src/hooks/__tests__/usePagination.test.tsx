import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';

describe('usePagination', () => {
  // No need for global timeout, we'll handle timing better
  const mockData = {
    items: [{ id: 1 }, { id: 2 }],
    total: 2,
    hasMore: false,
  };

  let fetchFn: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers("modern");
    fetchFn = jest.fn().mockResolvedValue(mockData);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('debounces rapid page changes', async () => {
    const { result } = renderHook(() => usePagination(fetchFn));

    act(() => {
      // Trigger multiple page changes rapidly
      result.current.goToPage(1);
      result.current.goToPage(2);
      result.current.goToPage(3);
      result.current.goToPage(4);
      result.current.goToPage(5);
    });

    // Run timers and flush promises
    act(() => {
      jest.runAllTimers();
    });

    // Let effect complete
    act(() => {
      jest.runAllTimers();
    });

    // Only the last page change should trigger a fetch
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 5,
    }));
  });

  it('updates page after debounce delay', async () => {
    const { result } = renderHook(() => usePagination(fetchFn));

    act(() => {
      // Change page
      result.current.goToPage(2);
    });

    // Run timers and flush promises
    act(() => {
      jest.runAllTimers();
    });

    // Let effect complete
    act(() => {
      jest.runAllTimers();
    });

    // Verify fetch was called with correct page
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 2,
    }));
  });

  it('cancels pending page change when unmounted', async () => {
    const { result, unmount } = renderHook(() => usePagination(fetchFn));

    act(() => {
      // Change page
      result.current.goToPage(1);
    });

    unmount();

    // Run timers
    act(() => {
      jest.runAllTimers();
    });

    // Verify fetch was not called
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
