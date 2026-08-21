import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TransactionDetailDialog from '../TransactionDetailDialog';
import type { Transaction } from '../../../services/api/types/transactions';
import { transactionsApi } from '../../../services/api/transactions';

jest.mock('../../../services/api/transactions', () => ({
  transactionsApi: {
    getTags: jest.fn()
  }
}));

jest.mock('../../../hooks/useCategories', () => ({
  useCategories: () => ({ categories: [] })
}));

jest.mock('../EnhancedCategorizationDialog', () => ({
  EnhancedCategorizationDialog: () => null
}));

jest.mock('../TransactionBudgetExclusion', () => () => null);

const getTags = transactionsApi.getTags as jest.MockedFunction<
  typeof transactionsApi.getTags
>;

const transaction = (rawData: Transaction['rawData']): Transaction => ({
  _id: 'transaction-id',
  identifier: 'transaction-identifier',
  accountId: 'account-id',
  amount: -700,
  currency: 'ILS',
  date: '2026-04-15T12:00:00.000Z',
  type: 'Expense',
  description: 'HOTEL ROMA',
  categorizationMethod: 'ai',
  rawData,
  createdAt: '2026-04-15T12:00:00.000Z',
  updatedAt: '2026-04-15T12:00:00.000Z',
  userId: 'user-id',
  status: 'verified'
});

beforeEach(() => {
  jest.clearAllMocks();
  getTags.mockResolvedValue([]);
});

it('shows the original purchase amount alongside the converted charge', async () => {
  render(
    <TransactionDetailDialog
      open
      transaction={transaction({
        chargedCurrency: '₪',
        originalAmount: -180,
        originalCurrency: '€'
      })}
      onClose={jest.fn()}
    />
  );

  expect(screen.getByText('Charged amount')).toBeInTheDocument();
  expect(screen.getByText('-700.00 ₪')).toBeInTheDocument();
  expect(screen.getByText('Original purchase')).toBeInTheDocument();
  expect(screen.getByText('-180.00 EUR')).toBeInTheDocument();
  await waitFor(() => expect(getTags).toHaveBeenCalled());
});

it('does not repeat original purchase details for a local charge', async () => {
  render(
    <TransactionDetailDialog
      open
      transaction={transaction({
        chargedCurrency: '₪',
        originalAmount: -700,
        originalCurrency: '₪'
      })}
      onClose={jest.fn()}
    />
  );

  expect(screen.getByText('Amount')).toBeInTheDocument();
  expect(screen.queryByText('Original purchase')).not.toBeInTheDocument();
  await waitFor(() => expect(getTags).toHaveBeenCalled());
});

it('falls back to the account currency when scraper currency is blank', async () => {
  render(
    <TransactionDetailDialog
      open
      transaction={{
        ...transaction({
          chargedCurrency: '   ',
          originalCurrency: 'EUR'
        }),
        currency: 'EUR'
      }}
      onClose={jest.fn()}
    />
  );

  expect(screen.getByText('-700.00 EUR')).toBeInTheDocument();
  expect(screen.queryByText('Original purchase')).not.toBeInTheDocument();
  await waitFor(() => expect(getTags).toHaveBeenCalled());
});

it('treats a whitespace-only original amount as unavailable', async () => {
  render(
    <TransactionDetailDialog
      open
      transaction={transaction({
        chargedCurrency: 'ILS',
        originalAmount: '   ',
        originalCurrency: 'USD'
      })}
      onClose={jest.fn()}
    />
  );

  expect(screen.getByText('Original purchase')).toBeInTheDocument();
  expect(screen.getByText('USD')).toBeInTheDocument();
  expect(screen.queryByText('0.00 USD')).not.toBeInTheDocument();
  await waitFor(() => expect(getTags).toHaveBeenCalled());
});
