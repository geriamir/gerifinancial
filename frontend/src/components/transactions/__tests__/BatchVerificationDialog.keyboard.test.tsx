import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BatchVerificationDialog } from '../BatchVerificationDialog';
import type { Transaction } from '../../../services/api/types/transaction';
import { mockMainTransaction, mockTransactions } from './__fixtures__/transactions';

describe('BatchVerificationDialog Keyboard Navigation', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    transactions: mockTransactions,
    mainTransaction: mockMainTransaction,
    onVerify: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('supports keyboard navigation between transactions', () => {
    render(<BatchVerificationDialog {...defaultProps} />);

    // First transaction should be focused by default
    const firstItem = screen.getByText('Test Restaurant').closest('li');
    expect(firstItem).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.04)' }); // action.selected

    // Move down with arrow key
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    const secondItem = screen.getByText('Similar Restaurant').closest('li');
    expect(secondItem).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.04)' });

    // Move up with 'k' key
    fireEvent.keyDown(window, { key: 'k' });
    expect(firstItem).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.04)' });
  });

  it('toggles selection with space key', () => {
    render(<BatchVerificationDialog {...defaultProps} />);

    // Move to second transaction
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    
    // Toggle selection with space
    fireEvent.keyDown(window, { key: ' ' });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[1]).toBeChecked();

    // Toggle again to uncheck
    fireEvent.keyDown(window, { key: ' ' });
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('prevents unselecting main transaction with keyboard', () => {
    render(<BatchVerificationDialog {...defaultProps} />);

    // Try to unselect main transaction with space
    fireEvent.keyDown(window, { key: ' ' });
    const mainCheckbox = screen.getAllByRole('checkbox')[0];
    expect(mainCheckbox).toBeChecked();
  });

  it('verifies transactions with enter key', async () => {
    const mockVerify = jest.fn().mockResolvedValue(undefined);
    render(
      <BatchVerificationDialog
        {...defaultProps}
        onVerify={mockVerify}
      />
    );

    // Select second transaction
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: ' ' });

    // Verify with enter
    fireEvent.keyDown(window, { key: 'Enter' });
    
    expect(mockVerify).toHaveBeenCalledWith(['tx1', 'tx2']);
  });

  it('closes dialog with escape key', () => {
    const onClose = jest.fn();
    render(
      <BatchVerificationDialog
        {...defaultProps}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('disables keyboard shortcuts during verification', async () => {
    const mockVerify = jest.fn();
    render(
      <BatchVerificationDialog
        {...defaultProps}
        onVerify={mockVerify}
        progress={{
          total: 3,
          current: 1,
          successful: 1,
          failed: 0
        }}
      />
    );

    // Wait for loading state
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // Try to use keyboard shortcuts while processing
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyDown(window, { key: 'Enter' });
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    // No actions should be triggered
    expect(mockVerify).not.toHaveBeenCalled();
    
    // Verify buttons are disabled
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('shows keyboard shortcuts in UI', () => {
    render(<BatchVerificationDialog {...defaultProps} />);

    // Toggle help to show shortcuts
    fireEvent.keyDown(window, { key: '?', ctrlKey: true });

    // Find shortcuts by their descriptions
    expect(screen.getByText('Toggle selection')).toBeInTheDocument();
    expect(screen.getByText('Confirm verification')).toBeInTheDocument();
    expect(screen.getByText('Previous transaction')).toBeInTheDocument();
    expect(screen.getByText('Next transaction')).toBeInTheDocument();
    expect(screen.getByText('Close dialog')).toBeInTheDocument();
  });
});
