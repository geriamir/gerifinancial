import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TransactionVerificationList } from '../TransactionVerificationList';
import type { PendingTransaction } from '../../../services/api/types/transactions';
import type { Category, SubCategory } from '../../../services/api/types';

const TIMESTAMP = '2025-07-03T12:00:00Z';

// Create mock data with all required fields from the categories interface
const mockCategory: Category = {
  _id: 'cat1',
  name: 'Food',
  type: 'Expense',
  userId: 'user1',
  subCategories: [],  // Will be updated after creating mockSubCategory
  rules: [],
  isActive: true,
  color: '#000000',
  icon: 'restaurant',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
};

const mockSubCategory: SubCategory = {
  _id: 'sub1',
  name: 'Restaurant',
  parentCategory: mockCategory,  // Use the full category object as parentCategory
  userId: 'user1',
  keywords: [],
  isDefault: false,
  rules: [],
  isActive: true,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
};

// Update category's subCategories to include the mockSubCategory
mockCategory.subCategories = [mockSubCategory];

// Mock the transactions API
jest.mock('../../../services/api/transactions');

describe('TransactionVerificationList', () => {
  const mockTransaction: PendingTransaction = {
    _id: 'tx1',
    identifier: 'test-tx-1',
    accountId: 'acc1',
    userId: 'user1',
    amount: -100,
    currency: 'ILS',
    date: TIMESTAMP,
    type: 'Expense',
    description: 'Test Restaurant',
    memo: 'Test Memo',
    status: 'pending',
    categorizationMethod: 'manual',
    category: mockCategory,
    subCategory: mockSubCategory,
    rawData: {},
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP
  };

  it('renders a list of transactions', () => {
    render(
      <MemoryRouter>
        <TransactionVerificationList
          transactions={[mockTransaction]}
          onVerify={jest.fn()}
          hasMore={false}
          loading={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
    expect(screen.getByText('100.00 ₪')).toBeInTheDocument();
  });

  it('shows loading state when loading more transactions', () => {
    render(
      <MemoryRouter>
        <TransactionVerificationList
          transactions={[mockTransaction]}
          onVerify={jest.fn()}
          hasMore={true}
          loading={true}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });

  it('calls onVerify when verifying a transaction', () => {
    const mockOnVerify = jest.fn();
    render(
      <MemoryRouter>
        <TransactionVerificationList
          transactions={[mockTransaction]}
          onVerify={mockOnVerify}
          hasMore={false}
          loading={false}
        />
      </MemoryRouter>
    );

    const verifyButton = screen.getByTitle('Verify transaction');
    fireEvent.click(verifyButton);
    expect(mockOnVerify).toHaveBeenCalledWith('tx1');
  });

  it('shows load more button when hasMore is true', () => {
    const mockOnLoadMore = jest.fn();
    render(
      <MemoryRouter>
        <TransactionVerificationList
          transactions={[mockTransaction]}
          onVerify={jest.fn()}
          hasMore={true}
          loading={false}
          onLoadMore={mockOnLoadMore}
        />
      </MemoryRouter>
    );

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    expect(loadMoreButton).toBeInTheDocument();
    fireEvent.click(loadMoreButton);
    expect(mockOnLoadMore).toHaveBeenCalled();
  });

  describe('Keyboard Shortcuts', () => {
    const mockTransactions = [
      mockTransaction,
      {
        ...mockTransaction,
        _id: 'tx2',
        description: 'Second Transaction'
      },
      {
        ...mockTransaction,
        _id: 'tx3',
        description: 'Third Transaction'
      }
    ];

    it('shows help dialog when clicking help button', () => {
      render(
        <MemoryRouter>
          <TransactionVerificationList
            transactions={mockTransactions}
            onVerify={jest.fn()}
            hasMore={false}
            loading={false}
          />
        </MemoryRouter>
      );

      // Open help dialog
      fireEvent.click(screen.getByLabelText('keyboard shortcuts'));

      // Check that shortcuts are displayed
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Verify current transaction')).toBeInTheDocument();
      expect(screen.getByText('Next transaction')).toBeInTheDocument();

      // Close dialog
      fireEvent.click(screen.getByText('Got it'));
      expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    });

    it('disables shortcuts when loading', () => {
      const mockOnVerify = jest.fn();
      render(
        <MemoryRouter>
          <TransactionVerificationList
            transactions={mockTransactions}
            onVerify={mockOnVerify}
            hasMore={false}
            loading={true}
          />
        </MemoryRouter>
      );

      fireEvent.keyDown(window, { key: 'e' });
      fireEvent.keyDown(window, { key: 'v' });
      fireEvent.keyDown(window, { key: 'n' });

      expect(mockOnVerify).not.toHaveBeenCalled();
    });
  });
});
