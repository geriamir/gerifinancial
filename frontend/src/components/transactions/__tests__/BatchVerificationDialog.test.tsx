import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchVerificationDialog } from '../BatchVerificationDialog';
import type { Transaction } from '../../../services/api/types/transaction';

const mockMainTransaction: Transaction = {
  _id: 'tx1',
  identifier: 'test-tx-1',
  accountId: 'acc1',
  userId: 'user1',
  amount: -100,
  currency: 'ILS',
  date: '2025-07-03T12:00:00Z',
  type: 'Expense',
  description: 'Test Restaurant',
  status: 'needs_verification',
  category: {
    _id: 'cat1',
    name: 'Food',
    type: 'Expense'
  },
  subCategory: {
    _id: 'sub1',
    name: 'Restaurant',
    keywords: ['food'],
    parentCategory: {
      _id: 'cat1',
      name: 'Food',
      type: 'Expense'
    },
    isDefault: false
  },
  rawData: {},
  createdAt: '2025-07-03T12:00:00Z',
  updatedAt: '2025-07-03T12:00:00Z'
};

const mockTransactions: Transaction[] = [
  mockMainTransaction,
  {
    ...mockMainTransaction,
    _id: 'tx2',
    description: 'Similar Restaurant',
    amount: -90
  },
  {
    ...mockMainTransaction,
    _id: 'tx3',
    description: 'Another Restaurant',
    amount: -110
  }
];

describe('BatchVerificationDialog', () => {
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

  it('renders with transaction list and main transaction selected', () => {
    render(<BatchVerificationDialog {...defaultProps} />);

    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Similar Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Another Restaurant')).toBeInTheDocument();

    // Main transaction should be checked and disabled
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[0]).toBeDisabled();
  });

  it('handles transaction selection', () => {
    render(<BatchVerificationDialog {...defaultProps} />);

    // Select second transaction
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    
    // Verify button should show count
    expect(screen.getByRole('button', { name: /verify 2 transactions/i })).toBeInTheDocument();
  });

  it('shows progress during verification', () => {
    const progress = {
      total: 3,
      current: 1,
      successful: 1,
      failed: 0
    };

    render(<BatchVerificationDialog {...defaultProps} progress={progress} />);

    // Should show progress indicator
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Verifying transactions...')).toBeInTheDocument();
    expect(screen.getByText('1 successful • 0 failed')).toBeInTheDocument();

    // Dialog should not be closeable during verification
    const closeButton = screen.getByRole('button', { name: /cancel/i });
    expect(closeButton).toBeDisabled();
  });

  it('shows completion state after verification', () => {
    const progress = {
      total: 3,
      current: 3,
      successful: 2,
      failed: 1
    };

    render(<BatchVerificationDialog {...defaultProps} progress={progress} />);

    expect(screen.getByText('2 successful • 1 failed')).toBeInTheDocument();
  });

  it('handles verification errors', async () => {
    const mockError = new Error('Test error');
    const mockVerify = jest.fn().mockRejectedValue(mockError);

    render(
      <BatchVerificationDialog
        {...defaultProps}
        onVerify={mockVerify}
      />
    );

    // Select all transactions
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.slice(1).forEach(checkbox => {
      fireEvent.click(checkbox);
    });

    // Click verify
    const verifyButton = screen.getByRole('button', { name: /verify 3 transactions/i });
    fireEvent.click(verifyButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to verify transactions/i)).toBeInTheDocument();
    });
  });

  it('disables interaction during verification', () => {
    render(
      <BatchVerificationDialog
        {...defaultProps}
        progress={{
          total: 3,
          current: 1,
          successful: 1,
          failed: 0
        }}
      />
    );

    // All checkboxes should be disabled
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeDisabled();
    });

    // Verify button should be disabled
    const verifyButton = screen.getByRole('button', { name: /verify/i });
    expect(verifyButton).toBeDisabled();
  });

  it('shows category information', () => {
    render(<BatchVerificationDialog {...defaultProps} />);

    expect(screen.getByText('Food > Restaurant')).toBeInTheDocument();
  });

  it('preserves main transaction selection', () => {
    render(<BatchVerificationDialog {...defaultProps} />);

    const checkboxes = screen.getAllByRole('checkbox');
    
    // Try to uncheck main transaction (should not work)
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    // Check and uncheck other transactions
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).toBeChecked();
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).not.toBeChecked();
    
    // Main transaction should still be checked
    expect(checkboxes[0]).toBeChecked();
  });
});
