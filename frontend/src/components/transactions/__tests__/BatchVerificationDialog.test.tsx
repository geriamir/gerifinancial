import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchVerificationDialog } from '../BatchVerificationDialog';
import type { Transaction } from '../../../services/api/types/transactions';
import type { Category, SubCategory } from '../../../services/api/types';
import { act } from '@testing-library/react';

const TIMESTAMP = '2025-07-03T12:00:00Z';

const mockSetIsTracking = jest.fn();
const mockSetShowPerformance = jest.fn();
const mockAddData = jest.fn();
const mockStartTracking = jest.fn();
const mockSetIsProcessing = jest.fn();
let mockStopTracking: jest.Mock;

const setupMocks = () => {
  mockStopTracking = jest.fn(() => ({
    duration: 100,
    data: { transactionCount: mockTransactions.length }
  }));
  mockStartTracking.mockImplementation(() => ({
    addData: mockAddData,
    stop: mockStopTracking
  }));
};

// Mock the KeyboardShortcutsHelp component
jest.mock('../KeyboardShortcutsHelp', () => ({
  KeyboardShortcutsHelp: () => null
}));

// Mock performance tracking hook with controlled state updates
jest.mock('../../../hooks/usePerformanceTracking', () => {
  const setIsTracking = mockSetIsTracking;
  const setShowPerformance = mockSetShowPerformance;
  const setIsProcessing = mockSetIsProcessing;

  return {
    usePerformanceTracking: () => ({
      startTracking: mockStartTracking,
      stopTracking: mockStopTracking,
      addData: mockAddData,
      setIsTracking,
      setShowPerformance,
      setIsProcessing
    })
  };
});

// Mock verification analytics hook
jest.mock('../../../hooks/useVerificationAnalytics', () => ({
  useVerificationAnalytics: () => ({
    trackVerificationBatch: jest.fn()
  })
}));

// Mock keyboard shortcuts hook
jest.mock('../../../hooks/useBatchVerificationKeyboard', () => ({
  useBatchVerificationKeyboard: () => ({
    registerShortcuts: jest.fn(),
    unregisterShortcuts: jest.fn()
  })
}));

// Mock performance metrics display component
jest.mock('../../performance/PerformanceMetricsDisplay', () => ({
  PerformanceMetricsDisplay: () => null
}));

const mockBatchTransactionList = jest.fn();

