import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TransactionVerificationList } from '../TransactionVerificationList';
import { transactionsApi } from '../../../services/api/transactions';
import type { Transaction } from '../../../services/api/types/transaction';

// Mock the API
jest.mock('../../../services/api/transactions');

const baseTransaction: Transaction = {
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
  baseTransaction,
  {
    ...baseTransaction,
    _id: 'tx2',
    description: 'Same Restaurant',
    amount: -95
  },
  {
    ...baseTransaction,
    _id: 'tx3',
    description: 'Different Restaurant',
    amount: -110
  }
];

describe('Batch Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (transactionsApi.getSuggestion as jest.Mock).mockResolvedValue({
      suggestion: {
        categoryId: 'cat1',
        subCategoryId: 'sub1',
        confidence: 0.9,
        reasoning: 'Strong match based on keywords'
      }
    });
    (transactionsApi.findSimilarTransactions as jest.Mock).mockResolvedValue({
      transactions: mockTransactions,
      similarity: 0.85
    });
  });

  it('shows batch verification button when similar transactions are found', async () => {
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

    // Expand first transaction
    fireEvent.click(screen.getByLabelText(/expand/i));

    await waitFor(() => {
      expect(screen.getByText(/verify similar/i)).toBeInTheDocument();
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument(); // Shows count
    });
  });

  it('opens batch verification dialog with correct transactions', async () => {
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

    // Expand and click batch verify
    fireEvent.click(screen.getByLabelText(/expand/i));
    await waitFor(() => {
      expect(screen.getByText(/verify similar/i)).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText(/verify similar/i));

    // Check dialog content
    expect(screen.getByText('Batch Verification')).toBeInTheDocument();
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Same Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Different Restaurant')).toBeInTheDocument();
  });

  it('handles batch verification correctly', async () => {
    const mockOnVerify = jest.fn();
    (transactionsApi.verifyBatch as jest.Mock).mockResolvedValue({
      message: '3 transaction(s) verified successfully',
      successful: [
        { id: 'tx1', success: true },
        { id: 'tx2', success: true },
        { id: 'tx3', success: true }
      ],
      failed: []
    });

    render(
      <MemoryRouter>
        <TransactionVerificationList
          transactions={mockTransactions}
          onVerify={mockOnVerify}
          hasMore={false}
          loading={false}
          onLoadMore={jest.fn()}
        />
      </MemoryRouter>
    );

    // Expand and open batch verification
    fireEvent.click(screen.getByLabelText(/expand/i));
    await waitFor(() => {
      expect(screen.getByText(/verify similar/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/verify similar/i));

    // Verify all transactions
    const verifyButton = screen.getByRole('button', { name: /verify 3 transactions/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(transactionsApi.verifyBatch).toHaveBeenCalledWith(['tx1', 'tx2', 'tx3']);
    });
  });

  it('handles batch verification errors gracefully', async () => {
    (transactionsApi.verifyBatch as jest.Mock).mockRejectedValue(new Error('Network error'));
    
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

    // Expand and open batch verification
    fireEvent.click(screen.getByLabelText(/expand/i));
    await waitFor(() => {
      expect(screen.getByText(/verify similar/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/verify similar/i));

    // Try to verify
    const verifyButton = screen.getByRole('button', { name: /verify 3 transactions/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to verify transactions/i)).toBeInTheDocument();
    });
  });
});
