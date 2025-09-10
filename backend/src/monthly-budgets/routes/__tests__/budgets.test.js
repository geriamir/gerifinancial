const request = require('supertest');
const mongoose = require('mongoose');
const { createTestUser } = require('../../../test/testUtils');
const app = require('../../../app');
const { User } = require('../../../auth');
const { Category, SubCategory, Transaction, Tag } = require('../../../banking');
const { MonthlyBudget } = require('../../models');
const { ProjectBudget } = require('../../../project-budgets');

let testUser;
let authToken;
let testCategory;
let testSubCategory;

beforeEach(async () => {
  // Create test user using testUtils (in beforeEach because beforeEach clears DB)
  const testData = await createTestUser(User, {
    email: 'budget-test@example.com',
    name: 'Budget Test User'
  });
  testUser = testData.user;
  authToken = testData.token;
  
  // Create test category and subcategory
  testCategory = new Category({
    name: 'Test Expenses',
    type: 'Expense',
    userId: testUser._id
  });
  await testCategory.save();
  
  testSubCategory = new SubCategory({
    name: 'Test Groceries',
    parentCategory: testCategory._id,
    userId: testUser._id
  });
  await testSubCategory.save();
});

afterAll(async () => {
  // Clean up test data - use try-catch in case connection is closed
  try {
    if (testUser) {
      await MonthlyBudget.deleteMany({ userId: testUser._id });
      await ProjectBudget.deleteMany({ userId: testUser._id });
      await Tag.deleteMany({ userId: testUser._id });
      await Transaction.deleteMany({ userId: testUser._id });
      await SubCategory.deleteOne({ _id: testSubCategory._id });
      await Category.deleteOne({ _id: testCategory._id });
      await User.deleteOne({ _id: testUser._id });
    }
  } catch (error) {
    // Ignore cleanup errors - likely due to connection being closed
    console.log('Cleanup error (ignored):', error.message);
  }
});


