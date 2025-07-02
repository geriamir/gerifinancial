import React from 'react';
import { render, screen } from '@testing-library/react';
import TransactionRow from '../TransactionRow';
import { Transaction } from '../../../services/api/types';

describe('TransactionRow', () => {
  const mockTransaction: Transaction = {
    _id: 'test-transaction-1',
    userId: 'user-1',
    accountId: 'account-1',
    amount: -100,
    currency: 'ILS',
    date: '2025-07-02T12:00:00.000Z',
    description: 'Test Transaction',
    type: 'Expense',
    status: 'processed',
    category: {
      _id: 'cat-1',
      name: 'Food',
      type: 'Expense'
    },
    subCategory: {
      _id: 'subcat-1',
      name: 'Restaurants',
      parentCategory: {
        _id: 'cat-1',
        name: 'Food',
        type: 'Expense'
      },
      keywords: ['restaurant', 'dining'],
      isDefault: false
    }
  };

  it('should display transaction with category and subcategory', () => {
    render(<TransactionRow transaction={mockTransaction} />);

    // Check category chip
    // Check all elements are displayed correctly
    expect(screen.getByTestId('transaction-test-transaction-1-category')).toHaveTextContent('Food');
    expect(screen.getByTestId('transaction-test-transaction-1-subcategory')).toHaveTextContent('Restaurants');
    expect(screen.getByTestId('transaction-test-transaction-1-description')).toHaveTextContent('Test Transaction');
    expect(screen.getByTestId('transaction-test-transaction-1-amount')).toHaveTextContent('₪100.00');
    expect(screen.getByTestId('transaction-test-transaction-1-date')).toHaveTextContent('02/07/2025');
  });

  it('should display transaction without subcategory', () => {
    const txWithoutSubCategory = {
      ...mockTransaction,
      subCategory: undefined
    };

    render(<TransactionRow transaction={txWithoutSubCategory} />);

    // Check only category chip is present
    expect(screen.getByTestId('transaction-test-transaction-1-category')).toHaveTextContent('Food');
    expect(screen.queryByTestId('transaction-test-transaction-1-subcategory')).toBeNull();
  });

  it('should display transaction without category or subcategory', () => {
    const txWithoutCategories = {
      ...mockTransaction,
      category: undefined,
      subCategory: undefined
    };

    render(<TransactionRow transaction={txWithoutCategories} />);

    // Neither chip should exist
    const categoryChip = screen.queryByTestId('transaction-test-transaction-1-category');
    const subcategoryChip = screen.queryByTestId('transaction-test-transaction-1-subcategory');
    expect(categoryChip).toBeNull();
    expect(subcategoryChip).toBeNull();
  });

});
