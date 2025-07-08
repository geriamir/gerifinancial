import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseVerificationShortcutsProps {
  onVerify?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  canVerify?: boolean;
  disabled?: boolean;
}

export const useVerificationShortcuts = ({
  onVerify,
  onNext,
  onPrevious,
  onExpand,
  isExpanded,
  canVerify = true,
  disabled = false
}: UseVerificationShortcutsProps) => {
  const navigate = useNavigate();

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    // Don't trigger shortcuts if user is typing in an input
    if (['input', 'textarea'].includes((event.target as HTMLElement)?.tagName?.toLowerCase())) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'v':
        // Verify current transaction
        if (canVerify && onVerify) {
          event.preventDefault();
          onVerify();
        }
        break;

      case 'n':
        // Move to next transaction
        if (onNext) {
          event.preventDefault();
          onNext();
        }
        break;

      case 'p':
        // Move to previous transaction
        if (onPrevious) {
          event.preventDefault();
          onPrevious();
        }
        break;

      case 'e':
        // Expand/collapse current transaction
        if (onExpand) {
          event.preventDefault();
          onExpand();
        }
        break;

      case 'escape':
        // Close expanded view
        if (isExpanded && onExpand) {
          event.preventDefault();
          onExpand();
        }
        break;

      case 'q':
        // Quick navigation back to transactions list
        event.preventDefault();
        navigate('/transactions');
        break;

      default:
        break;
    }
  }, [onVerify, onNext, onPrevious, onExpand, isExpanded, canVerify, disabled, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Return keyboard shortcut information for displaying in UI
  return {
    shortcuts: [
      { key: 'V', description: 'Verify current transaction' },
      { key: 'N', description: 'Next transaction' },
      { key: 'P', description: 'Previous transaction' },
      { key: 'E', description: 'Expand/collapse details' },
      { key: 'Esc', description: 'Close expanded view' },
      { key: 'Q', description: 'Back to transactions' }
    ]
  };
};
