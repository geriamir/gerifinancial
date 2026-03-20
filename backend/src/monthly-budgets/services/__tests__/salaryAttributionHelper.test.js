const { adjustForSalaryEarlyPayment, findSalaryCategory, SALARY_EARLY_DAYS } = require('../salaryAttributionHelper');
const Transaction = require('../../../banking/models/Transaction');
const Category = require('../../../banking/models/Category');
const mongoose = require('mongoose');

jest.mock('../../../banking/models/Transaction');
jest.mock('../../../banking/models/Category');

describe('salaryAttributionHelper', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const salaryCategoryId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SALARY_EARLY_DAYS', () => {
    it('should be 5', () => {
      expect(SALARY_EARLY_DAYS).toBe(5);
    });
  });

  describe('adjustForSalaryEarlyPayment', () => {
    const makeTx = (date, categoryId, amount = 10000) => ({
      _id: new mongoose.Types.ObjectId(),
      category: { _id: categoryId, type: 'Income' },
      subCategory: { _id: new mongoose.Types.ObjectId(), name: 'Main' },
      processedDate: new Date(date),
      amount
    });

    it('should return transactions unchanged when no salary category exists', async () => {
      Category.findOne.mockResolvedValue(null);
      const txns = [makeTx('2026-06-15', salaryCategoryId)];

      const result = await adjustForSalaryEarlyPayment(txns, mockUserId, 2026, 6);

      expect(result).toEqual(txns);
    });

    it('should keep mid-month salary in the same month', async () => {
      Category.findOne.mockResolvedValue({ _id: salaryCategoryId, name: 'Salary', type: 'Income' });
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      });

      const midMonthSalary = makeTx('2026-06-10', salaryCategoryId);
      const result = await adjustForSalaryEarlyPayment([midMonthSalary], mockUserId, 2026, 6);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(midMonthSalary);
    });

    it('should exclude salary from last 5 days of month (belongs to next month)', async () => {
      Category.findOne.mockResolvedValue({ _id: salaryCategoryId, name: 'Salary', type: 'Income' });
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      });

      const otherCategoryId = new mongoose.Types.ObjectId();
      const lateSalary = makeTx('2026-06-28', salaryCategoryId);
      const regularExpense = makeTx('2026-06-28', otherCategoryId);

      const result = await adjustForSalaryEarlyPayment(
        [lateSalary, regularExpense], mockUserId, 2026, 6
      );

      // Late salary should be removed, regular expense should stay
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(regularExpense);
    });

    it('should include early salary from previous month (belongs to this month)', async () => {
      Category.findOne.mockResolvedValue({ _id: salaryCategoryId, name: 'Salary', type: 'Income' });

      const earlySalaryTx = makeTx('2026-05-28', salaryCategoryId);
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([earlySalaryTx])
        })
      });

      const regularTx = makeTx('2026-06-05', new mongoose.Types.ObjectId());
      const result = await adjustForSalaryEarlyPayment([regularTx], mockUserId, 2026, 6);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(regularTx);
      expect(result).toContainEqual(earlySalaryTx);
    });

    it('should handle salary on the boundary day correctly', async () => {
      Category.findOne.mockResolvedValue({ _id: salaryCategoryId, name: 'Salary', type: 'Income' });
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      });

      // June has 30 days. Late window starts at June 26 (July 1 - 5 days).
      // June 25 should stay in June, June 26 should be attributed to July.
      const salaryJune25 = makeTx('2026-06-25', salaryCategoryId);
      const salaryJune26 = makeTx('2026-06-26', salaryCategoryId);

      const result = await adjustForSalaryEarlyPayment(
        [salaryJune25, salaryJune26], mockUserId, 2026, 6
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(salaryJune25);
    });

    it('should query early salary with correct date range', async () => {
      Category.findOne.mockResolvedValue({ _id: salaryCategoryId, name: 'Salary', type: 'Income' });
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      });

      await adjustForSalaryEarlyPayment([], mockUserId, 2026, 6);

      // For June (month=6): early window = May 27 to May 31
      const findCall = Transaction.find.mock.calls[0][0];
      expect(findCall.userId).toEqual(mockUserId);
      expect(findCall.category).toEqual(salaryCategoryId);

      const queryStart = findCall.processedDate.$gte;
      const queryEnd = findCall.processedDate.$lte;
      expect(queryStart.getFullYear()).toBe(2026);
      expect(queryStart.getMonth()).toBe(4); // May = 4
      expect(queryStart.getDate()).toBe(27);
      expect(queryEnd.getMonth()).toBe(4); // May = 4
      expect(queryEnd.getDate()).toBe(31);
    });

    it('should pass extra filters to early salary query', async () => {
      Category.findOne.mockResolvedValue({ _id: salaryCategoryId, name: 'Salary', type: 'Income' });
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      });

      const extraFilters = { excludeFromBudgetCalculation: { $ne: true } };
      await adjustForSalaryEarlyPayment([], mockUserId, 2026, 6, extraFilters);

      const findCall = Transaction.find.mock.calls[0][0];
      expect(findCall.excludeFromBudgetCalculation).toEqual({ $ne: true });
    });

    it('should handle January correctly (early window in previous year December)', async () => {
      Category.findOne.mockResolvedValue({ _id: salaryCategoryId, name: 'Salary', type: 'Income' });
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      });

      await adjustForSalaryEarlyPayment([], mockUserId, 2026, 1);

      const findCall = Transaction.find.mock.calls[0][0];
      const queryStart = findCall.processedDate.$gte;
      const queryEnd = findCall.processedDate.$lte;
      // January early window = December 27-31 of previous year
      expect(queryStart.getFullYear()).toBe(2025);
      expect(queryStart.getMonth()).toBe(11); // December = 11
      expect(queryStart.getDate()).toBe(27);
      expect(queryEnd.getFullYear()).toBe(2025);
      expect(queryEnd.getMonth()).toBe(11);
      expect(queryEnd.getDate()).toBe(31);
    });

    it('should handle February correctly (late window in short month)', async () => {
      Category.findOne.mockResolvedValue({ _id: salaryCategoryId, name: 'Salary', type: 'Income' });
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue([])
        })
      });

      // February 2026 has 28 days, March 1 - 5 = Feb 24
      const salaryFeb23 = makeTx('2026-02-23', salaryCategoryId);
      const salaryFeb24 = makeTx('2026-02-24', salaryCategoryId);

      const result = await adjustForSalaryEarlyPayment(
        [salaryFeb23, salaryFeb24], mockUserId, 2026, 2
      );

      // lateWindowStart = March 1 - 5 days = Feb 24
      // Feb 23 < Feb 24 → kept
      // Feb 24 >= Feb 24 → excluded
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(salaryFeb23);
    });
  });
});