// Mock BatchTransactionList component
jest.mock('../BatchTransactionList', () => ({
  BatchTransactionList: (props: any) => {
    mockBatchTransactionList(props);
    return (
      <div data-testid="batch-transaction-list">
        {props.transactions.map((tx: Transaction) => (
          <div key={tx._id} data-testid={`transaction-row-${tx._id}`}>
            <div>{tx.description}</div>
            <input
              type="checkbox"
              role="checkbox"
              checked={props.selectedIds.includes(tx._id)}
              onChange={(e) => props.onSelectionChange?.(tx._id, e.target.checked)}
              disabled={props.disabled || tx._id === props.mainTransaction?._id}
              data-testid={`checkbox-${tx._id}`}
            />
            {tx.category && (
              <div data-testid="category-info">
                {tx.category.name} {'->'} {tx.subCategory?.name}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
}));

const mockCategory: Category = {
  _id: 'cat1',
  name: 'Food',
  type: 'Expense',
  userId: 'user1',
  subCategories: [],
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

mockCategory.subCategories = [mockSubCategory];

const mockMainTransaction: Transaction = {
  _id: 'tx1',
  identifier: 'test-tx-1',
  accountId: 'acc1',
  userId: 'user1',
  amount: -100,
  currency: 'ILS',
  date: TIMESTAMP,
  type: 'Expense',
  description: 'Test Restaurant',
  status: 'pending',
  category: mockCategory,
  subCategory: mockSubCategory,
  rawData: {},
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  categorizationMethod: 'manual'
};

const mockTransactions: Transaction[] = [
  mockMainTransaction,
  {
    ...mockMainTransaction,
    _id: 'tx2',
    description: 'Similar Restaurant',
    amount: -90
  },
  {
    ...mockMainTransaction,
    _id: 'tx3',
    description: 'Another Restaurant',
    amount: -110
  }
];

describe('BatchVerificationDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    transactions: mockTransactions,
    mainTransaction: mockMainTransaction,
    onVerify: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('renders with transaction list and main transaction selected', async () => {
    await act(async () => {
      render(<BatchVerificationDialog {...defaultProps} />);
    });
    
    expect(screen.getByTestId('transaction-row-tx1')).toHaveTextContent('Test Restaurant');
    expect(screen.getByTestId('transaction-row-tx2')).toHaveTextContent('Similar Restaurant');
    expect(screen.getByTestId('transaction-row-tx3')).toHaveTextContent('Another Restaurant');

    expect(mockBatchTransactionList).toHaveBeenCalledWith(
      expect.objectContaining({
        transactions: mockTransactions,
        selectedIds: [mockMainTransaction._id],
        mainTransaction: mockMainTransaction
      })
    );
  });

  it('handles transaction selection', async () => {
    await act(async () => {
      render(<BatchVerificationDialog {...defaultProps} />);
    });

    const checkbox = screen.getByTestId('checkbox-tx2');
    await act(async () => {
      fireEvent.click(checkbox);
    });

    expect(screen.getByRole('button', { name: /verify 2 transactions/i })).toBeInTheDocument();
  });

  it('shows progress during verification', async () => {
    await act(async () => {
      render(<BatchVerificationDialog {...defaultProps} progress={{
        total: 3,
        current: 1,
        successful: 1,
        failed: 0
      }} />);
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Verifying transactions...')).toBeInTheDocument();
    
    const progressText = screen.getByText((content) => {
      return content.includes('Progress:') && content.includes('1 / 3');
    });
    expect(progressText).toHaveTextContent('1 successful');
    expect(progressText).toHaveTextContent('0 failed');
  });

  it('shows completion state after verification', async () => {
    await act(async () => {
      render(<BatchVerificationDialog {...defaultProps} progress={{
        total: 3,
        current: 3,
        successful: 2,
        failed: 1
      }} />);
    });
    
    const progressText = screen.getByText((content) => {
      return content.includes('Progress:') && content.includes('3 / 3');
    });
    expect(progressText).toHaveTextContent('2 successful');
    expect(progressText).toHaveTextContent('1 failed');
  });

  it('disables interaction during verification', async () => {
    await act(async () => {
      render(
        <BatchVerificationDialog
          {...defaultProps}
          progress={{
            total: 3,
            current: 1,
            successful: 1,
            failed: 0
          }}
        />
      );
    });

    expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /keyboard shortcuts/i })).toBeDisabled();
    expect(screen.getByText(/verifying transactions/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows category information', async () => {
    await act(async () => {
      render(<BatchVerificationDialog {...defaultProps} />);
    });
    expect(screen.getAllByTestId('category-info')[0]).toHaveTextContent('Food -> Restaurant');
  });

  it('preserves main transaction selection', async () => {
    await act(async () => {
      render(<BatchVerificationDialog {...defaultProps} />);
    });

    const mainCheckbox = screen.getByTestId('checkbox-tx1');
    const otherCheckbox = screen.getByTestId('checkbox-tx2');

    expect(mainCheckbox).toBeChecked();
    expect(mainCheckbox).toBeDisabled();
    expect(otherCheckbox).not.toBeChecked();
    expect(otherCheckbox).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(mainCheckbox);
    });
    expect(mainCheckbox).toBeChecked();

    await act(async () => {
      fireEvent.click(otherCheckbox);
    });
    expect(otherCheckbox).toBeChecked();

    await act(async () => {
      fireEvent.click(otherCheckbox);
    });
    expect(otherCheckbox).not.toBeChecked();

    expect(mainCheckbox).toBeChecked();
  });
});