describe('Budget API Endpoints', () => {
  
  // ============================================
  // MONTHLY BUDGET TESTS
  // ============================================
  
  describe('Monthly Budget Endpoints', () => {
    
    test('POST /api/budgets/monthly - should create monthly budget', async () => {
      const budgetData = {
        year: 2025,
        month: 3,
        salaryBudget: 15000,
        currency: 'ILS',
        expenseBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 2000
        }],
        notes: 'Test monthly budget'
      };

      const response = await request(app)
        .post('/api/budgets/monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .send(budgetData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.year).toBe(2025);
      expect(response.body.data.month).toBe(3);
      expect(response.body.data.salaryBudget).toBe(15000);
      expect(response.body.data.expenseBudgets).toHaveLength(1);
      expect(response.body.data.totalBudgetedIncome).toBe(15000);
      expect(response.body.data.totalBudgetedExpenses).toBe(2000);
    });

    test('POST /api/budgets/monthly - should prevent duplicate monthly budget', async () => {
      const budgetData = {
        year: 2025,
        month: 3,
        salaryBudget: 10000
      };

      // Create first budget
      await request(app)
        .post('/api/budgets/monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .send(budgetData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/budgets/monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .send(budgetData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    test('GET /api/budgets/monthly/:year/:month - should get monthly budget', async () => {
      // Create budget first
      const budget = new MonthlyBudget({
        userId: testUser._id,
        year: 2025,
        month: 3,
        salaryBudget: 12000,
        expenseBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 1500,
          actualAmount: 0
        }]
      });
      await budget.save();

      const response = await request(app)
        .get('/api/budgets/monthly/2025/3')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.year).toBe(2025);
      expect(response.body.data.month).toBe(3);
      expect(response.body.data.salaryBudget).toBe(12000);
    });

    test('PUT /api/budgets/monthly/:id - should update monthly budget', async () => {
      const budget = new MonthlyBudget({
        userId: testUser._id,
        year: 2025,
        month: 3,
        salaryBudget: 12000
      });
      await budget.save();

      const updateData = {
        salaryBudget: 15000,
        notes: 'Updated budget'
      };

      const response = await request(app)
        .put(`/api/budgets/monthly/${budget._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.salaryBudget).toBe(15000);
      expect(response.body.data.notes).toBe('Updated budget');
    });

    test('POST /api/budgets/monthly/calculate - should auto-calculate from history', async () => {
      // Create some historical transactions
      const transaction1 = new Transaction({
        identifier: 'test-1',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -1000,
        currency: 'ILS',
        date: new Date('2025-01-15'),
        processedDate: new Date('2025-01-15'),
        description: 'Grocery shopping',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        rawData: {}
      });
      await transaction1.save();

      const transaction2 = new Transaction({
        identifier: 'test-2',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -1200,
        currency: 'ILS',
        date: new Date('2025-02-15'),
        processedDate: new Date('2025-02-15'),
        description: 'Grocery shopping',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        rawData: {}
      });
      await transaction2.save();

      const response = await request(app)
        .post('/api/budgets/monthly/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          year: 2025,
          month: 3,
          monthsToAnalyze: 2
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isAutoCalculated).toBe(true);
      expect(response.body.data.expenseBudgets).toHaveLength(1);
      expect(response.body.data.expenseBudgets[0].budgetedAmount).toBe(1100); // Average of 1000 and 1200
    });

    test('GET /api/budgets/monthly/:year/:month/actual - should get variance analysis', async () => {
      const budget = new MonthlyBudget({
        userId: testUser._id,
        year: 2025,
        month: 3,
        salaryBudget: 12000,
        expenseBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 1500,
          actualAmount: 1200
        }]
      });
      await budget.save();

      const response = await request(app)
        .get('/api/budgets/monthly/2025/3/actual')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalBudgeted');
      expect(response.body.data).toHaveProperty('totalActual');
      expect(response.body.data).toHaveProperty('expenseVariances');
    });
  });

  // ============================================
  // PROJECT BUDGET TESTS
  // ============================================
  
  describe('Project Budget Endpoints', () => {
    
    test('POST /api/budgets/projects - should create project budget', async () => {
      const projectData = {
        name: 'Kitchen Renovation',
        description: 'Complete kitchen renovation project',
        type: 'home_renovation',
        startDate: '2025-03-01',
        endDate: '2025-06-30',
        fundingSources: [{
          type: 'savings',
          description: 'Personal savings',
          expectedAmount: 20000,
          availableAmount: 20000
        }],
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 15000
        }],
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/budgets/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Kitchen Renovation');
      expect(response.body.data.status).toBe('planning');
      expect(response.body.data.totalBudget).toBe(15000);
      expect(response.body.data.projectTag).toBeDefined();
      
      // Verify tag was created
      const tag = await Tag.findById(response.body.data.projectTag);
      expect(tag).toBeTruthy();
      expect(tag.name).toBe('project:kitchen-renovation');
      expect(tag.type).toBe('project');
    });

    test('GET /api/budgets/projects - should list projects with filtering', async () => {
      // Create test projects
      const project1 = new ProjectBudget({
        userId: testUser._id,
        name: 'Project 1',
        type: 'vacation',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        status: 'active',
        fundingSources: [],
        categoryBudgets: []
      });
      await project1.save();

      const project2 = new ProjectBudget({
        userId: testUser._id,
        name: 'Project 2',
        type: 'home_renovation',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-06-30'),
        status: 'planning',
        fundingSources: [],
        categoryBudgets: []
      });
      await project2.save();

      // Test without filters
      let response = await request(app)
        .get('/api/budgets/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);

      // Test with status filter
      response = await request(app)
        .get('/api/budgets/projects?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.projects[0].name).toBe('Project 1');

      // Test with year filter
      response = await request(app)
        .get('/api/budgets/projects?year=2025')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.projects).toHaveLength(2);
    });

    test('PUT /api/budgets/projects/:id - should update project budget', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project',
        type: 'investment',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        fundingSources: [],
        categoryBudgets: []
      });
      await project.save();

      const updateData = {
        name: 'Updated Project Name',
        status: 'active',
        priority: 'urgent'
      };

      const response = await request(app)
        .put(`/api/budgets/projects/${project._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Project Name');
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.priority).toBe('urgent');
    });

    test('DELETE /api/budgets/projects/:id - should delete project budget', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project',
        type: 'vacation',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        fundingSources: [],
        categoryBudgets: []
      });
      await project.save();

      // Create project tag
      await project.createProjectTag();
      const tagId = project.projectTag;

      const response = await request(app)
        .delete(`/api/budgets/projects/${project._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify project is deleted
      const deletedProject = await ProjectBudget.findById(project._id);
      expect(deletedProject).toBeNull();

      // Verify tag is deleted
      const deletedTag = await Tag.findById(tagId);
      expect(deletedTag).toBeNull();
    });

    test('GET /api/budgets/projects/:id/progress - should get project progress', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project',
        type: 'home_renovation',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        fundingSources: [{
          type: 'savings',
          description: 'Personal savings',
          expectedAmount: 10000,
          availableAmount: 10000
        }],
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 5000,
          actualAmount: 2000
        }]
      });
      await project.save();

      const response = await request(app)
        .get(`/api/budgets/projects/${project._id}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('name', 'Test Project');
      expect(response.body.data).toHaveProperty('progress');
      expect(response.body.data).toHaveProperty('totalBudget');
      expect(response.body.data).toHaveProperty('totalPaid');
      expect(response.body.data).toHaveProperty('remainingBudget');
      expect(response.body.data).toHaveProperty('categoryBreakdown');
    });
  });

  // ============================================
  // DASHBOARD & SUMMARY TESTS
  // ============================================
  
  describe('Dashboard & Summary Endpoints', () => {
    
    test('GET /api/budgets/summary - should get budget summary', async () => {
      // Create monthly budget
      const monthlyBudget = new MonthlyBudget({
        userId: testUser._id,
        year: 2025,
        month: 3,
        salaryBudget: 15000,
        expenseBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 2000,
          actualAmount: 1500
        }]
      });
      await monthlyBudget.save();

      // Create active project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Active Project',
        type: 'home_renovation',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        status: 'active',
        fundingSources: [],
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 5000,
          actualAmount: 1000
        }]
      });
      await project.save();

      const response = await request(app)
        .get('/api/budgets/summary?year=2025&month=3')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('monthly');
      expect(response.body.data).toHaveProperty('activeProjects');
      expect(response.body.data.monthly).toHaveProperty('totalBudgetedIncome');
      expect(response.body.data.activeProjects).toHaveLength(1);
    });

    test('GET /api/budgets/dashboard - should get dashboard overview', async () => {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      // Create current month budget
      const monthlyBudget = new MonthlyBudget({
        userId: testUser._id,
        year: currentYear,
        month: currentMonth,
        salaryBudget: 12000
      });
      await monthlyBudget.save();

      // Create active project
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Active Project',
        type: 'investment',
        startDate: new Date(currentYear, currentMonth - 2, 1), // Started 2 months ago
        endDate: new Date(currentYear, currentMonth + 3, 30), // Ends in 3 months
        status: 'active',
        fundingSources: [],
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 8000,
          actualAmount: 0
        }]
      });
      await project.save();

      const response = await request(app)
        .get('/api/budgets/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentMonth');
      expect(response.body.data).toHaveProperty('activeProjects');
      expect(response.body.data).toHaveProperty('upcomingProjects');
      expect(response.body.data).toHaveProperty('totalActiveProjectBudget');
      expect(response.body.data.activeProjects).toBe(1);
      expect(response.body.data.totalActiveProjectBudget).toBe(8000);
    });
  });

  // ============================================
  // VALIDATION & ERROR HANDLING TESTS
  // ============================================
  
  describe('Validation & Error Handling', () => {
    
    test('should require authentication for all endpoints', async () => {
      await request(app)
        .get('/api/budgets/monthly/2025/3')
        .expect(401);

      await request(app)
        .post('/api/budgets/monthly')
        .send({ year: 2025, month: 3 })
        .expect(401);

      await request(app)
        .get('/api/budgets/projects')
        .expect(401);
    });

    test('should validate monthly budget input', async () => {
      // Test invalid year
      await request(app)
        .post('/api/budgets/monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ year: 2019, month: 3 })
        .expect(400);

      // Test invalid month
      await request(app)
        .post('/api/budgets/monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ year: 2025, month: 13 })
        .expect(400);

      // Test negative salary budget
      await request(app)
        .post('/api/budgets/monthly')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ year: 2025, month: 3, salaryBudget: -1000 })
        .expect(400);
    });

    test('should validate project budget input', async () => {
      // Test missing required fields
      await request(app)
        .post('/api/budgets/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Project' }) // Missing type, startDate and endDate
        .expect(400);

      // Test invalid date range
      await request(app)
        .post('/api/budgets/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          type: 'vacation',
          startDate: '2025-06-01',
          endDate: '2025-03-01' // End before start
        })
        .expect(400);

      // Test invalid priority
      await request(app)
        .post('/api/budgets/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          type: 'vacation',
          startDate: '2025-03-01',
          endDate: '2025-06-01',
          priority: 'invalid'
        })
        .expect(400);
    });

    test('should prevent access to other users\' budgets', async () => {
      // Create another user
      const otherUser = new User({
        email: 'other@example.com',
        name: 'Other User',
        password: 'password123'
      });
      await otherUser.save();

      // Create budget for other user
      const otherBudget = new MonthlyBudget({
        userId: otherUser._id,
        year: 2025,
        month: 3,
        salaryBudget: 10000
      });
      await otherBudget.save();

      // Try to access other user's budget
      const response = await request(app)
        .get('/api/budgets/monthly/2025/3')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should return null/empty since budget doesn't belong to authenticated user
      expect(response.body.data).toBeNull();
    });
  });
});
