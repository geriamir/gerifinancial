import { useEffect, useCallback } from 'react';

type KeyCombo = {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

type KeyHandler = (event: KeyboardEvent) => void;

export const useKeyboardShortcut = (
  keyCombo: KeyCombo,
  handler: KeyHandler,
  active = true
) => {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === keyCombo.key.toLowerCase();
      const matchesCtrl = keyCombo.ctrlKey ? event.ctrlKey : !event.ctrlKey;
      const matchesAlt = keyCombo.altKey ? event.altKey : !event.altKey;
      const matchesShift = keyCombo.shiftKey ? event.shiftKey : !event.shiftKey;

      if (matchesKey && matchesCtrl && matchesAlt && matchesShift) {
        event.preventDefault();
        handler(event);
      }
    },
    [keyCombo, handler]
  );

  useEffect(() => {
    if (!active) return;

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [active, handleKeyPress]);
};
