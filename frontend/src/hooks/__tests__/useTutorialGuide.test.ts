import { renderHook, act } from '@testing-library/react';
import { useTutorialGuide } from '../useTutorialGuide';

describe('useTutorialGuide', () => {
  const TUTORIAL_STEPS = [
    { id: 'welcome' },
    { id: 'stats' },
    { id: 'transactions' },
    { id: 'shortcuts' }
  ];

  const STORAGE_KEY = 'verification_tutorial_completed';

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('starts with initial step when not completed', () => {
    const { result } = renderHook(() => useTutorialGuide());

    expect(result.current.currentStep).toEqual(expect.objectContaining({
      id: 'welcome',
      title: 'Welcome to Pending Transactions'
    }));
    expect(result.current.isCompleted).toBe(false);
  });

  it('starts with no step when previously completed', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useTutorialGuide());

    expect(result.current.currentStep).toBeNull();
    expect(result.current.isCompleted).toBe(true);
  });

  it('moves to next step correctly', () => {
    const { result } = renderHook(() => useTutorialGuide());

    act(() => {
      result.current.goToNextStep();
    });

    expect(result.current.currentStep).toEqual(expect.objectContaining({
      id: 'stats',
      title: 'Processing Stats'
    }));
  });

  it('completes tutorial on last step', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useTutorialGuide({ onComplete }));

    // Go through all steps one at a time
    TUTORIAL_STEPS.forEach(() => {
      act(() => {
        result.current.goToNextStep();
      });
    });

    expect(result.current.currentStep).toBeNull();
    expect(result.current.isCompleted).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('skips tutorial immediately', () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useTutorialGuide({ onComplete }));

    act(() => {
      result.current.skipTutorial();
    });

    expect(result.current.currentStep).toBeNull();
    expect(result.current.isCompleted).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('resets tutorial state', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useTutorialGuide());

    // Initially completed
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.currentStep).toBeNull();

    act(() => {
      result.current.resetTutorial();
    });

    // Reset to initial state
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.currentStep).toEqual(expect.objectContaining({
      id: 'welcome'
    }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('exposes tutorial steps and total count', () => {
    const { result } = renderHook(() => useTutorialGuide());

    expect(result.current.tutorialSteps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'welcome' }),
      expect.objectContaining({ id: 'stats' }),
      expect.objectContaining({ id: 'transactions' }),
      expect.objectContaining({ id: 'shortcuts' })
    ]));
    expect(result.current.totalSteps).toBe(4);
  });

  it('includes keyboard shortcuts in relevant steps', () => {
    const { result } = renderHook(() => useTutorialGuide());

    const keyboardStep = result.current.tutorialSteps.find(
      step => step.id === 'shortcuts'
    );

    expect(keyboardStep).toBeDefined();
    expect(keyboardStep?.shortcut).toBe('Press ? for shortcuts');
  });

  describe('persistence', () => {
    it('persists completed state across hook instances', () => {
      const { result, unmount } = renderHook(() => useTutorialGuide());

      act(() => {
        result.current.skipTutorial();
      });
      
      unmount();

      const { result: newResult } = renderHook(() => useTutorialGuide());
      expect(newResult.current.isCompleted).toBe(true);
      expect(newResult.current.currentStep).toBeNull();
    });

    it('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid');
      const { result } = renderHook(() => useTutorialGuide());

      expect(result.current.isCompleted).toBe(false);
      expect(result.current.currentStep).toBeTruthy();
    });
  });

  it('uses consistent storage key', () => {
    const { result } = renderHook(() => useTutorialGuide());
    expect(result.current._storageKey).toBe(STORAGE_KEY);
  });
});
