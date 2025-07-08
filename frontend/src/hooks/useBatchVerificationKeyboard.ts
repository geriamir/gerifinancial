import { useCallback } from 'react';

interface FocusState {
  focusedId: string | null;
  setFocusedId: (id: string) => void;
}

interface BatchVerificationKeyboardOptions {
  onClose?: () => void;
  onConfirm?: () => void;
  onToggleHelp?: () => void;
  onToggleSelection?: (id: string) => void;
  isEnabled?: boolean;
  focusState?: FocusState;
}

export const useBatchVerificationKeyboard = ({
  onClose,
  onConfirm,
  onToggleHelp,
  onToggleSelection,
  isEnabled = true,
  focusState
}: BatchVerificationKeyboardOptions) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts if not enabled or if user is typing in an input
    if (!isEnabled || ['input', 'textarea'].includes((event.target as HTMLElement)?.tagName?.toLowerCase())) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

    if (!focusState) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'j':
        event.preventDefault();
        const nextLi = document.activeElement?.closest('li')?.nextElementSibling as HTMLElement;
        if (nextLi?.dataset.transactionId) {
          nextLi.focus();
          focusState.setFocusedId(nextLi.dataset.transactionId);
        }
        break;
      case 'ArrowUp':
      case 'k':
        event.preventDefault();
        const prevLi = document.activeElement?.closest('li')?.previousElementSibling as HTMLElement;
        if (prevLi?.dataset.transactionId) {
          prevLi.focus();
          focusState.setFocusedId(prevLi.dataset.transactionId);
        }
        break;
      case 'Enter':
        event.preventDefault();
        onConfirm?.();
        break;
      case 'Escape':
        event.preventDefault();
        onClose?.();
        break;
      case '?':
        if (ctrlOrCmd) {
          event.preventDefault();
          onToggleHelp?.();
        }
        break;
      case ' ':
        if (onToggleSelection && focusState.focusedId) {
          event.preventDefault();
          onToggleSelection(focusState.focusedId);
        }
        break;
    }
  }, [isEnabled, onClose, onConfirm, onToggleHelp, onToggleSelection, focusState]);

  const registerShortcuts = useCallback(() => {
    window.addEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const unregisterShortcuts = useCallback(() => {
    window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return keyboard shortcuts help text
  const getShortcutsHelp = () => ({
    global: [
      { key: 'Esc', description: 'Close dialog' }
    ],
    verificationPage: [
      { key: 'Enter', description: 'Confirm verification' }
    ],
    batchDialog: [
      { key: '⌘/Ctrl + ?', description: 'Toggle help' },
      { key: 'Space', description: 'Toggle selection' },
      { key: '↑/k', description: 'Previous transaction' },
      { key: '↓/j', description: 'Next transaction' }
    ]
  });

  return {
    shortcuts: getShortcutsHelp(),
    registerShortcuts,
    unregisterShortcuts
  };
};
