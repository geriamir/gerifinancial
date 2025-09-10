const request = require('supertest');
const mongoose = require('mongoose');
const { createTestUser } = require('../../../test/testUtils');
const app = require('../../../app');
const { User } = require('../../../auth');
const { Category, TransactionType, SubCategory, Transaction, Tag } = require('../../../banking');
const { ProjectBudget } = require('../../models');

let testUser;
let authToken;
let testCategory;
let testSubCategory;

beforeEach(async () => {
  // Create test user using testUtils
  const testData = await createTestUser(User, {
    email: 'project-budget-test@example.com',
    name: 'Project Budget Test User'
  });
  testUser = testData.user;
  authToken = testData.token;
  
  // Create test category and subcategory
  testCategory = new Category({
    name: 'Travel',
    type: TransactionType.EXPENSE,
    userId: testUser._id
  });
  await testCategory.save();
  
  testSubCategory = new SubCategory({
    name: 'Hotels',
    parentCategory: testCategory._id,
    userId: testUser._id
  });
  await testSubCategory.save();
});

afterAll(async () => {
  // Clean up test data
  try {
    if (testUser) {
      await ProjectBudget.deleteMany({ userId: testUser._id });
      await Tag.deleteMany({ userId: testUser._id });
      await Transaction.deleteMany({ userId: testUser._id });
      await SubCategory.deleteOne({ _id: testSubCategory._id });
      await Category.deleteOne({ _id: testCategory._id });
      await User.deleteOne({ _id: testUser._id });
    }
  } catch (error) {
    console.log('Cleanup error (ignored):', error.message);
  }
});

