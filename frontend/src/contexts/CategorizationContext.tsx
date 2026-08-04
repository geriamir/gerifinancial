import React, { createContext, useCallback, useContext, useMemo, useReducer, useState } from 'react';
import { useSSE, SSEEvent } from '../hooks/useSSE';
import {
  CategorizationState,
  initialCategorizationState,
  isCategorizationEvent,
  reduceCategorization
} from './categorizationState';

interface CategorizationContextValue extends CategorizationState {
  dismiss: () => void;
  /**
   * Bumped whenever the server reports that a categorisation run turned up new
   * project suggestions. Screens showing a suggestion count watch this rather
   * than opening a second stream: `useSSE` gives every caller its own
   * `EventSource`, so subscribing again would mean two connections per tab.
   */
  projectSuggestionsNonce: number;
}

/**
 * Categorisation runs on a queue after a scrape has already saved the
 * transactions, so the rows land on screen without a category and only gain one
 * some seconds later. Nothing in the browser was listening for that, which left
 * a freshly synced account looking entirely uncategorised until the user
 * happened to reload.
 *
 * The default value is a quiet, idle state rather than a thrown error: this only
 * ever drives an optional notice and a list refresh, so a subtree rendered
 * outside the provider should stay silent rather than take the page down.
 */
const CategorizationContext = createContext<CategorizationContextValue>({
  ...initialCategorizationState,
  dismiss: () => {},
  projectSuggestionsNonce: 0
});

export const CategorizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reduceCategorization, initialCategorizationState);
  const [projectSuggestionsNonce, setProjectSuggestionsNonce] = useState(0);

  // useSSE tears down and reopens the stream whenever this changes identity, so
  // it must not depend on the state it updates.
  const handleEvent = useCallback((event: SSEEvent) => {
    if (isCategorizationEvent(event.type)) {
      dispatch({ type: event.type, data: event.data ?? {} });
    }
    if (event.type === 'projects:suggestions') {
      setProjectSuggestionsNonce((n) => n + 1);
    }
  }, []);

  useSSE(handleEvent, { autoConnect: true });

  const dismiss = useCallback(() => dispatch({ type: 'dismiss' }), []);

  const value = useMemo(
    () => ({ ...state, dismiss, projectSuggestionsNonce }),
    [state, dismiss, projectSuggestionsNonce]
  );

  return <CategorizationContext.Provider value={value}>{children}</CategorizationContext.Provider>;
};

export const useCategorization = (): CategorizationContextValue => useContext(CategorizationContext);
