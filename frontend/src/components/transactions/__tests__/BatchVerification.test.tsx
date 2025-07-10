import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BatchVerificationDialog } from '../BatchVerificationDialog';
import { transactionsApi } from '../../../services/api/transactions';
import type { Transaction } from '../../../services/api/types/transactions';

const TIMESTAMP = '2025-07-03T12:00:00Z';

// Mock the KeyboardShortcutsHelp component
jest.mock('../KeyboardShortcutsHelp', () => ({
  KeyboardShortcutsHelp: () => null
}));

// Mock performance tracking hook
jest.mock('../../../hooks/usePerformanceTracking', () => ({
  usePerformanceTracking: () => ({
    startTracking: jest.fn(),
    stopTracking: jest.fn(() => ({
      duration: 100,
      startTime: Date.now(),
      endTime: Date.now() + 100,
      tags: ['test']
    })),
    addData: jest.fn()
  })
}));

// Mock verification analytics hook
jest.mock('../../../hooks/useVerificationAnalytics', () => ({
  useVerificationAnalytics: () => ({
    trackVerificationBatch: jest.fn()
  })
}));

// Mock keyboard shortcuts hook
jest.mock('../../../hooks/useBatchVerificationKeyboard', () => ({
  useBatchVerificationKeyboard: () => ({
    registerShortcuts: jest.fn(),
    unregisterShortcuts: jest.fn()
  })
}));

// Mock performance metrics display component
jest.mock('../../performance/PerformanceMetricsDisplay', () => ({
  PerformanceMetricsDisplay: () => null
}));

jest.mock('../../../services/api/transactions', () => ({
  transactionsApi: {
    findSimilarPendingTransactions: jest.fn(),
    verifyBatch: jest.fn()
  }
}));

describe('Batch Verification', () => {
  const mockTransactions: Transaction[] = Array.from({ length: 3 }, (_, i) => ({
    _id: `tx${i + 1}`,
    identifier: `test-tx-${i + 1}`,
    accountId: 'acc1',
    userId: 'user1',
    amount: -100,
    currency: 'ILS',
    date: TIMESTAMP,
    description: `Test Transaction ${i + 1}`,
    type: 'Expense',
    status: 'pending',
    categorizationMethod: 'manual',
    rawData: {},
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    (transactionsApi.findSimilarPendingTransactions as jest.Mock).mockResolvedValue({
      transactions: mockTransactions,
      similarity: 0.85
    });
    (transactionsApi.verifyBatch as jest.Mock).mockResolvedValue({
      successful: ['tx1', 'tx2'],
      failed: []
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows batch verification button when similar transactions are found', async () => {
    render(
      <BatchVerificationDialog
        open={true}
        onClose={jest.fn()}
        transactions={mockTransactions}
        mainTransaction={mockTransactions[0]}
        onVerify={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/batch verify transactions/i)).toBeInTheDocument();
    });

    expect(screen.getByText(`Verify ${mockTransactions.length} transactions?`)).toBeInTheDocument();
  });

  it('opens batch verification dialog with correct transactions', async () => {
    const onClose = jest.fn();
    render(
      <BatchVerificationDialog
        open={true}
        onClose={onClose}
        transactions={mockTransactions}
        mainTransaction={mockTransactions[0]}
        onVerify={jest.fn()}
      />
    );

    // Check dialog content
    expect(screen.getByText(/batch verify transactions/i)).toBeInTheDocument();
    mockTransactions.forEach(tx => {
      expect(screen.getByText(tx.description)).toBeInTheDocument();
    });
  });

  it('handles batch verification correctly', async () => {
    const onVerify = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    render(
      <BatchVerificationDialog
        open={true}
        onClose={onClose}
        transactions={mockTransactions}
        mainTransaction={mockTransactions[0]}
        onVerify={onVerify}
      />
    );

    // Find and click verify button
    const verifyButton = screen.getByRole('button', { name: /verify 1 transaction/i });
    await act(async () => {
      fireEvent.click(verifyButton);
    });

    await waitFor(() => {
      expect(onVerify).toHaveBeenCalledWith([mockTransactions[0]._id]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('handles batch verification errors gracefully', async () => {
    const onVerify = jest.fn().mockRejectedValue(new Error('Failed to verify transactions'));
    render(
      <BatchVerificationDialog
        open={true}
        onClose={jest.fn()}
        transactions={mockTransactions}
        mainTransaction={mockTransactions[0]}
        onVerify={onVerify}
      />
    );

    // Find and click verify button
    const verifyButton = screen.getByRole('button', { name: /verify 1 transaction/i });
    await act(async () => {
      fireEvent.click(verifyButton);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to verify transactions')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('disables buttons during processing', async () => {
    const onVerify = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(
      <BatchVerificationDialog
        open={true}
        onClose={jest.fn()}
        transactions={mockTransactions}
        mainTransaction={mockTransactions[0]}
        onVerify={onVerify}
      />
    );

    const verifyButton = screen.getByRole('button', { name: /verify 1 transaction/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await act(async () => {
      fireEvent.click(verifyButton);
      await Promise.resolve();
    });

    expect(verifyButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(screen.getByText(/verifying transactions/i)).toBeInTheDocument();
  });
});
