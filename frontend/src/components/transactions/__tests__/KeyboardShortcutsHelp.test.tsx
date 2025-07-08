import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsHelp } from '../KeyboardShortcutsHelp';
import { useBatchVerificationKeyboard } from '../../../hooks/useBatchVerificationKeyboard';

// Mock the keyboard hook
jest.mock('../../../hooks/useBatchVerificationKeyboard');

const mockShortcuts = {
  global: [
    { key: '⌘/Ctrl + V', description: 'Go to verification page' }
  ],
  verificationPage: [
    { key: '⌘/Ctrl + B', description: 'Open batch verification' },
    { key: 'Space/Enter', description: 'Verify selected transaction' }
  ],
  batchDialog: [
    { key: '⌘/Ctrl + Enter', description: 'Save batch verification' },
    { key: '⌘/Ctrl + A', description: 'Select all transactions' },
    { key: 'Esc', description: 'Cancel batch verification' }
  ]
};

describe('KeyboardShortcutsHelp', () => {
  beforeEach(() => {
    (useBatchVerificationKeyboard as jest.Mock).mockReturnValue({
      shortcuts: mockShortcuts
    });
  });

  it('renders all shortcut sections', () => {
    render(<KeyboardShortcutsHelp open={true} onClose={jest.fn()} />);

    // Check section titles
    expect(screen.getByText('Global Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Verification Page Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Batch Verification Dialog Shortcuts')).toBeInTheDocument();
  });

  it('displays all shortcuts with their descriptions', () => {
    render(<KeyboardShortcutsHelp open={true} onClose={jest.fn()} />);

    // Check global shortcuts
    mockShortcuts.global.forEach(shortcut => {
      expect(screen.getByText(shortcut.key)).toBeInTheDocument();
      expect(screen.getByText(shortcut.description)).toBeInTheDocument();
    });

    // Check verification page shortcuts
    mockShortcuts.verificationPage.forEach(shortcut => {
      expect(screen.getByText(shortcut.key)).toBeInTheDocument();
      expect(screen.getByText(shortcut.description)).toBeInTheDocument();
    });

    // Check batch dialog shortcuts
    mockShortcuts.batchDialog.forEach(shortcut => {
      expect(screen.getByText(shortcut.key)).toBeInTheDocument();
      expect(screen.getByText(shortcut.description)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = jest.fn();
    render(<KeyboardShortcutsHelp open={true} onClose={handleClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows macOS note', () => {
    render(<KeyboardShortcutsHelp open={true} onClose={jest.fn()} />);
    
    expect(screen.getByText(/On macOS, use ⌘ \(Command\) instead of Ctrl/)).toBeInTheDocument();
  });

  it('renders shortcuts in monospace font', () => {
    render(<KeyboardShortcutsHelp open={true} onClose={jest.fn()} />);

    const shortcutElements = screen.getAllByText(/[⌘/].*/, { selector: 'kbd' });
    shortcutElements.forEach(element => {
      expect(element).toHaveStyle({ fontFamily: 'monospace' });
    });
  });

  it('renders with proper accessibility attributes', () => {
    render(<KeyboardShortcutsHelp open={true} onClose={jest.fn()} />);

    // Check dialog title
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-labelledby',
      'keyboard-shortcuts-dialog-title'
    );

    // Check close button accessibility
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  describe('Dialog visibility', () => {
    it('is visible when open prop is true', () => {
      render(<KeyboardShortcutsHelp open={true} onClose={jest.fn()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('is not visible when open prop is false', () => {
      render(<KeyboardShortcutsHelp open={false} onClose={jest.fn()} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
