import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { transactionsApi } from '../../../services/api/transactions';
import TransactionsList from '../TransactionsList';
import type { Transaction } from '../../../services/api/types/transactions';
import type { Category, SubCategory } from '../../../services/api/types';

// Mock the API module
jest.mock('../../../services/api/transactions');

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
  parentCategory: mockCategory._id,
  userId: 'user1',
  keywords: ['restaurant', 'food'],
  isDefault: false,
  rules: [],
  isActive: true,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
};

// Update category's subCategories
mockCategory.subCategories = [mockSubCategory];

const mockTransactions = (startId: number, count: number): Transaction[] => {
  return Array.from({ length: count }, (_, i) => ({
    _id: `transaction-${startId + i}`,
    identifier: `test-tx-${startId + i}`,
    accountId: 'acc1',
    userId: 'user1',
    amount: 100 + i,
    currency: 'ILS',
    date: new Date(2025, 5, i + 1).toISOString(),
    description: `Test Transaction ${startId + i}`,
    type: i % 2 === 0 ? 'Expense' : 'Income',
    status: 'pending',
    category: mockCategory,
    subCategory: mockSubCategory,
    rawData: {},
    createdAt: new Date(2025, 5, i + 1).toISOString(),
    updatedAt: new Date(2025, 5, i + 1).toISOString(),
    categorizationMethod: 'manual'
  }));
};

describe('TransactionsList', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup IntersectionObserver mock
    const mockIntersectionObserver = jest.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    });
    window.IntersectionObserver = mockIntersectionObserver;
  });

  it('should render initial transactions', async () => {
    const transactions = mockTransactions(1, 10);
    (transactionsApi.getTransactions as jest.Mock).mockResolvedValueOnce({
      transactions,
      total: 20,
      hasMore: true
    });

    render(<TransactionsList filters={{}} />);

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText('Test Transaction 1')).toBeInTheDocument();
    });

    // Verify all transactions are rendered
    transactions.forEach(tx => {
      expect(screen.getByText(tx.description)).toBeInTheDocument();
    });
  });

  it('should handle empty state', async () => {
    (transactionsApi.getTransactions as jest.Mock).mockResolvedValueOnce({
      transactions: [],
      total: 0,
      hasMore: false
    });

    render(<TransactionsList filters={{}} />);

    await waitFor(() => {
      expect(screen.getByText('No transactions found.')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    (transactionsApi.getTransactions as jest.Mock).mockRejectedValueOnce(
      new Error('API Error')
    );

    render(<TransactionsList filters={{}} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load transactions. Please try again.')).toBeInTheDocument();
    });
  });

  it('should reset and reload when filters change', async () => {
    const initialTransactions = mockTransactions(1, 10);
    const filteredTransactions = mockTransactions(21, 5);

    // Mock initial load
    (transactionsApi.getTransactions as jest.Mock).mockResolvedValueOnce({
      transactions: initialTransactions,
      total: 20,
      hasMore: true
    });

    // Mock filtered results
    (transactionsApi.getTransactions as jest.Mock).mockResolvedValueOnce({
      transactions: filteredTransactions,
      total: 5,
      hasMore: false
    });

    const { rerender } = render(<TransactionsList filters={{}} />);

    // Wait for initial transactions
    await waitFor(() => {
      expect(screen.getByText('Test Transaction 1')).toBeInTheDocument();
    });

    // Update filters
    rerender(<TransactionsList filters={{ type: 'Expense' }} />);

    // Wait for filtered transactions
    await waitFor(() => {
      expect(screen.getByText('Test Transaction 21')).toBeInTheDocument();
    });

    // Verify old transactions are removed
    expect(screen.queryByText('Test Transaction 1')).not.toBeInTheDocument();

    // Verify API was called with filters
    expect(transactionsApi.getTransactions).toHaveBeenLastCalledWith({
      type: 'Expense',
      limit: 20,
      skip: 0
    });
  });
});
