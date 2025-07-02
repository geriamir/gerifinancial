import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { transactionsApi } from '../../../services/api/transactions';
import TransactionsList from '../TransactionsList';

// Mock the API module
jest.mock('../../../services/api/transactions');

const mockTransactions = (startId: number, count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    _id: `transaction-${startId + i}`,
    amount: 100 + i,
    currency: 'ILS',
    date: new Date(2025, 5, i + 1).toISOString(),
    description: `Test Transaction ${startId + i}`,
    type: i % 2 === 0 ? 'Expense' : 'Income',
    status: 'pending'
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

  it('should load more transactions on scroll', async () => {
    const initialTransactions = mockTransactions(1, 10);
    const nextPageTransactions = mockTransactions(11, 10);

    // Set up mock responses with debug logging
    (transactionsApi.getTransactions as jest.Mock).mockImplementation(async (params) => {
      console.log('Mock API called with params:', params);
      
      // Return different responses based on skip parameter
      if (params.skip === 0) {
        console.log('Returning initial page');
        return Promise.resolve({
          transactions: initialTransactions,
          total: 30,
          hasMore: true
        });
      } else {
        console.log('Returning next page');
        return Promise.resolve({
          transactions: nextPageTransactions,
          total: 30,
          hasMore: true
        });
      }
    });

    render(<TransactionsList filters={{}} />);

    // Wait for initial transactions
    await waitFor(() => {
      expect(screen.getByText('Test Transaction 1')).toBeInTheDocument();
    });

    // Simulate intersection observer callback
    // Wait for initial page to load
    await waitFor(() => {
      const items = screen.getAllByTestId(/^transaction-item-/);
      expect(items).toHaveLength(10);
    });

    // Create a promise to track loading state
    let resolveNextPage: (value: any) => void;
    const nextPagePromise = new Promise(resolve => {
      resolveNextPage = resolve;
    });

    // Mock API call with controlled delay
    (transactionsApi.getTransactions as jest.Mock).mockImplementationOnce(
      () => nextPagePromise
    );

    // Trigger infinite scroll
    act(() => {
      const [observerCallback] = (window.IntersectionObserver as jest.Mock).mock.calls[0];
      observerCallback([{ isIntersecting: true }]);
    });

    // Verify loading state appears
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeInTheDocument();
    });

    // Resolve the API call
    await act(async () => {
      resolveNextPage!({
        transactions: nextPageTransactions,
        total: 30,
        hasMore: true
      });
    });

    // Wait for next page content and loading to disappear
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      expect(screen.getByText('Test Transaction 11')).toBeInTheDocument();
      const items = screen.getAllByTestId(/^transaction-item-/);
      expect(items).toHaveLength(20);
    });

    // Verify API was called with correct pagination
    expect(transactionsApi.getTransactions).toHaveBeenCalledWith({
      limit: 20,
      skip: 20
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
