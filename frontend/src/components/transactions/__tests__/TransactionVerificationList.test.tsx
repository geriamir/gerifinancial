import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionVerificationList } from '../TransactionVerificationList';
import { PendingTransaction } from '../../../services/api/types/transactions';
import type { Category } from '../../../services/api/types';
import { act } from '@testing-library/react';

const TIMESTAMP = '2025-07-03T12:00:00Z';

const mockCategory: Category = {
  _id: 'cat1',
  name: 'Food',
  type: 'Expense',
  userId: 'user1',
  subCategories: [],
  rules: [],
  isActive: true,
  color: '#000000',
  icon: 'category',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
};

const mockTransaction: PendingTransaction = {
  _id: 'tx1',
  identifier: 'test-tx-1',
  accountId: 'acc1',
  userId: 'user1',
  amount: 100,
  currency: 'ILS',
  date: TIMESTAMP,
  type: 'Expense',
  description: 'Test Restaurant',
  status: 'pending',
  category: mockCategory,
  rawData: {},
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  categorizationMethod: 'manual'
};

describe('TransactionVerificationList', () => {
  it('renders a list of transactions', () => {
    render(
      <TransactionVerificationList
        transactions={[mockTransaction]}
        onVerify={jest.fn()}
      />
    );

    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
    // Use regex to match currency amount due to RTL characters
    expect(screen.getByText(/100\.00.*₪/)).toBeInTheDocument();
  });

  it('shows loading state when loading more transactions', () => {
    render(
      <TransactionVerificationList
        transactions={[mockTransaction]}
        onVerify={jest.fn()}
        loading={true}
        hasMore={true}
      />
    );

    expect(screen.getByRole('button', { name: /loading/i })).toBeInTheDocument();
  });

  it('calls onVerify when verify button is clicked', () => {
    const mockVerify = jest.fn();
    render(
      <TransactionVerificationList
        transactions={[mockTransaction]}
        onVerify={mockVerify}
      />
    );

    const verifyButton = screen.getByLabelText('verify');
    fireEvent.click(verifyButton);

    expect(mockVerify).toHaveBeenCalledWith(mockTransaction._id);
  });

  it('calls onLoadMore when load more button is clicked', () => {
    const mockLoadMore = jest.fn();
    render(
      <TransactionVerificationList
        transactions={[mockTransaction]}
        onVerify={jest.fn()}
        onLoadMore={mockLoadMore}
        hasMore={true}
      />
    );

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    expect(mockLoadMore).toHaveBeenCalled();
  });

  describe('Keyboard Shortcuts', () => {
    it('shows help dialog when clicking help button', async () => {
      render(
        <TransactionVerificationList
          transactions={[mockTransaction]}
          onVerify={jest.fn()}
        />
      );

      // Open help dialog
      const helpButton = screen.getByLabelText('keyboard shortcuts');
      await act(async () => {
        fireEvent.click(helpButton);
      });

      // Check that shortcuts are displayed
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      expect(screen.getByText(/Expand\/collapse current transaction/)).toBeInTheDocument();
      expect(screen.getByText(/Verify current transaction/)).toBeInTheDocument();
      expect(screen.getByText(/Next transaction/)).toBeInTheDocument();
      expect(screen.getByText(/Previous transaction/)).toBeInTheDocument();

      // Close dialog
      const closeButton = screen.getByRole('button', { name: /got it/i });
      await act(async () => {
        fireEvent.click(closeButton);
      });

      // Wait for dialog to be closed
      await waitFor(() => {
        expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
      });
    });
  });

  it('shows verification status when provided', () => {
    render(
      <TransactionVerificationList
        transactions={[mockTransaction]}
        onVerify={jest.fn()}
        verificationStatus={{
          current: 5,
          successful: 3,
          failed: 2
        }}
      />
    );

    expect(screen.getByText('3 Successful')).toBeInTheDocument();
    expect(screen.getByText('2 Failed')).toBeInTheDocument();
  });

  it('shows error message when error is provided', () => {
    const errorMessage = 'Failed to load transactions';
    render(
      <TransactionVerificationList
        transactions={[mockTransaction]}
        onVerify={jest.fn()}
        error={errorMessage}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
