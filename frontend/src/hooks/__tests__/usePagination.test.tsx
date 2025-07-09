import React from 'react';
import { renderHook } from '@testing-library/react';
import { usePagination } from '../usePagination';
import { act } from '@testing-library/react';

describe('usePagination', () => {
  const mockData = {
    items: [{ id: 1 }, { id: 2 }],
    total: 2,
    hasMore: false,
  };

  let fetchFn: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchFn = jest.fn().mockResolvedValue(mockData);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // Helper function to advance timers and wait for updates
  const advanceTimersAndAwaitUpdates = async () => {
    // Run all timers in an act to handle state updates
    act(() => {
      jest.runAllTimers();
    });
    // Wait for any pending promises to resolve
    await Promise.resolve();
  };

  it('cancels pending page change when unmounted', async () => {
    const { result, unmount } = renderHook(() => usePagination(fetchFn));

    act(() => {
      result.current.goToPage(2);
      unmount();
    });

    await advanceTimersAndAwaitUpdates();

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
