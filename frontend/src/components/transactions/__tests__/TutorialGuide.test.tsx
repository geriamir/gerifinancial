import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TutorialGuide } from '../TutorialGuide';
import { useTutorialHighlight } from '../../../hooks/useTutorialHighlight';
import { useTutorialAnalytics } from '../../../hooks/useTutorialAnalytics';
import type { TutorialStep } from '../../../hooks/useTutorialGuide';

// Mock the hooks
jest.mock('../../../hooks/useTutorialHighlight');
jest.mock('../../../hooks/useTutorialAnalytics');

const mockStep: TutorialStep = {
  id: 'test-step',
  target: '.test-target',
  title: 'Test Title',
  content: 'Test Content',
  position: 'bottom',
  action: 'keyboard',
  shortcut: 'Ctrl + T'
};

describe('TutorialGuide', () => {
  const mockAnalytics = {
    trackStepViewed: jest.fn(),
    trackStepCompleted: jest.fn(),
    trackTutorialCompleted: jest.fn(),
    trackTutorialSkipped: jest.fn(),
    trackStepChange: jest.fn(),
    trackHighlightToggle: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTutorialHighlight as jest.Mock).mockReturnValue({ isHighlighting: false });
    (useTutorialAnalytics as jest.Mock).mockReturnValue(mockAnalytics);

    // Create target element
    const target = document.createElement('div');
    target.className = 'test-target';
    document.body.appendChild(target);

    // Reset localStorage
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up target element
    const target = document.querySelector('.test-target');
    if (target) {
      document.body.removeChild(target);
    }
  });

  it('tracks first step viewed', () => {
    render(
      <TutorialGuide
        step={mockStep}
        onNext={jest.fn()}
        onSkip={jest.fn()}
        currentStepIndex={0}
        totalSteps={3}
      />
    );

    expect(mockAnalytics.trackStepViewed).toHaveBeenCalledWith('test-step');
  });

  it('tracks tutorial completion on last step', () => {
    jest.useFakeTimers();
    const handleNext = jest.fn();

    render(
      <TutorialGuide
        step={mockStep}
        onNext={handleNext}
        onSkip={jest.fn()}
        currentStepIndex={2}
        totalSteps={3}
      />
    );

    // Advance timers to simulate time spent
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Click finish button
    fireEvent.click(screen.getByText('Finish'));

    expect(mockAnalytics.trackTutorialCompleted).toHaveBeenCalled();
    expect(handleNext).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('tracks step changes', () => {
    const handleNext = jest.fn();

    render(
      <TutorialGuide
        step={mockStep}
        onNext={handleNext}
        onSkip={jest.fn()}
        currentStepIndex={1}
        totalSteps={3}
      />
    );

    fireEvent.click(screen.getByText('Next'));

    expect(mockAnalytics.trackStepChange).toHaveBeenCalledWith(
      'test-step',
      1,
      3
    );
    expect(handleNext).toHaveBeenCalled();
  });

  it('tracks tutorial skip', () => {
    const handleSkip = jest.fn();

    render(
      <TutorialGuide
        step={mockStep}
        onNext={jest.fn()}
        onSkip={handleSkip}
        currentStepIndex={1}
        totalSteps={3}
      />
    );

    fireEvent.click(screen.getByText('Skip'));

    expect(mockAnalytics.trackTutorialSkipped).toHaveBeenCalledWith('test-step');
    expect(handleSkip).toHaveBeenCalled();
  });

  it('tracks highlight toggle', () => {
    render(
      <TutorialGuide
        step={mockStep}
        onNext={jest.fn()}
        onSkip={jest.fn()}
        currentStepIndex={0}
        totalSteps={3}
      />
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    expect(mockAnalytics.trackHighlightToggle).toHaveBeenCalledWith(false);
    expect(localStorage.getItem('tutorial_highlight_disabled')).toBe('true');

    fireEvent.click(toggle);
    expect(mockAnalytics.trackHighlightToggle).toHaveBeenCalledWith(true);
    expect(localStorage.getItem('tutorial_highlight_disabled')).toBe('false');
  });

  it('respects disableHighlight prop', () => {
    render(
      <TutorialGuide
        step={mockStep}
        onNext={jest.fn()}
        onSkip={jest.fn()}
        currentStepIndex={0}
        totalSteps={3}
        disableHighlight={true}
      />
    );

    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(useTutorialHighlight).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false
      })
    );
  });

  it('shows keyboard shortcut box for keyboard actions', () => {
    render(
      <TutorialGuide
        step={mockStep}
        onNext={jest.fn()}
        onSkip={jest.fn()}
        currentStepIndex={0}
        totalSteps={3}
      />
    );

    expect(screen.getByText('Ctrl + T')).toBeInTheDocument();
  });

  it('tracks step view on mount', () => {
    render(
      <TutorialGuide
        step={mockStep}
        onNext={jest.fn()}
        onSkip={jest.fn()}
        currentStepIndex={0}
        totalSteps={3}
      />
    );

    expect(mockAnalytics.trackStepViewed).toHaveBeenCalledWith('test-step');
  });

  it('only tracks step viewed for non-first steps', () => {
    render(
      <TutorialGuide
        step={mockStep}
        onNext={jest.fn()}
        onSkip={jest.fn()}
        currentStepIndex={1}
        totalSteps={3}
      />
    );

    expect(mockAnalytics.trackStepViewed).toHaveBeenCalledWith('test-step');
  });
});
