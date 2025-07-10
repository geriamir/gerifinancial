import { useCallback } from 'react';
import { useAnalytics } from './useAnalytics';

export const useTutorialAnalytics = () => {
  const { trackEvent } = useAnalytics();

  const trackStepViewed = useCallback((stepId: string) => {
    trackEvent('tutorial_step_viewed', { stepId });
  }, [trackEvent]);

  const trackStepCompleted = useCallback((stepId: string) => {
    trackEvent('tutorial_step_completed', { stepId });
  }, [trackEvent]);

  const trackTutorialCompleted = useCallback(() => {
    trackEvent('tutorial_completed', {});
  }, [trackEvent]);

  const trackTutorialSkipped = useCallback((stepId: string) => {
    trackEvent('tutorial_skipped', { stepId });
  }, [trackEvent]);

  const trackStepChange = useCallback((stepId: string, currentIndex: number, totalSteps: number) => {
    trackEvent('tutorial_step_change', {
      stepId,
      currentIndex,
      totalSteps,
      progress: Math.round((currentIndex / totalSteps) * 100)
    });
  }, [trackEvent]);

  const trackHighlightToggle = useCallback((enabled: boolean) => {
    trackEvent('tutorial_highlight_toggle', { enabled });
  }, [trackEvent]);

  return {
    trackStepViewed,
    trackStepCompleted,
    trackTutorialCompleted,
    trackTutorialSkipped,
    trackStepChange,
    trackHighlightToggle
  };
};