describe('Project Budget API Endpoints', () => {
  
  describe('Project Expense Management', () => {
    
    test('POST /api/budgets/projects/:id/expenses/tag - should tag transaction to project', async () => {
      // Create project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Expense Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 2000
        }]
      });
      await project.save();
      await project.createProjectTag();

      // Create transaction
      const transaction = new Transaction({
        identifier: 'test-expense-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -500,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Hotel payment',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        rawData: {}
      });
      await transaction.save();

      const response = await request(app)
        .post(`/api/budgets/projects/${project._id}/expenses/tag`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactionId: transaction._id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId.toString()).toBe(transaction._id.toString());
      expect(response.body.data.projectId.toString()).toBe(project._id.toString());

      // Verify transaction was tagged
      const updatedTransaction = await Transaction.findById(transaction._id);
      expect(updatedTransaction.tags).toContainEqual(project.projectTag);
    });

    test('POST /api/budgets/projects/:id/expenses/bulk-tag - should tag multiple transactions', async () => {
      // Create project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Bulk Tag Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();
      await project.createProjectTag();

      // Create multiple transactions
      const transaction1 = new Transaction({
        identifier: 'bulk-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -300,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Expense 1',
        rawData: {}
      });
      await transaction1.save();

      const transaction2 = new Transaction({
        identifier: 'bulk-2',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -400,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-06'),
        processedDate: new Date('2025-06-06'),
        description: 'Expense 2',
        rawData: {}
      });
      await transaction2.save();

      const response = await request(app)
        .post(`/api/budgets/projects/${project._id}/expenses/bulk-tag`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactionIds: [transaction1._id, transaction2._id] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.successfulTags).toBe(2);
      expect(response.body.data.totalRequested).toBe(2);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.errors).toHaveLength(0);
    });

    test('DELETE /api/budgets/projects/:id/expenses/:transactionId - should remove transaction from project', async () => {
      // Create project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Remove Expense Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();
      await project.createProjectTag();

      // Create and tag transaction
      const transaction = new Transaction({
        identifier: 'remove-test',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -200,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Expense to remove',
        tags: [project.projectTag],
        rawData: {}
      });
      await transaction.save();

      const response = await request(app)
        .delete(`/api/budgets/projects/${project._id}/expenses/${transaction._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId.toString()).toBe(transaction._id.toString());

      // Verify transaction was untagged
      const updatedTransaction = await Transaction.findById(transaction._id);
      expect(updatedTransaction.tags).not.toContain(project.projectTag);
    });

    test('PUT /api/budgets/projects/:id/expenses/:transactionId/move - should move expense to planned category', async () => {
      // Create project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Move Expense Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 1000
        }]
      });
      await project.save();
      await project.createProjectTag();

      // Create and tag transaction
      const transaction = new Transaction({
        identifier: 'move-test',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -400,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Expense to move',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [project.projectTag],
        rawData: {}
      });
      await transaction.save();

      const response = await request(app)
        .put(`/api/budgets/projects/${project._id}/expenses/${transaction._id}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionId.toString()).toBe(transaction._id.toString());
      expect(response.body.data.convertedAmount).toBe(400);
      expect(response.body.data.targetCategory.categoryId.toString()).toBe(testCategory._id.toString());
    });

    test('PUT /api/budgets/projects/:id/expenses/:transactionId/move - should handle installment groups', async () => {
      // Create project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Installment Move Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 2000
        }]
      });
      await project.save();
      await project.createProjectTag();

      // Create installment transactions
      const installment1 = new Transaction({
        identifier: 'hotel-installment',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -250,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-01'),
        processedDate: new Date('2025-06-01'),
        description: 'Hotel installment 1/2',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [project.projectTag],
        rawData: {
          type: 'installments',
          originalAmount: 500,
          installmentNumber: 1,
          totalInstallments: 2
        }
      });
      await installment1.save();

      const installment2 = new Transaction({
        identifier: 'hotel-installment',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -250,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Hotel installment 2/2',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [project.projectTag],
        rawData: {
          type: 'installments',
          originalAmount: 500,
          installmentNumber: 2,
          totalInstallments: 2
        }
      });
      await installment2.save();

      const groupId = 'installment-group-hotel-installment--500';

      const response = await request(app)
        .put(`/api/budgets/projects/${project._id}/expenses/${groupId}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groupId).toBe(groupId);
      expect(response.body.data.installmentCount).toBe(2);
      expect(response.body.data.totalConvertedAmount).toBe(500);
      expect(response.body.data.installmentResults).toHaveLength(2);
    });

    test('GET /api/budgets/projects/:id/expenses/breakdown - should get comprehensive expense breakdown', async () => {
      // Create project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Breakdown Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 1500
        }]
      });
      await project.save();
      await project.createProjectTag();

      // Create planned expense (allocated)
      const plannedTransaction = new Transaction({
        identifier: 'planned-expense',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -600,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Planned hotel expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [project.projectTag],
        rawData: {}
      });
      await plannedTransaction.save();

      // Create unplanned expense
      const unplannedTransaction = new Transaction({
        identifier: 'unplanned-expense',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -200,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-06'),
        processedDate: new Date('2025-06-06'),
        description: 'Unexpected expense',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [project.projectTag],
        rawData: {}
      });
      await unplannedTransaction.save();

      // Allocate planned transaction to category budget
      const updatedProject = await ProjectBudget.findById(project._id);
      updatedProject.categoryBudgets[0].allocatedTransactions.push(plannedTransaction._id);
      await updatedProject.save();

      const response = await request(app)
        .get(`/api/budgets/projects/${project._id}/expenses/breakdown`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.projectId.toString()).toBe(project._id.toString());
      expect(response.body.data.totalBudget).toBe(1500);
      expect(response.body.data.totalPaid).toBe(800); // 600 + 200
      expect(response.body.data.totalPlannedPaid).toBe(600);
      expect(response.body.data.totalUnplannedPaid).toBe(200);
      expect(response.body.data.plannedCategories).toHaveLength(1);
      expect(response.body.data.unplannedExpenses).toHaveLength(1);
    });

    test('POST /api/budgets/projects/:id/expenses/bulk-move - should move multiple expenses to planned category', async () => {
      // Create project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Bulk Move Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 2000
        }]
      });
      await project.save();
      await project.createProjectTag();

      // Create multiple transactions
      const transaction1 = new Transaction({
        identifier: 'bulk-move-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -300,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Bulk expense 1',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [project.projectTag],
        rawData: {}
      });
      await transaction1.save();

      const transaction2 = new Transaction({
        identifier: 'bulk-move-2',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -400,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-06'),
        processedDate: new Date('2025-06-06'),
        description: 'Bulk expense 2',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [project.projectTag],
        rawData: {}
      });
      await transaction2.save();

      const response = await request(app)
        .post(`/api/budgets/projects/${project._id}/expenses/bulk-move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactionIds: [transaction1._id, transaction2._id],
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.successfulMoves).toBe(2);
      expect(response.body.data.totalRequested).toBe(2);
      expect(response.body.data.totalConvertedAmount).toBe(700);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.errors).toHaveLength(0);
    });
  });

  describe('Project Budget CRUD Operations', () => {
    
    test('POST /api/budgets/projects - should prevent duplicate project names', async () => {
      const uniqueName = `Duplicate Test ${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const projectData = {
        name: uniqueName,
        type: 'vacation',
        startDate: '2025-06-01',
        endDate: '2025-06-15'
      };

      // Create first project
      await request(app)
        .post('/api/budgets/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      // Try to create duplicate (use same name)
      const response = await request(app)
        .post('/api/budgets/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    test('GET /api/budgets/projects/:id - should prevent access to other users projects', async () => {
      // Create another user
      const otherUserData = await createTestUser(User, {
        email: 'other-project-user@example.com',
        name: 'Other Project User'
      });

      // Create project for other user
      const otherProject = new ProjectBudget({
        userId: otherUserData.user._id,
        name: 'Other User Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await otherProject.save();

      // Try to access other user's project
      const response = await request(app)
        .get(`/api/budgets/projects/${otherProject._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied');

      // Clean up
      await ProjectBudget.deleteOne({ _id: otherProject._id });
      await User.deleteOne({ _id: otherUserData.user._id });
    });

    test('PUT /api/budgets/projects/:id - should validate end date is after start date', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Date Validation Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();

      const response = await request(app)
        .put(`/api/budgets/projects/${project._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          endDate: '2025-05-01' // End before start
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('GET /api/budgets/projects - should filter by limit and offset', async () => {
      // Create multiple projects
      const projects = [];
      for (let i = 0; i < 5; i++) {
        const project = new ProjectBudget({
          userId: testUser._id,
          name: `Test Project ${i}`,
          type: 'vacation',
          startDate: new Date(`2025-0${i + 1}-01`),
          endDate: new Date(`2025-0${i + 1}-15`),
          categoryBudgets: []
        });
        projects.push(project);
      }
      await ProjectBudget.insertMany(projects);

      // Test with limit
      let response = await request(app)
        .get('/api/budgets/projects?limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.projects.length).toBeLessThanOrEqual(2);

      // Test with offset
      response = await request(app)
        .get('/api/budgets/projects?limit=2&offset=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.projects.length).toBeLessThanOrEqual(2);
      // Should be different projects due to offset
    });
  });

  describe('Error Handling', () => {
    
    test('should return 404 for non-existent project', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/api/budgets/projects/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('should validate transaction ID format', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Validation Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();

      await request(app)
        .post(`/api/budgets/projects/${project._id}/expenses/tag`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactionId: 'invalid-id' })
        .expect(400);
    });

    test('should validate project ID format', async () => {
      await request(app)
        .get('/api/budgets/projects/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    test('should validate category and subcategory IDs', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Category Validation Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();

      const transaction = new Transaction({
        identifier: 'validation-test',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -100,
        type: TransactionType.EXPENSE,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Validation test',
        rawData: {}
      });
      await transaction.save();

      await request(app)
        .put(`/api/budgets/projects/${project._id}/expenses/${transaction._id}/move`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          categoryId: 'invalid-id',
          subCategoryId: testSubCategory._id
        })
        .expect(400);
    });

    test('should require authentication for all endpoints', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Auth Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();

      await request(app)
        .get(`/api/budgets/projects/${project._id}`)
        .expect(401);

      await request(app)
        .put(`/api/budgets/projects/${project._id}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      await request(app)
        .delete(`/api/budgets/projects/${project._id}`)
        .expect(401);
    });
  });

  describe('Edge Cases', () => {
    
    test('should handle empty transaction arrays', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Empty Array Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();

      const response = await request(app)
        .post(`/api/budgets/projects/${project._id}/expenses/bulk-tag`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactionIds: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle non-expense transactions in tagging', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Non-Expense Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();

      const incomeTransaction = new Transaction({
        identifier: 'income-test',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: 1000,
        type: TransactionType.INCOME,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Income transaction',
        rawData: {}
      });
      await incomeTransaction.save();

      const response = await request(app)
        .post(`/api/budgets/projects/${project._id}/expenses/tag`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ transactionId: incomeTransaction._id })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not an expense');
    });

    test('should handle projects with no category budgets', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'No Budgets Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();

      const response = await request(app)
        .get(`/api/budgets/projects/${project._id}/expenses/breakdown`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalBudget).toBe(0);
      expect(response.body.data.plannedCategories).toHaveLength(0);
    });
  });
});
