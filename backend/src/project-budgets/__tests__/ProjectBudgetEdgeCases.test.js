const mongoose = require('mongoose');
const { ProjectBudget } = require('../models');
const { Tag, Transaction, Category, SubCategory } = require('../../banking');

describe('ProjectBudget Model - Edge Cases and Missing Coverage', () => {
  let testUser;
  let testCategory;
  let testSubCategory;

  beforeEach(async () => {
    // Create test user using global helper
    testUser = await global.createTestUser({
      email: 'project-edge-test@example.com',
      name: 'Project Edge Test User'
    });

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

  describe('removeUnplannedExpense method', () => {
    test('should remove transaction from project and from allocated transactions', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Remove Test Project',
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
      await project.createProjectTag();

      // Create and tag transaction
      const transaction = new Transaction({
        identifier: 'remove-test',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -500,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Expense to remove',
        category: testCategory._id,
        subCategory: testSubCategory._id,
        tags: [project.projectTag],
        rawData: {}
      });
      await transaction.save();

      // Allocate transaction to planned category
      project.categoryBudgets[0].allocatedTransactions.push(transaction._id);
      await project.save();

      // Remove the unplanned expense
      const result = await project.removeUnplannedExpense(transaction._id);

      expect(result._id.toString()).toBe(transaction._id.toString());
      expect(result.tags).not.toContain(project.projectTag);

      // Verify transaction was removed from allocated transactions
      const updatedProject = await ProjectBudget.findById(project._id);
      expect(updatedProject.categoryBudgets[0].allocatedTransactions).not.toContain(transaction._id);
    });

    test('should throw error for transaction not associated with project', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Remove Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();
      await project.createProjectTag();

      // Create transaction not tagged to project
      const transaction = new Transaction({
        identifier: 'untagged-transaction',
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
        project.removeUnplannedExpense(transaction._id)
      ).rejects.toThrow('Transaction not found or not associated with this project');
    });

    test('should handle removing transaction not in any planned category', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Remove Test Project',
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
      await project.createProjectTag();

      // Create different category for transaction
      const otherCategory = await Category.create({
        name: 'Food',
        type: 'Expense',
        userId: testUser._id
      });

      const otherSubCategory = await SubCategory.create({
        name: 'Restaurants',
        parentCategory: otherCategory._id,
        userId: testUser._id
      });

      const transaction = new Transaction({
        identifier: 'unplanned-food',
        userId: testUser._id,
        accountId: new mongoose.Types.ObjectId(),
        amount: -200,
        currency: 'ILS',
        date: new Date('2025-06-05'),
        processedDate: new Date('2025-06-05'),
        description: 'Food expense',
        category: otherCategory._id,
        subCategory: otherSubCategory._id,
        tags: [project.projectTag],
        rawData: {}
      });
      await transaction.save();

      const result = await project.removeUnplannedExpense(transaction._id);

      expect(result._id.toString()).toBe(transaction._id.toString());
      expect(result.tags).not.toContain(project.projectTag);
    });

    test('should throw error for non-existent transaction', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Remove Test Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: []
      });
      await project.save();
      await project.createProjectTag();

      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(
        project.removeUnplannedExpense(nonExistentId)
      ).rejects.toThrow('Transaction not found or not associated with this project');
    });
  });

  describe('Funding sources validation', () => {
    test('should validate funding source amounts are non-negative', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Funding Validation Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'savings',
          description: 'Invalid funding',
          expectedAmount: -1000, // Negative amount
          currency: 'ILS'
        }]
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should validate funding source available amount is non-negative', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Funding Validation Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'savings',
          description: 'Invalid funding',
          expectedAmount: 1000,
          availableAmount: -500, // Negative available amount
          currency: 'ILS'
        }]
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should validate funding source limit is non-negative when provided', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Funding Validation Project',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'loan',
          description: 'Invalid loan',
          expectedAmount: 1000,
          limit: -2000, // Negative limit
          currency: 'ILS'
        }]
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should validate funding source type enum', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Funding Type Validation',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'invalid_funding_type',
          description: 'Invalid type',
          expectedAmount: 1000,
          currency: 'ILS'
        }]
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should require funding source description', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Funding Description Required',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'savings',
          expectedAmount: 1000,
          currency: 'ILS'
          // Missing description
        }]
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should enforce maximum description length for funding sources', async () => {
      const longDescription = 'x'.repeat(201); // Exceeds 200 character limit

      const projectData = {
        userId: testUser._id,
        name: 'Funding Description Length',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        fundingSources: [{
          type: 'savings',
          description: longDescription,
          expectedAmount: 1000,
          currency: 'ILS'
        }]
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });
  });

  describe('Category budget validation', () => {
    test('should enforce maximum description length for category budgets', async () => {
      const longDescription = 'x'.repeat(201); // Exceeds 200 character limit

      const projectData = {
        userId: testUser._id,
        name: 'Category Description Length',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          categoryId: testCategory._id,
          subCategoryId: testSubCategory._id,
          budgetedAmount: 1000,
          description: longDescription
        }]
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should require category and subcategory for category budgets', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Category Required',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        categoryBudgets: [{
          budgetedAmount: 1000
          // Missing categoryId and subCategoryId
        }]
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });
  });

  describe('Project name and notes validation', () => {
    test('should enforce maximum project name length', async () => {
      const longName = 'x'.repeat(101); // Exceeds 100 character limit

      const projectData = {
        userId: testUser._id,
        name: longName,
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should enforce maximum notes length', async () => {
      const longNotes = 'x'.repeat(1001); // Exceeds 1000 character limit

      const projectData = {
        userId: testUser._id,
        name: 'Notes Length Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        notes: longNotes
      };

      const project = new ProjectBudget(projectData);
      await expect(project.save()).rejects.toThrow();
    });

    test('should trim project name whitespace', async () => {
      const projectData = {
        userId: testUser._id,
        name: '  Trimmed Project Name  ',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      };

      const project = new ProjectBudget(projectData);
      await project.save();

      expect(project.name).toBe('Trimmed Project Name');
    });

    test('should trim notes whitespace', async () => {
      const projectData = {
        userId: testUser._id,
        name: 'Notes Trim Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        notes: '  These notes should be trimmed  '
      };

      const project = new ProjectBudget(projectData);
      await project.save();

      expect(project.notes).toBe('These notes should be trimmed');
    });
  });

  describe('updateActualAmounts deprecated method', () => {
    test('should log deprecation warning when called', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Deprecated Method Test',
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

      // Spy on console.warn to check for deprecation warning
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await project.updateActualAmounts();

      expect(consoleSpy).toHaveBeenCalledWith(
        'updateActualAmounts is deprecated. Actual amounts are now calculated dynamically from allocatedTransactions.'
      );
      expect(result).toBe(project);

      consoleSpy.mockRestore();
    });
  });

  describe('Static method edge cases', () => {
    test('findByStatus should handle empty results', async () => {
      const result = await ProjectBudget.findByStatus(testUser._id, 'completed');

      expect(result).toEqual([]);
    });

    test('findActive should handle projects with no end date in range', async () => {
      // Create project that ended before today
      const pastProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Past Project',
        type: 'vacation',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-01-15'),
        status: 'active'
      });
      await pastProject.save();

      const result = await ProjectBudget.findActive(testUser._id);

      expect(result).toEqual([]);
    });

    test('findUpcoming should respect custom days ahead parameter', async () => {
      const now = new Date();
      const farFutureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now

      const farFutureProject = new ProjectBudget({
        userId: testUser._id,
        name: 'Far Future Project',
        type: 'vacation',
        startDate: farFutureDate,
        endDate: new Date(farFutureDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        status: 'planning'
      });
      await farFutureProject.save();

      // Search with default 30 days - should not find the project
      const result30Days = await ProjectBudget.findUpcoming(testUser._id);
      expect(result30Days).toEqual([]);

      // Search with 90 days - should find the project
      const result90Days = await ProjectBudget.findUpcoming(testUser._id, 90);
      expect(result90Days).toHaveLength(1);
      expect(result90Days[0].name).toBe('Far Future Project');
    });
  });

  describe('addFundingSource method edge cases', () => {
    test('should set default values when not provided', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Funding Default Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      });
      await project.save();

      const sourceData = {
        type: 'savings',
        description: 'Minimal funding source',
        expectedAmount: 2000
        // No availableAmount, limit, or currency provided
      };

      project.addFundingSource(sourceData);
      await project.save();

      const addedSource = project.fundingSources[0];
      expect(addedSource.availableAmount).toBe(0); // Default value
      expect(addedSource.limit).toBeNull(); // Default value
      expect(addedSource.currency).toBe('ILS'); // Default value from project currency
    });

    test('should use project currency as default when funding source currency not specified', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Currency Default Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        currency: 'USD'
      });
      await project.save();

      const sourceData = {
        type: 'bonus',
        description: 'Work bonus',
        expectedAmount: 1500
      };

      project.addFundingSource(sourceData);
      await project.save();

      expect(project.fundingSources[0].currency).toBe('USD');
    });
  });

  describe('Virtual properties edge cases', () => {
    test('daysRemaining should handle projects ending today', async () => {
      const today = new Date();
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Ending Today',
        type: 'vacation',
        startDate: new Date('2025-01-01'),
        endDate: endOfToday
      });
      await project.save();

      expect(project.daysRemaining).toBeGreaterThanOrEqual(0);
      expect(project.daysRemaining).toBeLessThanOrEqual(1);
    });

    test('durationDays should handle same start and end date', async () => {
      const startDate = new Date('2025-06-01');
      const endDate = new Date('2025-06-02'); // End date must be after start date due to validation

      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Single Day Project',
        type: 'vacation',
        startDate: startDate,
        endDate: endDate
      });
      await project.save();

      expect(project.durationDays).toBe(1); // 1 day duration
    });
  });

  describe('Tag creation edge cases', () => {
    test('should handle special characters in project name for tag creation', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Special & Characters! Project @#$',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      });
      await project.save();

      const tag = await project.createProjectTag();

      expect(tag.name).toBe('project:special-&-characters!-project-@#$');
      expect(tag.type).toBe('project');
      expect(tag.userId.toString()).toBe(testUser._id.toString());
    });

    test('should update project with tag reference after creation', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Tag Reference Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15')
      });
      await project.save();

      expect(project.projectTag).toBeNull();

      await project.createProjectTag();

      // Reload project to verify tag was saved
      const reloadedProject = await ProjectBudget.findById(project._id);
      expect(reloadedProject.projectTag).toBeDefined();
    });
  });

  describe('markCompleted method edge cases', () => {
    test('should update tag metadata when project tag exists', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'Completion Tag Test',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        status: 'active'
      });
      await project.save();
      
      const tag = await project.createProjectTag();
      // The tag status should reflect the project's current status
      expect(tag.projectMetadata.status).toBe('active');

      await project.markCompleted();

      // Verify tag metadata was updated
      const updatedTag = await Tag.findById(project.projectTag);
      expect(updatedTag.projectMetadata.status).toBe('completed');
      expect(updatedTag.projectMetadata.endDate).toBeDefined();
    });

    test('should complete project even without tag', async () => {
      const project = new ProjectBudget({
        userId: testUser._id,
        name: 'No Tag Completion',
        type: 'vacation',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-06-15'),
        status: 'active'
      });
      await project.save();

      await project.markCompleted();

      expect(project.status).toBe('completed');
    });
  });
});
