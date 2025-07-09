import { mockMainTransaction, mockTransactions, mockVerificationProgress, mockCompletedProgress } from './__fixtures__/transactions';

describe('Transaction Fixtures', () => {
  describe('mockMainTransaction', () => {
    it('should have the correct structure', () => {
      expect(mockMainTransaction).toEqual(expect.objectContaining({
        _id: expect.any(String),
        identifier: expect.any(String),
        accountId: expect.any(String),
        userId: expect.any(String),
        amount: expect.any(Number),
        currency: expect.any(String),
        date: expect.any(String),
        type: expect.any(String),
        description: expect.any(String),
        status: expect.any(String)
      }));
    });

    it('should have properly structured category data', () => {
      expect(mockMainTransaction.category).toEqual(expect.objectContaining({
        _id: expect.any(String),
        name: expect.any(String),
        type: expect.any(String)
      }));
    });

    it('should have properly structured subcategory data', () => {
      expect(mockMainTransaction.subCategory).toEqual(expect.objectContaining({
        _id: expect.any(String),
        name: expect.any(String),
        keywords: expect.any(Array),
        parentCategory: expect.objectContaining({
          _id: expect.any(String),
          name: expect.any(String),
          type: expect.any(String)
        })
      }));
    });
  });

  describe('mockTransactions', () => {
    it('should contain the correct number of transactions', () => {
      expect(mockTransactions).toHaveLength(3);
    });

    it('should have unique identifiers for each transaction', () => {
      const ids = mockTransactions.map(tx => tx._id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(mockTransactions.length);
    });
  });

  describe('Progress Objects', () => {
    it('should have valid verification progress structure', () => {
      expect(mockVerificationProgress).toEqual({
        total: expect.any(Number),
        current: expect.any(Number),
        successful: expect.any(Number),
        failed: expect.any(Number)
      });
    });

    it('should have valid completed progress structure', () => {
      expect(mockCompletedProgress).toEqual({
        total: expect.any(Number),
        current: expect.any(Number),
        successful: expect.any(Number),
        failed: expect.any(Number)
      });
    });

    it('should have consistent progress numbers', () => {
      expect(mockCompletedProgress.successful + mockCompletedProgress.failed).toBe(mockCompletedProgress.current);
      expect(mockVerificationProgress.successful + mockVerificationProgress.failed).toBe(mockVerificationProgress.current);
    });
  });
});
