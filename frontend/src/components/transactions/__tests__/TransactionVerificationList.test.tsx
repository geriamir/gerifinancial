import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TransactionVerificationList } from '../TransactionVerificationList';
import { transactionsApi } from '../../../services/api/transactions';
import type { Transaction } from '../../../services/api/types/transaction';

// Mock the transactions API
jest.mock('../../../services/api/transactions');
jest.mock('../../../hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [
      {
        _id: 'cat1',
        name: 'Food',
        type: 'Expense',
        subCategories: [
          { 
            _id: 'sub1',
            name: 'Restaurant',
            keywords: ['food'],
            parentCategory: {
              _id: 'cat1',
              name: 'Food',
              type: 'Expense'
            },
            isDefault: false
          }
        ]
      }
    ],
    loading: false,
    error: null
  })
}));

describe('TransactionVerificationList', () => {
  const mockTransaction: Transaction = {
    _id: 'tx1',
    identifier: 'test-tx-1',
    accountId: 'acc1',
    userId: 'user1',
    amount: -100,
    currency: 'ILS',
    date: '2025-07-03T12:00:00Z',
    type: 'Expense',
    description: 'Test Restaurant',
    memo: 'Test Memo',
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

  const mockSuggestion = {
    categoryId: 'cat1',
    subCategoryId: 'sub1',
    confidence: 0.9,
    reasoning: 'Strong match based on keywords'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (transactionsApi.getSuggestion as jest.Mock).mockResolvedValue({
      suggestion: mockSuggestion,
      transaction: {
        id: 'tx1',
        description: 'Test Restaurant',
        amount: -100
      }
    });
  });

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
    expect(screen.getByText(/₪100/)).toBeInTheDocument();
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

  it('loads category suggestion when expanding a transaction', async () => {
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

    // Click expand button
    fireEvent.click(screen.getByLabelText(/expand/i));

    await waitFor(() => {
      expect(transactionsApi.getSuggestion).toHaveBeenCalledWith('tx1');
      expect(screen.getByText(/Strong match based on keywords/i)).toBeInTheDocument();
    });
  });

  it('calls onVerify when verifying a transaction', async () => {
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

    // Expand and click verify
    fireEvent.click(screen.getByLabelText(/expand/i));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));
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

  it('displays confidence level correctly', async () => {
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

    fireEvent.click(screen.getByLabelText(/expand/i));
    
    await waitFor(() => {
      const suggestionChip = screen.getByText(/Strong match based on keywords/i);
      expect(suggestionChip).toBeInTheDocument();
      expect(suggestionChip.closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess');
    });
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

    it('supports navigation with keyboard shortcuts', async () => {
      const mockOnVerify = jest.fn();
      render(
        <MemoryRouter>
          <TransactionVerificationList
            transactions={mockTransactions}
            onVerify={mockOnVerify}
            hasMore={false}
            loading={false}
          />
        </MemoryRouter>
      );

      // Expand first transaction
      fireEvent.keyDown(window, { key: 'e' });
      expect(await screen.findByText(/Strong match based on keywords/i)).toBeInTheDocument();

      // Move to next transaction
      fireEvent.keyDown(window, { key: 'n' });
      expect(screen.getByText('Second Transaction')).toBeInTheDocument();
      expect(screen.getByLabelText('Expand')).toBeInTheDocument();

      // Move to previous transaction
      fireEvent.keyDown(window, { key: 'p' });
      expect(screen.getByText(mockTransaction.description)).toBeInTheDocument();
    });

    it('handles verification with keyboard shortcuts', async () => {
      const mockOnVerify = jest.fn();
      render(
        <MemoryRouter>
          <TransactionVerificationList
            transactions={mockTransactions}
            onVerify={mockOnVerify}
            hasMore={false}
            loading={false}
          />
        </MemoryRouter>
      );

      // Expand transaction
      fireEvent.keyDown(window, { key: 'e' });
      await screen.findByText(/Strong match based on keywords/i);

      // Verify with keyboard shortcut
      fireEvent.keyDown(window, { key: 'v' });
      expect(mockOnVerify).toHaveBeenCalledWith(mockTransaction._id);
    });

    it('shows help dialog when clicking help button', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: /keyboard shortcuts/i }));

      // Check that shortcuts are displayed
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
      expect(screen.getByText('Verify current transaction')).toBeInTheDocument();
      expect(screen.getByText('Next transaction')).toBeInTheDocument();

      // Close dialog
      fireEvent.click(screen.getByRole('button', { name: /got it/i }));
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
