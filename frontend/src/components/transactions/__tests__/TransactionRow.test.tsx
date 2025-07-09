import React from 'react';
import { render, screen } from '@testing-library/react';
import TransactionRow from '../TransactionRow';
import type { Transaction } from '../../../services/api/types/transactions';

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
    status: 'pending',
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
      rules: [],
      isActive: true,
      color: '#000000',
      icon: 'restaurant',
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
      rules: [],
      isActive: true,
      createdAt: '2025-07-02T12:00:00.000Z',
      updatedAt: '2025-07-02T12:00:00.000Z'
    }
  };

  it('should display transaction basic information', () => {
    render(<TransactionRow transaction={mockTransaction} />);

    // Check description and amount
    expect(screen.getByTestId('transaction-test-transaction-1-description')).toHaveTextContent('Test Transaction');
    
    // Check amount - ignore any special characters and just match numbers and symbols
    const amountElement = screen.getByTestId('transaction-test-transaction-1-amount');
    const amountText = amountElement.textContent || '';
    expect(amountText.replace(/[^0-9.₪\s]/g, '')).toMatch(/100\.00\s*₪/);
  });

  it('should display transaction with mapped subcategory', () => {
    const txWithMappedCategory = {
      ...mockTransaction,
      subCategory: {
        _id: 'subcat-2',
        name: 'Mortgage',
        userId: 'user-1',
        parentCategory: 'cat-1',
        keywords: ['mortgage', 'loan'],
        isDefault: true,
        rules: [],
        isActive: true,
        createdAt: '2025-07-02T12:00:00.000Z',
        updatedAt: '2025-07-02T12:00:00.000Z'
      }
    };

    render(<TransactionRow transaction={txWithMappedCategory} />);

    // Check that the subcategory text is rendered
    const subcategoryElement = screen.getByTestId('transaction-test-transaction-1-subcategory');
    expect(subcategoryElement).toBeInTheDocument();
    expect(subcategoryElement).toHaveTextContent('Mortgage');
  });

  it('should handle transaction with unmapped subcategory', () => {
    const txWithUnmappedCategory = {
      ...mockTransaction,
      subCategory: {
        _id: 'subcat-3',
        name: 'Custom Category',
        userId: 'user-1',
        parentCategory: 'cat-1',
        keywords: [],
        isDefault: false,
        rules: [],
        isActive: true,
        createdAt: '2025-07-02T12:00:00.000Z',
        updatedAt: '2025-07-02T12:00:00.000Z'
      }
    };

    render(<TransactionRow transaction={txWithUnmappedCategory} />);

    // Check that the subcategory text is rendered
    const container = screen.getByTestId('transaction-test-transaction-1-subcategory');
    expect(container).toBeInTheDocument();
    expect(container).toHaveTextContent('Custom Category');
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
