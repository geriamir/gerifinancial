import React from 'react';
import { render, screen, within } from '@testing-library/react';
import TransactionRow from '../TransactionRow';
import { Transaction } from '../../../services/api/types/transactions';
import { categoryIcons } from '../../../constants/categoryIcons';
import type { Category, SubCategory } from '../../../services/api/types/categories';

describe('TransactionRow', () => {
  const mockTransaction: Transaction = {
    _id: 'test-transaction-1',
    identifier: 'test-transaction-1',
    userId: 'user-1',
    accountId: 'account-1',
    amount: -100,
    currency: 'ILS',
    date: '2025-07-02T12:00:00.000Z',
    description: 'Test Transaction',
    type: 'Expense',
    status: 'verified',
    categorizationMethod: 'manual',
    rawData: {},
    createdAt: '2025-07-02T12:00:00.000Z',
    updatedAt: '2025-07-02T12:00:00.000Z',
    category: {
      _id: 'cat-1',
      name: 'Food',
      type: 'Expense',
      userId: 'user-1',
      subCategories: [],
      createdAt: '2025-07-02T12:00:00.000Z',
      updatedAt: '2025-07-02T12:00:00.000Z'
    },
    subCategory: {
      _id: 'subcat-1',
      name: 'Restaurants',
      userId: 'user-1',
      keywords: ['restaurant', 'dining'],
      isDefault: false,
      parentCategory: 'cat-1',
      createdAt: '2025-07-02T12:00:00.000Z',
      updatedAt: '2025-07-02T12:00:00.000Z'
    }
  };

  it('should display transaction basic information', () => {
    render(<TransactionRow transaction={mockTransaction} />);

    // Check description, date and amount
    expect(screen.getByTestId('transaction-test-transaction-1-description')).toHaveTextContent('Test Transaction');
    expect(screen.getByTestId('transaction-test-transaction-1-amount')).toHaveTextContent('₪100.00');
    expect(screen.getByTestId('transaction-test-transaction-1-date')).toHaveTextContent('02/07/2025');
  });

  it('should display transaction with mapped subcategory', () => {
    const txWithMappedCategory = {
      ...mockTransaction,
      subCategory: {
        _id: 'subcat-2',
        name: 'Mortgage',
        userId: 'user-1',
        parentCategory: 'cat-2',
        keywords: ['mortgage', 'loan'],
        isDefault: true,
        createdAt: '2025-07-02T12:00:00.000Z',
        updatedAt: '2025-07-02T12:00:00.000Z'
      }
    };

    render(<TransactionRow transaction={txWithMappedCategory} />);

    // Check that the icon button is rendered within the transaction row
    const iconContainer = screen.getByTestId('transaction-test-transaction-1-subcategory');
    expect(iconContainer).toBeInTheDocument();
    
    // Check that the icon button within the container has correct aria-label
    const iconButton = within(iconContainer).getByTestId('transaction-test-transaction-1-subcategory-chip-icon');
    expect(iconButton).toBeInTheDocument();
    expect(iconButton).toHaveAttribute('aria-label', 'Mortgage');
  });

  it('should handle transaction with unmapped subcategory', () => {
    const txWithUnmappedCategory = {
      ...mockTransaction,
      subCategory: {
        _id: 'subcat-3',
        name: 'Custom Category',
        userId: 'user-1',
        parentCategory: 'cat-2',
        keywords: [],
        isDefault: false,
        createdAt: '2025-07-02T12:00:00.000Z',
        updatedAt: '2025-07-02T12:00:00.000Z'
      }
    };

    render(<TransactionRow transaction={txWithUnmappedCategory} />);

    // Check that the text chip is rendered with correct text
    const container = screen.getByTestId('transaction-test-transaction-1-subcategory');
    expect(container).toBeInTheDocument();
    const textChip = within(container).getByTestId('transaction-test-transaction-1-subcategory-chip-text');
    expect(textChip).toBeInTheDocument();
  });

  it('should handle transaction without subcategory', () => {
    const txWithoutSubCategory = {
      ...mockTransaction,
      subCategory: undefined
    };

    render(<TransactionRow transaction={txWithoutSubCategory} />);

    // Check that no subcategory element is rendered
    const subcategoryElement = screen.queryByTestId('transaction-test-transaction-1-subcategory');
    expect(subcategoryElement).not.toBeInTheDocument();
  });
});
