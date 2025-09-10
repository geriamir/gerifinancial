const projectBudgetService = require('../projectBudgetService');
const { User } = require('../../../auth');
const { Tag, Transaction, Category, SubCategory } = require('../../../banking');
const { ProjectBudget } = require('../../models');
const { createTestUser } = require('../../../test/testUtils');
const mongoose = require('mongoose');

describe('ProjectBudgetService', () => {
  let testUser;
  let testCategory;
  let testSubCategory;

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
      email: 'project-test@example.com',
      name: 'Project Test User'
    });
    testUser = userData.user;

    // Create test category and subcategory
    testCategory = await Category.create({
      name: 'Travel',
      type: 'Expense',
      userId: testUser._id
    });

    testSubCategory = await SubCategory.create({
      name: 'Hotels',
      parentCategory: testCategory._id,
      userId: testUser._id
    });
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

  describe('createProjectBudget', () => {
    
    test('should create project budget with basic data', async () => {
      const projectData = {
        name: 'Europe Vacation',
        type: 'vacation',
        description: 'Summer vacation to Europe',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'savings',
          description: 'Personal savings',
          expectedAmount: 5000,
          availableAmount: 5000,
          currency: 'ILS'
        }],
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 3000,
          currency: 'ILS',
          description: 'Hotel accommodation'
        }],
        currency: 'ILS',
        priority: 'high'
      };

      const result = await projectBudgetService.createProjectBudget(testUser._id, projectData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Europe Vacation');
      expect(result.type).toBe('vacation');
      expect(result.status).toBe('planning');
      expect(result.userId.toString()).toBe(testUser._id.toString());
      expect(result.fundingSources).toHaveLength(1);
      expect(result.categoryBudgets).toHaveLength(1);
      expect(result.projectTag).toBeDefined();
      expect(result.totalBudget).toBe(3000);
      
      // Verify project tag was created
      const tag = await Tag.findById(result.projectTag);
      expect(tag).toBeTruthy();
      expect(tag.name).toBe('project:europe-vacation');
      expect(tag.type).toBe('project');
      expect(tag.userId.toString()).toBe(testUser._id.toString());
    });

    test('should create project budget with template for vacation type', async () => {
      const projectData = {
        name: 'Beach Vacation',
        type: 'vacation',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-07-10'),
        currency: 'ILS'
      };

      const result = await projectBudgetService.createProjectBudget(testUser._id, projectData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Beach Vacation');
      expect(result.type).toBe('vacation');
      expect(result.categoryBudgets.length).toBeGreaterThan(0); // Template should create category budgets
    });

    test('should handle project creation with minimal data', async () => {
      const projectData = {
        name: 'Simple Project',
        type: 'home_renovation',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-09-01')
      };

      const result = await projectBudgetService.createProjectBudget(testUser._id, projectData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Simple Project');
      expect(result.currency).toBe('ILS'); // Default currency
      expect(result.priority).toBe('medium'); // Default priority
      expect(result.status).toBe('planning'); // Default status
    });

    test('should throw error for invalid project data', async () => {
      const invalidProjectData = {
        name: '', // Empty name should fail validation
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-05-01') // End before start
      };

      await expect(
        projectBudgetService.createProjectBudget(testUser._id, invalidProjectData)
      ).rejects.toThrow();
    });
  });

  describe('getProjectBudget', () => {
    
    test('should get project budget with calculated totals', async () => {
      // Create project
      const project = new ProjectBudget({
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
      await project.save();
      await project.createProjectTag();

      const result = await projectBudgetService.getProjectBudget(project._id);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Project');
      expect(result.totalBudget).toBe(2000);
      expect(result.totalPaid).toBe(0);
      expect(result.progress).toBe(0);
      expect(result.categoryBreakdown).toHaveLength(1);
    });

    test('should throw error for non-existent project', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(
        projectBudgetService.getProjectBudget(nonExistentId)
      ).rejects.toThrow('Project budget not found');
    });
  });

  describe('updateProjectBudget', () => {
    
    test('should update project budget fields', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Original Name',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        status: 'planning',
        priority: 'medium'
      });
      await project.save();

      const updates = {
        name: 'Updated Name',
        status: 'active',
        priority: 'high',
        notes: 'Updated notes'
      };

      const result = await projectBudgetService.updateProjectBudget(project._id, updates);

      expect(result.name).toBe('Updated Name');
      expect(result.status).toBe('active');
      expect(result.priority).toBe('high');
      expect(result.notes).toBe('Updated notes');
    });

    test('should not update immutable fields', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      });
      await project.save();

      const updates = {
        userId: new mongoose.Types.ObjectId(), // Should not be updateable
        type: 'home_renovation', // Should not be updateable
        startDate: new Date('2025-07-01'), // Should not be updateable
        name: 'Updated Name'
      };

      const result = await projectBudgetService.updateProjectBudget(project._id, updates);

      expect(result.userId.toString()).toBe(testUser._id.toString()); // Unchanged
      expect(result.type).toBe('vacation'); // Unchanged
      expect(result.startDate.toISOString()).toBe(new Date('2025-06-01').toISOString()); // Unchanged
      expect(result.name).toBe('Updated Name'); // Changed
    });
  });

  describe('deleteProjectBudget', () => {
    
    test('should delete project budget and associated tag', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      });
      await project.save();
      await project.createProjectTag();
      
      const tagId = project.projectTag;

      const result = await projectBudgetService.deleteProjectBudget(project._id);

      expect(result.success).toBe(true);

      // Verify project is deleted
      const deletedProject = await ProjectBudget.findById(project._id);
      expect(deletedProject).toBeNull();

      // Verify tag is deleted
      const deletedTag = await Tag.findById(tagId);
      expect(deletedTag).toBeNull();
    });

    test('should handle deletion of project without tag', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      });
      await project.save();

      const result = await projectBudgetService.deleteProjectBudget(project._id);

      expect(result.success).toBe(true);
      
      const deletedProject = await ProjectBudget.findById(project._id);
      expect(deletedProject).toBeNull();
    });
  });

  describe('getProjectBudgets', () => {
    
    test('should get all project budgets for user', async () => {
      // Create multiple projects
      const project1 = new ProjectBudget({
        userId: testUser._id,
        name: 'Project 1',
        type: 'vacation',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        status: 'active'
      });
      await project1.save();

      const project2 = new ProjectBudget({
        userId: testUser._id,
        name: 'Project 2',
        type: 'home_renovation',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-06-30'),
        status: 'planning'
      });
      await project2.save();

      const result = await projectBudgetService.getProjectBudgets(testUser._id);

      expect(result.projects).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.projects[0].name).toBe('Project 2'); // Sorted by startDate DESC
      expect(result.projects[1].name).toBe('Project 1');
    });

    test('should filter projects by status', async () => {
      const project1 = new ProjectBudget({
        userId: testUser._id,
        name: 'Active Project',
        type: 'vacation',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        status: 'active'
      });
      await project1.save();

      const project2 = new ProjectBudget({
        userId: testUser._id,
        name: 'Planning Project',
        type: 'home_renovation',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-06-30'),
        status: 'planning'
      });
      await project2.save();

      const result = await projectBudgetService.getProjectBudgets(testUser._id, { status: 'active' });

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('Active Project');
      expect(result.projects[0].status).toBe('active');
    });

    test('should filter projects by year', async () => {
      const project2024 = new ProjectBudget({
        userId: testUser._id,
        name: '2024 Project',
        type: 'vacation',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-08-31'),
        status: 'completed'
      });
      await project2024.save();

      const project2025 = new ProjectBudget({
        userId: testUser._id,
        name: '2025 Project',
        type: 'home_renovation',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-06-30'),
        status: 'planning'
      });
      await project2025.save();

      const result = await projectBudgetService.getProjectBudgets(testUser._id, { year: 2025 });

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('2025 Project');
    });
  });

  describe('getProjectProgress', () => {
    
    test('should calculate project progress correctly', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Progress Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 1000,
          allocatedTransactions: []
        }]
      });
      await project.save();

      // Create and tag a transaction
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
        rawData: {}
      });
      await transaction.save();

      await project.createProjectTag();
      await transaction.addTags([project.projectTag]);

      const result = await projectBudgetService.getProjectProgress(project._id);

      expect(result).toBeDefined();
      expect(result.totalBudget).toBe(1000);
      expect(result.totalPaid).toBe(500);
      expect(result.progress).toBe(50);
      expect(result.remainingBudget).toBe(500);
    });
  });

  describe('markProjectCompleted', () => {
    
    test('should mark project as completed with notes', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        status: 'active',
        notes: 'Original notes'
      });
      await project.save();

      const completionNotes = 'Project completed successfully within budget';
      const result = await projectBudgetService.markProjectCompleted(project._id, completionNotes);

      expect(result.status).toBe('completed');
      expect(result.completedDate).toBeDefined();
      expect(result.notes).toContain('Original notes');
      expect(result.notes).toContain('Completion Notes: Project completed successfully within budget');
    });

    test('should mark project as completed without additional notes', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        status: 'active'
      });
      await project.save();

      const result = await projectBudgetService.markProjectCompleted(project._id);

      expect(result.status).toBe('completed');
      expect(result.completedDate).toBeDefined();
    });
  });

  describe('getActiveProjectBudgets', () => {
    
    test('should get only active projects within date range', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // Active project (current)
      const activeProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Active Project',
        type: 'vacation',
        startDate: pastDate,
        endDate: futureDate,
        status: 'active'
      });
      await activeProject.save();

      // Inactive project (future)
      const futureProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Future Project',
        type: 'home_renovation',
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });
      await futureProject.save();

      // Completed project (past)
      const completedProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Completed Project',
        type: 'investment',
        startDate: new Date(pastDate.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: pastDate,
        status: 'completed'
      });
      await completedProject.save();

      const result = await projectBudgetService.getActiveProjectBudgets(testUser._id);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Active Project');
      expect(result[0].status).toBe('active');
    });
  });

  describe('getProjectBudgetStats', () => {
    
    test('should calculate project budget statistics', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const futureDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now

      // Active project
      const activeProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Active Project',
        type: 'vacation',
        startDate: pastDate,
        endDate: futureDate,
        status: 'active',
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 5000,
          allocatedTransactions: []
        }]
      });
      await activeProject.save();

      // Upcoming project
      const upcomingProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Upcoming Project',
        type: 'home_renovation',
        startDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        endDate: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000), // 40 days from now
        status: 'planning'
      });
      await upcomingProject.save();

      // Completed project
      const completedProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Completed Project',
        type: 'investment',
        startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        status: 'completed'
      });
      await completedProject.save();

      const result = await projectBudgetService.getProjectBudgetStats(testUser._id);

      expect(result.activeProjects).toBe(1);
      expect(result.upcomingProjects).toBe(1);
      expect(result.completedProjects).toBe(1);
      expect(result.totalActiveProjectBudget).toBe(5000);
      expect(result.totalSpentOnActiveProjects).toBe(0);
      expect(result.averageProjectProgress).toBe(0);
    });
  });
});
