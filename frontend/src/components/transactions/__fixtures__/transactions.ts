import type { Transaction } from '../../../services/api/types/transaction';

const mockSubCategory = {
  _id: 'sub1',
  name: 'Restaurant',
  parent: 'cat1',
  isActive: true
};

const mockCategory = {
  _id: 'cat1',
  name: 'Food',
  type: 'Expense' as const,
  subCategories: [mockSubCategory],
  isActive: true
};

export const mockMainTransaction: Transaction = {
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
  category: mockCategory,
  subCategory: mockSubCategory,
  rawData: {},
  createdAt: '2025-07-03T12:00:00Z',
  updatedAt: '2025-07-03T12:00:00Z'
};

export const mockTransactions: Transaction[] = [
  mockMainTransaction,
  {
    ...mockMainTransaction,
    _id: 'tx2',
    description: 'Similar Restaurant',
    amount: -90,
    identifier: 'test-tx-2'
  },
  {
    ...mockMainTransaction,
    _id: 'tx3',
    description: 'Another Restaurant',
    amount: -110,
    identifier: 'test-tx-3'
  }
];

export const mockVerificationProgress = {
  total: 3,
  current: 1,
  successful: 1,
  failed: 0
};

export const mockCompletedProgress = {
  total: 3,
  current: 3,
  successful: 2,
  failed: 1
};
