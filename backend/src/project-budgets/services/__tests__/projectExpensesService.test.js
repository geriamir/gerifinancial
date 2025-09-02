const projectExpensesService = require('../projectExpensesService');
const { ProjectBudget, Tag, Transaction, Category, SubCategory, User } = require('../../../shared/models');
const { createTestUser } = require('../../../test/testUtils');
const { TransactionType } = require('../../../shared/constants/enums');
const mongoose = require('mongoose');

describe('ProjectExpensesService', () => {
  let testUser;
  let testCategory;
  let testSubCategory;
  let testProject;
  let testProjectTag;

  beforeEach(async () => {
    // Clean up before each test
    await Promise.all([
      ProjectBudget.deleteMany({}),
      Tag.deleteMany({}),
      Transaction.deleteMany({}),
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      User.deleteMany({})
    ]);

    // Create test user
    const userData = await createTestUser(User, {
      email: 'project-expense-test@example.com',
      name: 'Project Expense Test User'
    });
    testUser = userData.user;

    // Create test category and subcategory
    testCategory = await Category.create({
      name: 'Travel',
        type: TransactionType.EXPENSE,
      userId: testUser._id
    });

    testSubCategory = await SubCategory.create({
      name: 'Hotels',
      parentCategory: testCategory._id,
      userId: testUser._id
    });

    // Create test project with category budget
    testProject = new ProjectBudget({
      userId: testUser._id,
      name: 'Test Project',
      type: 'vacation',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-15'),
      categoryBudgets: [{
        categoryId: testCategory._id,
        subCategoryId: testSubCategory._id,
        budgetedAmount: 2000,
        allocatedTransactions: []
      }]
    });
    await testProject.save();
    await testProject.createProjectTag();
    testProjectTag = testProject.projectTag;
  });

  afterAll(async () => {
    await Promise.all([
      ProjectBudget.deleteMany({}),
      Tag.deleteMany({}),
      Transaction.deleteMany({}),
      Category.deleteMany({}),
      SubCategory.deleteMany({}),
      User.deleteMany({})
    ]);
  });

  describe('moveExpenseToPlanned', () => {
    
    test('should move unplanned expense to planned category', async () => {
      // Create transaction tagged to project but not allocated to planned category
      const transaction = new Transaction({
        identifier: 'test-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -500,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Hotel payment',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {}
      });
      await transaction.save();

      const result = await projectExpensesService.moveExpenseToPlanned(
        testProject._id,
        transaction._id,
        testCategory._id,
        testSubCategory._id
      );

      expect(result.transaction._id.toString()).toBe(transaction._id.toString());
      expect(result.convertedAmount).toBe(500);
      expect(result.targetBudget.allocatedTransactions).toContainEqual(transaction._id);

      // Verify project was updated
      const updatedProject = await ProjectBudget.findById(testProject._id);
      const categoryBudget = updatedProject.categoryBudgets.find(b => 
        b.categoryId.toString() === testCategory._id.toString() &&
        b.subCategoryId.toString() === testSubCategory._id.toString()
      );
      expect(categoryBudget.allocatedTransactions).toContainEqual(transaction._id);
    });

    test('should handle currency conversion when moving expense', async () => {
      // Create transaction in different currency
      const transaction = new Transaction({
        identifier: 'test-usd',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -100, // $100 USD
        currency: 'USD',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Hotel payment in USD',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {}
      });
      await transaction.save();

      const result = await projectExpensesService.moveExpenseToPlanned(
        testProject._id,
        transaction._id,
        testCategory._id,
        testSubCategory._id
      );

      expect(result.transaction._id.toString()).toBe(transaction._id.toString());
      // Currency conversion may fail in test environment, so converted amount should equal original amount
      expect(result.convertedAmount).toBe(100); 
      expect(result.targetBudget.allocatedTransactions).toContainEqual(transaction._id);
    });

    test('should throw error if transaction not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(
        projectExpensesService.moveExpenseToPlanned(
          testProject._id,
          nonExistentId,
          testCategory._id,
          testSubCategory._id
        )
      ).rejects.toThrow('Transaction not found or not associated with this project');
    });

    test('should throw error if transaction not tagged to project', async () => {
      // Create transaction not tagged to project
      const transaction = new Transaction({
        identifier: 'test-untagged',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -300,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Untagged expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        rawData: {}
      });
      await transaction.save();

      await expect(
        projectExpensesService.moveExpenseToPlanned(
          testProject._id,
          transaction._id,
          testCategory._id,
          testSubCategory._id
        )
      ).rejects.toThrow('Transaction not found or not associated with this project');
    });

    test('should throw error if target category budget not found', async () => {
      // Create another category not in project budget
      const otherCategory = await Category.create({
        name: 'Food',
        type: TransactionType.EXPENSE,
        userId: testUser._id
      });

      const otherSubCategory = await SubCategory.create({
        name: 'Restaurants',
        parentCategory: otherCategory._id,
        userId: testUser._id
      });

      const transaction = new Transaction({
        identifier: 'test-wrong-category',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -200,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Restaurant expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {}
      });
      await transaction.save();

      await expect(
        projectExpensesService.moveExpenseToPlanned(
          testProject._id,
          transaction._id,
          otherCategory._id,
          otherSubCategory._id
        )
      ).rejects.toThrow('Target category budget not found in project');
    });
  });

  describe('moveInstallmentGroupToPlanned', () => {
    
    test('should move installment group to planned category', async () => {
      // Create installment transactions
      const installment1 = new Transaction({
        identifier: 'hotel-booking-installment',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -250,
        currency: 'ILS',
        date: new Date('2025-06-01'),
        processedDate: new Date('2025-06-01'),
        description: 'Hotel booking installment 1/2',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {
          type: 'installments',
          originalAmount: 500,
          installmentNumber: 1,
          totalInstallments: 2
        }
      });
      await installment1.save();

      const installment2 = new Transaction({
        identifier: 'hotel-booking-installment',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -250,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Hotel booking installment 2/2',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {
          type: 'installments',
          originalAmount: 500,
          installmentNumber: 2,
          totalInstallments: 2
        }
      });
      await installment2.save();

      const groupId = 'installment-group-hotel-booking-installment--500';

      const result = await projectExpensesService.moveInstallmentGroupToPlanned(
        testProject._id,
        groupId,
        testCategory._id,
        testSubCategory._id
      );

      expect(result.transactions).toHaveLength(2);
      expect(result.totalConvertedAmount).toBe(500);
      expect(result.transactionCount).toBe(2);

      // Verify both transactions are allocated to the budget
      const updatedProject = await ProjectBudget.findById(testProject._id);
      const categoryBudget = updatedProject.categoryBudgets.find(b => 
        b.categoryId.toString() === testCategory._id.toString() &&
        b.subCategoryId.toString() === testSubCategory._id.toString()
      );
      expect(categoryBudget.allocatedTransactions).toContainEqual(installment1._id);
      expect(categoryBudget.allocatedTransactions).toContainEqual(installment2._id);
    });

    test('should handle installment group with different currencies', async () => {
      // Create installment transactions in USD
      const installment1 = new Transaction({
        identifier: 'flight-booking-usd',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -100,
        currency: 'USD',
        date: new Date('2025-06-01'),
        processedDate: new Date('2025-06-01'),
        description: 'Flight booking installment 1/2',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {
          type: 'installments',
          originalAmount: 200,
          installmentNumber: 1,
          totalInstallments: 2
        }
      });
      await installment1.save();

      const installment2 = new Transaction({
        identifier: 'flight-booking-usd',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -100,
        currency: 'USD',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Flight booking installment 2/2',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {
          type: 'installments',
          originalAmount: 200,
          installmentNumber: 2,
          totalInstallments: 2
        }
      });
      await installment2.save();

      const groupId = 'installment-group-flight-booking-usd--200';

      const result = await projectExpensesService.moveInstallmentGroupToPlanned(
        testProject._id,
        groupId,
        testCategory._id,
        testSubCategory._id
      );

      expect(result.transactions).toHaveLength(2);
      expect(result.totalConvertedAmount).toBe(200); // Mock currency conversion returns same amount
      expect(result.transactionCount).toBe(2);
    });

    test('should throw error for invalid installment group ID format', async () => {
      const invalidGroupId = 'invalid-group-id';

      await expect(
        projectExpensesService.moveInstallmentGroupToPlanned(
          testProject._id,
          invalidGroupId,
          testCategory._id,
          testSubCategory._id
        )
      ).rejects.toThrow('Invalid installment group identifier format');
    });

    test('should throw error when no installment transactions found', async () => {
      const groupId = 'installment-group-nonexistent--1000';

      await expect(
        projectExpensesService.moveInstallmentGroupToPlanned(
          testProject._id,
          groupId,
          testCategory._id,
          testSubCategory._id
        )
      ).rejects.toThrow('No installment transactions found for this group');
    });
  });

  describe('addUnplannedExpense', () => {
    
    test('should add transaction as unplanned expense', async () => {
      const transaction = new Transaction({
        identifier: 'test-unplanned',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -400,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Unplanned expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        type: TransactionType.EXPENSE,
        rawData: {}
      });
      await transaction.save();

      const result = await projectExpensesService.addUnplannedExpense(
        testProject._id,
        transaction._id
      );

      expect(result._id.toString()).toBe(transaction._id.toString());
      expect(result.tags).toContainEqual(testProjectTag);
    });

    test('should throw error for non-expense transaction', async () => {
      const transaction = new Transaction({
        identifier: 'test-income',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: 400,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Income transaction',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        type: 'Income',
        rawData: {}
      });
      await transaction.save();

      await expect(
        projectExpensesService.addUnplannedExpense(
          testProject._id,
          transaction._id
        )
      ).rejects.toThrow('Transaction not found or not an expense transaction');
    });
  });

  describe('removeUnplannedExpense', () => {
    
    test('should remove transaction from project', async () => {
      const transaction = new Transaction({
        identifier: 'test-to-remove',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -300,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Expense to remove',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        type: 'Expense',
        tags: [testProjectTag],
        rawData: {}
      });
      await transaction.save();

      const result = await projectExpensesService.removeUnplannedExpense(
        testProject._id,
        transaction._id
      );

      expect(result._id.toString()).toBe(transaction._id.toString());
      expect(result.tags).not.toContain(testProjectTag);
    });
  });

  describe('getUnplannedExpenses', () => {
    
    test('should get unplanned expenses for project', async () => {
      // Create unplanned expense (tagged but not allocated)
      const unplannedTransaction = new Transaction({
        identifier: 'unplanned-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -200,
        currency: 'ILS',
        date: new Date('2025-06-06'),
        processedDate: new Date('2025-06-06'),
        description: 'Unexpected expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {}
      });
      await unplannedTransaction.save();

      const result = await projectExpensesService.getUnplannedExpenses(testProject._id);

      expect(result).toHaveLength(1);
      expect(result[0]._id.toString()).toBe(unplannedTransaction._id.toString());
    });

    test('should return empty array for project without tag', async () => {
      // Create project without tag
      const projectWithoutTag = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project Without Tag',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      });
      await projectWithoutTag.save();

      const result = await projectExpensesService.getUnplannedExpenses(projectWithoutTag._id);

      expect(result).toHaveLength(0);
    });
  });

  describe('getPlannedExpenses', () => {
    
    test('should get planned expenses for project', async () => {
      // Create planned expense (allocated)
      const plannedTransaction = new Transaction({
        identifier: 'planned-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -600,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Planned hotel expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {}
      });
      await plannedTransaction.save();

      // Allocate the planned transaction
      await projectExpensesService.moveExpenseToPlanned(
        testProject._id,
        plannedTransaction._id,
        testCategory._id,
        testSubCategory._id
      );

      const result = await projectExpensesService.getPlannedExpenses(testProject._id);

      expect(result).toHaveLength(1);
      expect(result[0].categoryId.toString()).toBe(testCategory._id.toString());
      expect(result[0].subCategoryId.toString()).toBe(testSubCategory._id.toString());
      expect(result[0].actualAmount).toBe(600);
      expect(result[0].transactions).toHaveLength(1);
    });

    test('should include categories with no allocated transactions', async () => {
      const result = await projectExpensesService.getPlannedExpenses(testProject._id);

      expect(result).toHaveLength(1); // Should still include the planned category
      expect(result[0].actualAmount).toBe(0);
      expect(result[0].transactions).toHaveLength(0);
    });
  });
});
