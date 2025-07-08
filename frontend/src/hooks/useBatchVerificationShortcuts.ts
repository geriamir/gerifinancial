import { useCallback, useEffect } from 'react';

interface UseBatchVerificationShortcutsProps {
  onVerify: () => void;
  onClose: () => void;
  onToggle?: (id: string) => void;
  selectedId?: string;
  transactionIds: string[];
  disabled?: boolean;
}

export const useBatchVerificationShortcuts = ({
  onVerify,
  onClose,
  onToggle,
  selectedId,
  transactionIds,
  disabled = false
}: UseBatchVerificationShortcutsProps) => {
  const getCurrentIndex = useCallback(() => {
    if (!selectedId) return -1;
    return transactionIds.indexOf(selectedId);
  }, [selectedId, transactionIds]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    // Don't trigger shortcuts if user is typing in an input
    if (['input', 'textarea'].includes((event.target as HTMLElement)?.tagName?.toLowerCase())) {
      return;
    }

    switch (event.key) {
      case ' ':
        // Space to toggle current selection
        event.preventDefault();
        if (selectedId && onToggle) {
          onToggle(selectedId);
        }
        break;

      case 'Enter':
        // Enter to verify
        event.preventDefault();
        onVerify();
        break;

      case 'Escape':
        // Escape to close
        event.preventDefault();
        onClose();
        break;

      case 'ArrowDown':
      case 'j':
        // Move to next transaction
        event.preventDefault();
        const currentIndex = getCurrentIndex();
        if (currentIndex < transactionIds.length - 1 && onToggle) {
          onToggle(transactionIds[currentIndex + 1]);
        }
        break;

      case 'ArrowUp':
      case 'k':
        // Move to previous transaction
        event.preventDefault();
        const prevIndex = getCurrentIndex();
        if (prevIndex > 0 && onToggle) {
          onToggle(transactionIds[prevIndex - 1]);
        }
        break;

      default:
        break;
    }
  }, [onVerify, onClose, onToggle, selectedId, transactionIds, disabled, getCurrentIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Return keyboard shortcut information for displaying in UI
  return {
    shortcuts: [
      { key: 'Space', description: 'Toggle selection' },
      { key: 'Enter', description: 'Verify selected' },
      { key: '↑/k', description: 'Previous transaction' },
      { key: '↓/j', description: 'Next transaction' },
      { key: 'Esc', description: 'Close dialog' }
    ]
  };
};
