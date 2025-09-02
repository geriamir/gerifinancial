const mongoose = require('mongoose');
const { ProjectBudget, Tag, Transaction, Category, SubCategory, User } = require('../');
const { createTestUser } = require('../../../test/testUtils');
const { TransactionType } = require('../../constants/enums');

describe('ProjectBudget Model', () => {
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
      email: 'project-model-test@example.com',
      name: 'Project Model Test User'
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

  describe('Schema Validation', () => {
    
    test('should create project budget with valid data', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Summer Vacation',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 2000,
          currency: 'ILS'
        }],
        currency: 'ILS'
      };

      const project = new ProjectBudget(projectData);
      await project.save();

      expect(project.name).toBe('Summer Vacation');
      expect(project.type).toBe('vacation');
      expect(project.status).toBe('planning'); // Default status
      expect(project.priority).toBe('medium'); // Default priority
      expect(project.categoryBudgets).toHaveLength(1);
      expect(project.categoryBudgets[0].budgetedAmount).toBe(2000);
    });

    test('should require required fields', async () => {
      const projectData = {
        // Missing required fields
        name: 'Incomplete Project'
      };

      const project = new ProjectBudget(projectData);
      
      await expect(project.save()).rejects.toThrow();
    });

    test('should validate end date is after start date', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Invalid Date Project',
        type: 'vacation',
        startDate: new Date('2025-06-15'),
        endDate: new Date('2025-06-01'), // End before start
        currency: 'ILS'
      };

      const project = new ProjectBudget(projectData);
      
      await expect(project.save()).rejects.toThrow('End date must be after start date');
    });

    test('should enforce unique project names per user', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Duplicate Name',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        currency: 'ILS'
      };

      // Create first project
      const project1 = new ProjectBudget(projectData);
      await project1.save();

      // Try to create second project with same name
      const project2 = new ProjectBudget(projectData);
      await expect(project2.save()).rejects.toThrow();
    });

    test('should validate project type enum', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Invalid Type Project',
        type: 'invalid_type', // Invalid enum value
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        currency: 'ILS'
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should validate status enum', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Invalid Status Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        status: 'invalid_status', // Invalid enum value
        currency: 'ILS'
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should validate priority enum', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Invalid Priority Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        priority: 'invalid_priority', // Invalid enum value
        currency: 'ILS'
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should validate category budget amounts are non-negative', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Negative Budget Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: -1000, // Negative amount
          currency: 'ILS'
        }],
        currency: 'ILS'
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });
  });

  describe('Virtual Properties', () => {
    
    test('should calculate daysRemaining correctly', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now

      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Future Project',
        type: 'vacation',
        startDate: now,
        endDate: futureDate,
        currency: 'ILS'
      });
      await project.save();

      expect(project.daysRemaining).toBeGreaterThanOrEqual(9);
      expect(project.daysRemaining).toBeLessThanOrEqual(10);
    });

    test('should return 0 for daysRemaining if project ended', async () => {
      const pastDate = new Date('2020-06-01');
      const olderPastDate = new Date('2020-05-01');

      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Past Project',
        type: 'vacation',
        startDate: olderPastDate,
        endDate: pastDate,
        currency: 'ILS'
      });
      await project.save();

      expect(project.daysRemaining).toBe(0);
    });

    test('should calculate durationDays correctly', async () => {
      const startDate = new Date('2025-06-01');
      const endDate = new Date('2025-06-15'); // 14 days later

      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Duration Test Project',
        type: 'vacation',
        startDate: startDate,
        endDate: endDate,
        currency: 'ILS'
      });
      await project.save();

      expect(project.durationDays).toBe(14);
    });
  });

  describe('Pre-save Middleware', () => {
    
    test('should set impactsOtherBudgets to true when ongoing_funds funding source exists', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Ongoing Funds Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'ongoing_funds',
          description: 'Monthly salary allocation',
          expectedAmount: 2000,
          currency: 'ILS'
        }],
        currency: 'ILS'
      });
      await project.save();

      expect(project.impactsOtherBudgets).toBe(true);
    });

    test('should set impactsOtherBudgets to false when no ongoing_funds funding source', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Savings Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'savings',
          description: 'Personal savings',
          expectedAmount: 2000,
          currency: 'ILS'
        }],
        currency: 'ILS'
      });
      await project.save();

      expect(project.impactsOtherBudgets).toBe(false);
    });
  });

  describe('Static Methods', () => {
    
    test('findByStatus should filter projects by status', async () => {
      // Create projects with different statuses
      const activeProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Active Project',
        type: 'vacation',
        status: 'active',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        currency: 'ILS'
      });
      await activeProject.save();

      const planningProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Planning Project',
        type: 'home_renovation',
        status: 'planning',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-07-15'),
        currency: 'ILS'
      });
      await planningProject.save();

      const activeProjects = await ProjectBudget.findByStatus(testUser._id, 'active');
      expect(activeProjects).toHaveLength(1);
      expect(activeProjects[0].name).toBe('Active Project');
    });

    test('findActive should return projects that are active and within date range', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now

      // Active project within date range
      const activeProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Currently Active Project',
        type: 'vacation',
        status: 'active',
        startDate: pastDate,
        endDate: futureDate,
        currency: 'ILS'
      });
      await activeProject.save();

      // Active project but not started yet
      const futureActiveProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Future Active Project',
        type: 'home_renovation',
        status: 'active',
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        currency: 'ILS'
      });
      await futureActiveProject.save();

      const activeProjects = await ProjectBudget.findActive(testUser._id);
      expect(activeProjects).toHaveLength(1);
      expect(activeProjects[0].name).toBe('Currently Active Project');
    });

    test('findUpcoming should return projects starting within specified days', async () => {
      const now = new Date();
      const soonDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      const farDate = new Date(now.getTime() + 50 * 24 * 60 * 60 * 1000); // 50 days from now

      // Project starting soon
      const upcomingProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Upcoming Project',
        type: 'vacation',
        status: 'planning',
        startDate: soonDate,
        endDate: new Date(soonDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        currency: 'ILS'
      });
      await upcomingProject.save();

      // Project starting too far in future
      const farProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Far Future Project',
        type: 'home_renovation',
        status: 'planning',
        startDate: farDate,
        endDate: new Date(farDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        currency: 'ILS'
      });
      await farProject.save();

      const upcomingProjects = await ProjectBudget.findUpcoming(testUser._id, 30);
      expect(upcomingProjects).toHaveLength(1);
      expect(upcomingProjects[0].name).toBe('Upcoming Project');
    });
  });

  describe('Instance Methods', () => {
    
    test('createProjectTag should create and assign project tag', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Tag Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        currency: 'ILS'
      });
      await project.save();

      const tag = await project.createProjectTag();

      expect(tag).toBeDefined();
      expect(tag.name).toBe('project:tag-test-project');
      expect(tag.type).toBe('project');
      expect(tag.userId.toString()).toBe(testUser._id.toString());
      expect(project.projectTag.toString()).toBe(tag._id.toString());

      // Verify tag was saved to database
      const savedTag = await Tag.findById(tag._id);
      expect(savedTag).toBeTruthy();
      expect(savedTag.projectMetadata.status).toBe('planning');
    });

    test('addFundingSource should add funding source to project', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Funding Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        currency: 'ILS'
      });
      await project.save();

      const fundingSourceData = {
        type: 'savings',
        description: 'Personal savings account',
        expectedAmount: 5000,
        availableAmount: 3000,
        currency: 'ILS'
      };

      project.addFundingSource(fundingSourceData);
      await project.save();

      expect(project.fundingSources).toHaveLength(1);
      expect(project.fundingSources[0].type).toBe('savings');
      expect(project.fundingSources[0].expectedAmount).toBe(5000);
      expect(project.fundingSources[0].availableAmount).toBe(3000);
    });

    test('addCategoryBudget should add new category budget', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Category Budget Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        currency: 'ILS'
      });
      await project.save();

      project.addCategoryBudget(testCategory._id, testSubCategory._id, 1500);
      await project.save();

      expect(project.categoryBudgets).toHaveLength(1);
      expect(project.categoryBudgets[0].budgetedAmount).toBe(1500);
      expect(project.categoryBudgets[0].categoryId.toString()).toBe(testCategory._id.toString());
      expect(project.categoryBudgets[0].subCategoryId.toString()).toBe(testSubCategory._id.toString());
    });

    test('addCategoryBudget should update existing category budget', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Update Category Budget Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 1000
        }],
        currency: 'ILS'
      });
      await project.save();

      project.addCategoryBudget(testCategory._id, testSubCategory._id, 2000);
      await project.save();

      expect(project.categoryBudgets).toHaveLength(1);
      expect(project.categoryBudgets[0].budgetedAmount).toBe(2000);
    });


    test('markCompleted should update project status and tag metadata', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Completion Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        status: 'active',
        currency: 'ILS'
      });
      await project.save();
      await project.createProjectTag();

      await project.markCompleted();

      expect(project.status).toBe('completed');

      // Verify tag metadata was updated
      const updatedTag = await Tag.findById(project.projectTag);
      expect(updatedTag.projectMetadata.status).toBe('completed');
    });
  });

  describe('JSON Serialization', () => {
    
    test('should include virtual properties in JSON output', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'JSON Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        currency: 'ILS'
      });
      await project.save();

      const json = project.toJSON();

      expect(json).toHaveProperty('daysRemaining');
      expect(json).toHaveProperty('durationDays');
      expect(typeof json.daysRemaining).toBe('number');
      expect(typeof json.durationDays).toBe('number');
    });
  });

  describe('Indexing', () => {
    
    test('should create proper indexes for queries', async () => {
      // Create multiple projects to test index effectiveness
      const projects = [];
      for (let i = 0; i < 5; i++) {
        projects.push(new ProjectBudget({
          userId: testUser._id,
          name: `Test Project ${i}`,
          type: 'vacation',
          startDate: new Date('2025-06-01'),
          endDate: new Date('2025-06-15'),
          status: i % 2 === 0 ? 'active' : 'planning',
          currency: 'ILS'
        }));
      }
      await ProjectBudget.insertMany(projects);

      // Test compound index on userId and name
      const projectByName = await ProjectBudget.findOne({ 
        userId: testUser._id, 
        name: 'Test Project 2' 
      });
      expect(projectByName).toBeTruthy();
      expect(projectByName.name).toBe('Test Project 2');

      // Test compound index on userId and status
      const activeProjects = await ProjectBudget.find({ 
        userId: testUser._id, 
        status: 'active' 
      });
      expect(activeProjects.length).toBeGreaterThan(0);
    });
  });
});
