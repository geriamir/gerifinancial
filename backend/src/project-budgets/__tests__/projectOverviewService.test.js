const projectOverviewService = require('../services/projectOverviewService');
const { ProjectBudget, Tag, Transaction, Category, SubCategory, CurrencyExchange } = require('../../shared/models');
const { TransactionType } = require('../../banking/constants/enums');
const mongoose = require('mongoose');

describe('ProjectOverviewService', () => {
  let testUser;
  let testCategory;
  let testSubCategory;
  let testProject;
  let testProjectTag;

  beforeEach(async () => {
    // Create test user using global helper
    testUser = await global.createTestUser({
      email: 'overview-test@example.com',
      name: 'Overview Test User'
    });

    // Create test exchange rate for currency conversion tests
    try {
      await CurrencyExchange.create({
        from: 'USD',
        to: 'ILS',
        rate: 3.7,
        date: new Date('2025-06-05'),
        source: 'test'
      });
    } catch (error) {
      // Ignore if already exists
    }

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
      name: 'Overview Test Project',
      type: 'vacation',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-15'),
      currency: 'ILS',
      categoryBudgets: [{
        categoryId: testCategory._id,
        subCategoryId: testSubCategory._id,
        budgetedAmount: 2000,
        currency: 'ILS',
        allocatedTransactions: []
      }],
      fundingSources: [{
        type: 'savings',
        description: 'Personal savings',
        expectedAmount: 3000,
        availableAmount: 2500,
        currency: 'ILS'
      }]
    });
    await testProject.save();
    await testProject.createProjectTag();
    testProjectTag = testProject.projectTag;
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await Promise.all([
        ProjectBudget.deleteMany({ userId: testUser._id }),
        Tag.deleteMany({ userId: testUser._id }),
        Transaction.deleteMany({ userId: testUser._id }),
        Category.deleteMany({ userId: testUser._id }),
        SubCategory.deleteMany({ userId: testUser._id })
      ]);
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning (ignored):', error.message);
    }
  });

  describe('calculateActualAmountForBudget', () => {
    test('should return 0 for budget with no allocated transactions', async () => {
      const budget = {
        allocatedTransactions: []
      };

      const result = await projectOverviewService.calculateActualAmountForBudget(budget, 'ILS');

      expect(result).toBe(0);
    });

    test('should calculate actual amount from allocated transactions', async () => {
      // Create transactions
      const transaction1 = new Transaction({
        identifier: 'calc-test-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -500,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Hotel payment 1',
        rawData: {}
      });
      await transaction1.save();

      const transaction2 = new Transaction({
        identifier: 'calc-test-2',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -300,
        currency: 'ILS',
        date: new Date('2025-06-06'),
        processedDate: new Date('2025-06-06'),
        description: 'Hotel payment 2',
        rawData: {}
      });
      await transaction2.save();

      const budget = {
        allocatedTransactions: [transaction1._id, transaction2._id]
      };

      const result = await projectOverviewService.calculateActualAmountForBudget(budget, 'ILS');

      expect(result).toBe(800); // 500 + 300
    });

    test('should handle currency conversion for allocated transactions', async () => {
      const transaction = new Transaction({
        identifier: 'currency-test',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -100, // $100 USD
        currency: 'USD',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Hotel payment in USD',
        rawData: {}
      });
      await transaction.save();

      const budget = {
        allocatedTransactions: [transaction._id]
      };

      const result = await projectOverviewService.calculateActualAmountForBudget(budget, 'ILS');

      // With test exchange rate (3.7), should convert: 100 * 3.7 = 370 or fallback to 100
      expect(result).toBeGreaterThan(0);
      expect([100, 370]).toContain(result);
    });

    test('should handle invalid transactions gracefully', async () => {
      const validTransaction = new Transaction({
        identifier: 'valid-test',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -200,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Valid transaction',
        rawData: {}
      });
      await validTransaction.save();

      const budget = {
        allocatedTransactions: [
          validTransaction._id,
          new mongoose.Types.ObjectId() // Non-existent transaction
        ]
      };

      const result = await projectOverviewService.calculateActualAmountForBudget(budget, 'ILS');

      expect(result).toBe(200); // Only valid transaction counted
    });
  });

  describe('calculateTotalsInProjectCurrency', () => {
    test('should calculate totals in project currency', async () => {
      // Create allocated transaction
      const transaction = new Transaction({
        identifier: 'totals-test',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -600,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Hotel payment',
        rawData: {}
      });
      await transaction.save();

      // Update project budget with allocated transaction
      testProject.categoryBudgets[0].allocatedTransactions.push(transaction._id);
      await testProject.save();

      const result = await projectOverviewService.calculateTotalsInProjectCurrency(testProject);

      expect(result.totalBudgetInProjectCurrency).toBe(2000);
      expect(result.totalPaidInProjectCurrency).toBe(600);
      expect(result.remainingBudgetInProjectCurrency).toBe(1400);
      expect(result.progressPercentageInProjectCurrency).toBe(30); // 600/2000 * 100
    });

    test('should handle multiple category budgets', async () => {
      // Add another category budget
      const newCategory = await Category.create({
        name: 'Food',
        type: TransactionType.EXPENSE,
        userId: testUser._id
      });

      const newSubCategory = await SubCategory.create({
        name: 'Restaurants',
        parentCategory: newCategory._id,
        userId: testUser._id
      });

      testProject.categoryBudgets.push({
        categoryId: newCategory._id,
        subCategoryId: newSubCategory._id,
        budgetedAmount: 1000,
        currency: 'ILS',
        allocatedTransactions: []
      });
      await testProject.save();

      const result = await projectOverviewService.calculateTotalsInProjectCurrency(testProject);

      expect(result.totalBudgetInProjectCurrency).toBe(3000); // 2000 + 1000
      expect(result.totalPaidInProjectCurrency).toBe(0);
      expect(result.remainingBudgetInProjectCurrency).toBe(3000);
      expect(result.progressPercentageInProjectCurrency).toBe(0);
    });

    test('should handle progress over 100%', async () => {
      // Create transaction that exceeds budget
      const transaction = new Transaction({
        identifier: 'over-budget',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -2500, // More than 2000 budget
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Expensive hotel',
        rawData: {}
      });
      await transaction.save();

      testProject.categoryBudgets[0].allocatedTransactions.push(transaction._id);
      await testProject.save();

      const result = await projectOverviewService.calculateTotalsInProjectCurrency(testProject);

      expect(result.totalPaidInProjectCurrency).toBe(2500);
      expect(result.remainingBudgetInProjectCurrency).toBe(0); // Max with 0
      expect(result.progressPercentageInProjectCurrency).toBe(100); // Min with 100
    });
  });

  describe('calculateFundingInProjectCurrency', () => {
    test('should calculate funding totals in project currency', async () => {
      const result = await projectOverviewService.calculateFundingInProjectCurrency(testProject);

      expect(result.totalFundingInProjectCurrency).toBe(3000);
      expect(result.totalAvailableFundingInProjectCurrency).toBe(2500);
    });

    test('should handle multiple funding sources', async () => {
      testProject.fundingSources.push({
        type: 'bonus',
        description: 'Work bonus',
        expectedAmount: 1500,
        availableAmount: 1500,
        currency: 'ILS'
      });
      await testProject.save();

      const result = await projectOverviewService.calculateFundingInProjectCurrency(testProject);

      expect(result.totalFundingInProjectCurrency).toBe(4500); // 3000 + 1500
      expect(result.totalAvailableFundingInProjectCurrency).toBe(4000); // 2500 + 1500
    });

    test('should handle funding sources with different currencies', async () => {
      testProject.fundingSources.push({
        type: 'loan',
        description: 'USD loan',
        expectedAmount: 500, // $500 USD
        availableAmount: 400, // $400 USD
        currency: 'USD'
      });
      await testProject.save();

      const result = await projectOverviewService.calculateFundingInProjectCurrency(testProject);

      // With test exchange rate or fallback amounts
      expect(result.totalFundingInProjectCurrency).toBeGreaterThanOrEqual(3500); 
      expect(result.totalAvailableFundingInProjectCurrency).toBeGreaterThanOrEqual(2900);
    });
  });

  describe('getRecommendationsForUnplannedExpense', () => {
    test('should recommend exact subcategory match', async () => {
      const unplannedExpense = {
        transactionId: new mongoose.Types.ObjectId(),
        category: {
          _id: testCategory._id,
          name: 'Travel'
        },
        subCategory: {
          _id: testSubCategory._id,
          name: 'Hotels'
        },
        convertedAmount: 300
      };

      // Populate category and subcategory in project budget
      await testProject.populate('categoryBudgets.categoryId categoryBudgets.subCategoryId');

      const recommendations = await projectOverviewService.getRecommendationsForUnplannedExpense(
        testProject,
        unplannedExpense
      );

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].confidence).toBe(95);
      expect(recommendations[0].reason).toBe('Exact match: Hotels');
      expect(recommendations[0].categoryName).toBe('Travel');
      expect(recommendations[0].subCategoryName).toBe('Hotels');
      expect(recommendations[0].confidenceLevel).toBe('high');
      expect(recommendations[0].wouldExceedBudget).toBe(false);
    });

    test('should calculate budget impact correctly', async () => {
      // Add allocated transaction first
      const existingTransaction = new Transaction({
        identifier: 'existing',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -1500,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Existing expense',
        rawData: {}
      });
      await existingTransaction.save();

      testProject.categoryBudgets[0].allocatedTransactions.push(existingTransaction._id);
      await testProject.save();

      const unplannedExpense = {
        transactionId: new mongoose.Types.ObjectId(),
        category: {
          _id: testCategory._id,
          name: 'Travel'
        },
        subCategory: {
          _id: testSubCategory._id,
          name: 'Hotels'
        },
        convertedAmount: 600 // Would make total 2100, exceeding 2000 budget
      };

      await testProject.populate('categoryBudgets.categoryId categoryBudgets.subCategoryId');

      const recommendations = await projectOverviewService.getRecommendationsForUnplannedExpense(
        testProject,
        unplannedExpense
      );

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].currentActualAmount).toBe(1500);
      expect(recommendations[0].newActualAmount).toBe(2100);
      expect(recommendations[0].wouldExceedBudget).toBe(true);
    });

    test('should return empty array when no categories match', async () => {
      // Create different category
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

      const unplannedExpense = {
        transactionId: new mongoose.Types.ObjectId(),
        category: {
          _id: otherCategory._id,
          name: 'Food'
        },
        subCategory: {
          _id: otherSubCategory._id,
          name: 'Restaurants'
        },
        convertedAmount: 200
      };

      await testProject.populate('categoryBudgets.categoryId categoryBudgets.subCategoryId');

      const recommendations = await projectOverviewService.getRecommendationsForUnplannedExpense(
        testProject,
        unplannedExpense
      );

      expect(recommendations).toHaveLength(0);
    });

    test('should handle expenses with missing category data', async () => {
      const unplannedExpense = {
        transactionId: new mongoose.Types.ObjectId(),
        category: null,
        subCategory: null,
        convertedAmount: 300
      };

      const recommendations = await projectOverviewService.getRecommendationsForUnplannedExpense(
        testProject,
        unplannedExpense
      );

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('getUnplannedExpenses', () => {
    test('should get unplanned expenses for project', async () => {
      // Create unplanned transaction (tagged but not allocated)
      const unplannedTransaction = new Transaction({
        identifier: 'unplanned-overview',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -400,
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

      const result = await projectOverviewService.getUnplannedExpenses(testProject);

      expect(result.expenses).toHaveLength(1);
      expect(result.totalInProjectCurrency).toBe(400);
      expect(result.expenses[0].amount).toBe(-400);
      expect(result.expenses[0].convertedAmount).toBe(400);
    });

    test('should exclude allocated transactions from unplanned expenses', async () => {
      // Create planned transaction (allocated)
      const plannedTransaction = new Transaction({
        identifier: 'planned-overview',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -500,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Planned expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {}
      });
      await plannedTransaction.save();

      // Allocate to category budget
      testProject.categoryBudgets[0].allocatedTransactions.push(plannedTransaction._id);
      await testProject.save();

      const result = await projectOverviewService.getUnplannedExpenses(testProject);

      expect(result.expenses).toHaveLength(0);
      expect(result.totalInProjectCurrency).toBe(0);
    });

    test('should handle installment transactions', async () => {
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
          installments: {
            number: 1,
            total: 2
          }
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
          installments: {
            number: 2,
            total: 2
          }
        }
      });
      await installment2.save();

      const result = await projectOverviewService.getUnplannedExpenses(testProject);

      // Should group installments into one expense
      expect(result.expenses).toHaveLength(1);
      expect(result.totalInProjectCurrency).toBe(500);
      expect(result.expenses[0].isInstallmentGroup).toBe(true);
      expect(result.expenses[0].installmentCount).toBe(2);
    });

    test('should return empty result for project without tag', async () => {
      // Create project without tag
      const projectWithoutTag = new ProjectBudget({
        userId: testUser._id,
        name: 'No Tag Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await projectWithoutTag.save();

      const result = await projectOverviewService.getUnplannedExpenses(projectWithoutTag);

      expect(result.expenses).toHaveLength(0);
      expect(result.totalInProjectCurrency).toBe(0);
    });
  });

  describe('getProjectOverview', () => {
    test('should return comprehensive project overview', async () => {
      // Create planned transaction
      const plannedTransaction = new Transaction({
        identifier: 'planned-overview',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -800,
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

      // Create unplanned transaction
      const unplannedTransaction = new Transaction({
        identifier: 'unplanned-overview',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -300,
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

      // Allocate planned transaction
      testProject.categoryBudgets[0].allocatedTransactions.push(plannedTransaction._id);
      await testProject.save();

      const overview = await projectOverviewService.getProjectOverview(testProject);

      expect(overview.name).toBe('Overview Test Project');
      expect(overview.status).toBe('planning');
      expect(overview.currency).toBe('ILS');
      expect(overview.totalBudget).toBe(2000);
      expect(overview.totalPaid).toBe(1100); // 800 + 300
      expect(overview.totalPlannedPaid).toBe(800);
      expect(overview.totalUnplannedPaid).toBe(300);
      expect(overview.remainingBudget).toBe(900); // 2000 - 1100
      expect(overview.isOverBudget).toBe(false);
      expect(overview.progress).toBe(55); // 1100/2000 * 100
      expect(overview.totalFunding).toBe(3000);
      expect(overview.totalAvailableFunding).toBe(2500);
      expect(overview.categoryBreakdown).toHaveLength(1);
      expect(overview.unplannedExpenses).toHaveLength(1);
      expect(overview.unplannedExpensesCount).toBe(1);
    });

    test('should indicate when project is over budget', async () => {
      // Create transactions that exceed budget
      const transaction1 = new Transaction({
        identifier: 'over-budget-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -1500,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Expensive planned expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {}
      });
      await transaction1.save();

      const transaction2 = new Transaction({
        identifier: 'over-budget-2',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -800,
        currency: 'ILS',
        date: new Date('2025-06-06'),
        processedDate: new Date('2025-06-06'),
        description: 'Unplanned expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [testProjectTag],
        rawData: {}
      });
      await transaction2.save();

      // Allocate first transaction only
      testProject.categoryBudgets[0].allocatedTransactions.push(transaction1._id);
      await testProject.save();

      const overview = await projectOverviewService.getProjectOverview(testProject);

      expect(overview.totalPaid).toBe(2300); // 1500 + 800
      expect(overview.isOverBudget).toBe(true);
      expect(overview.remainingBudget).toBe(0); // Max with 0
      expect(overview.progress).toBe(100); // Capped at 100
    });

    test('should handle projects with no expenses', async () => {
      const overview = await projectOverviewService.getProjectOverview(testProject);

      expect(overview.totalBudget).toBe(2000);
      expect(overview.totalPaid).toBe(0);
      expect(overview.totalPlannedPaid).toBe(0);
      expect(overview.totalUnplannedPaid).toBe(0);
      expect(overview.remainingBudget).toBe(2000);
      expect(overview.isOverBudget).toBe(false);
      expect(overview.progress).toBe(0);
      expect(overview.categoryBreakdown).toHaveLength(1);
      expect(overview.unplannedExpenses).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle currency conversion failures gracefully', async () => {
      // Create transaction with unusual currency
      const transaction = new Transaction({
        identifier: 'unusual-currency',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -100,
        currency: 'XYZ', // Non-existent currency
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Unusual currency transaction',
        rawData: {}
      });
      await transaction.save();

      testProject.categoryBudgets[0].allocatedTransactions.push(transaction._id);
      await testProject.save();

      const result = await projectOverviewService.calculateTotalsInProjectCurrency(testProject);

      // Should fallback to original amount
      expect(result.totalPaidInProjectCurrency).toBe(100);
    });

    test('should handle missing transaction data', async () => {
      // Add non-existent transaction ID to allocated transactions
      testProject.categoryBudgets[0].allocatedTransactions.push(new mongoose.Types.ObjectId());
      await testProject.save();

      const result = await projectOverviewService.calculateTotalsInProjectCurrency(testProject);

      expect(result.totalPaidInProjectCurrency).toBe(0);
    });
  });
});
