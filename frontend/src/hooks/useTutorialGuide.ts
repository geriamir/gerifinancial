import { useState, useCallback, useEffect } from 'react';
import { useTutorialAnalytics } from './useTutorialAnalytics';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  element?: string;
  action?: 'keyboard' | 'click';
  shortcut?: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TutorialGuideOptions {
  onComplete?: () => void;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Pending Transactions",
    content: "This is where you will find and verify new transactions from your bank accounts.",
    position: "bottom"
  },
  {
    id: "stats",
    title: "Processing Stats",
    content: "Here you can see how many transactions are pending and how many have been verified.",
    target: ".processing-stats",
    position: "bottom"
  },
  {
    id: "transactions",
    title: "Transaction List",
    content: "Review your pending transactions here. Click the checkmark to verify a transaction once it is categorized.",
    target: ".transaction-list",
    position: "top"
  },
  {
    id: "shortcuts",
    title: "Keyboard Shortcuts",
    content: "Press \"?\" or click this button to see available keyboard shortcuts.",
    target: ".keyboard-shortcuts-button",
    action: "keyboard",
    shortcut: "Press ? for shortcuts",
    position: "left"
  }
];

export const useTutorialGuide = (options: TutorialGuideOptions = {}) => {
  const STORAGE_KEY = "verification_tutorial_completed" as const;
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
  const [isCompleted, setIsCompleted] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const { 
    trackStepViewed, 
    trackStepCompleted, 
    trackTutorialCompleted, 
    trackTutorialSkipped 
  } = useTutorialAnalytics();

  // Track initial step view
  useEffect(() => {
    if (!isCompleted && currentStep) {
      trackStepViewed(currentStep.id);
    }
  }, [currentStep, isCompleted, trackStepViewed]);

  // Initial setup
  useEffect(() => {
    if (!isCompleted && !currentStep) {
      setCurrentStep(TUTORIAL_STEPS[0]);
    }
  }, [isCompleted, currentStep]);

  const goToNextStep = useCallback(() => {
    if (!currentStep) return;

    // Track current step completion
    trackStepCompleted(currentStep.id);

    const currentIndex = TUTORIAL_STEPS.findIndex(step => step.id === currentStep.id);
    if (currentIndex === TUTORIAL_STEPS.length - 1) {
      setCurrentStep(null);
      setIsCompleted(true);
      localStorage.setItem(STORAGE_KEY, "true");
      trackTutorialCompleted();
      options.onComplete?.();
    } else {
      const nextStep = TUTORIAL_STEPS[currentIndex + 1];
      setCurrentStep(nextStep);
      trackStepViewed(nextStep.id);
    }
  }, [currentStep, options, trackStepCompleted, trackStepViewed, trackTutorialCompleted]);

  const skipTutorial = useCallback(() => {
    if (currentStep) {
      trackTutorialSkipped(currentStep.id);
    }
    setCurrentStep(null);
    setIsCompleted(true);
    localStorage.setItem(STORAGE_KEY, "true");
    options.onComplete?.();
  }, [currentStep, trackTutorialSkipped, options]);

  const resetTutorial = useCallback(() => {
    setIsCompleted(false);
    localStorage.removeItem(STORAGE_KEY);
    const firstStep = TUTORIAL_STEPS[0];
    setCurrentStep(firstStep);
    trackStepViewed(firstStep.id);
  }, [trackStepViewed]);

  return {
    currentStep,
    isCompleted,
    goToNextStep,
    skipTutorial,
    resetTutorial,
    totalSteps: TUTORIAL_STEPS.length,
    tutorialSteps: TUTORIAL_STEPS,
    // Add explicit type for testing
    _storageKey: STORAGE_KEY
  };
};
