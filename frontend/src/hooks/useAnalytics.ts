import { useCallback } from 'react';

type EventType = 
  | 'transaction_verified' 
  | 'stats_loaded'
  | 'tutorial_start'
  | 'tutorial_step_viewed'
  | 'tutorial_step_completed'
  | 'tutorial_completed'
  | 'tutorial_skipped'
  | 'tutorial_step_change'
  | 'tutorial_highlight_toggle';

interface EventProperties {
  [key: string]: any;
}

export const useAnalytics = () => {
  const trackEvent = useCallback((eventType: EventType, properties?: EventProperties) => {
    // TODO: Implement actual analytics tracking
    console.log('Analytics event:', eventType, properties);
  }, []);

  return { trackEvent };
};
