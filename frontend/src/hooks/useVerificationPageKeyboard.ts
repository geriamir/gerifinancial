import { useCallback, useEffect } from 'react';

interface KeyboardHandlers {
  onConfirm: () => void;
  onOpenBatch: () => void;
  isEnabled?: boolean;
}

export const useVerificationPageKeyboard = ({
  onConfirm,
  onOpenBatch,
  isEnabled = true
}: KeyboardHandlers) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isEnabled) return;

    // Prevent handling if user is typing in an input
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'v':
        onConfirm();
        break;
      case 'b':
        onOpenBatch();
        break;
      default:
        break;
    }
  }, [onConfirm, onOpenBatch, isEnabled]);

  const registerShortcuts = useCallback(() => {
    window.addEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const unregisterShortcuts = useCallback(() => {
    window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    return () => {
      unregisterShortcuts();
    };
  }, [unregisterShortcuts]);

  return {
    registerShortcuts,
    unregisterShortcuts
  };
};
