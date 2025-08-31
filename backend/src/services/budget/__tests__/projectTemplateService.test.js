const projectTemplateService = require('../projectTemplateService');
const { Category, SubCategory, User } = require('../../../models');
const mongoose = require('mongoose');

describe('ProjectTemplateService', () => {
  let testUser;

  beforeEach(async () => {
    // Create test user using global helper
    testUser = await global.createTestUser({
      email: 'template-test@example.com',
      name: 'Template Test User'
    });
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await Promise.all([
        Category.deleteMany({ userId: testUser._id }),
        SubCategory.deleteMany({ userId: testUser._id })
      ]);
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning (ignored):', error.message);
    }
  });

  describe('getProjectTemplates', () => {
    test('should return available project templates', () => {
      const templates = projectTemplateService.getProjectTemplates();

      expect(templates).toBeDefined();
      expect(templates.vacation).toBeDefined();
      expect(templates.vacation.name).toBe('Vacation');
      expect(templates.vacation.categoryName).toBe('Travel');
      expect(templates.vacation.subCategories).toBeInstanceOf(Array);
      expect(templates.vacation.subCategories.length).toBeGreaterThan(0);
    });

    test('should have proper vacation template structure', () => {
      const templates = projectTemplateService.getProjectTemplates();
      const vacation = templates.vacation;

      expect(vacation.description).toBeDefined();
      expect(vacation.subCategories).toContainEqual(
        expect.objectContaining({
          name: 'Hotels',
          keywords: expect.arrayContaining(['hotels', 'accommodation'])
        })
      );
      expect(vacation.subCategories).toContainEqual(
        expect.objectContaining({
          name: 'Flights',
          keywords: expect.arrayContaining(['flights', 'airline'])
        })
      );
    });
  });

  describe('createProjectCategoryBudgets', () => {
    test('should create category budgets for vacation project when Travel category exists', async () => {
      // Create existing Travel category
      const travelCategory = await Category.create({
        name: 'Travel',
        type: 'Expense',
        userId: testUser._id
      });

      const result = await projectTemplateService.createProjectCategoryBudgets(
        testUser._id,
        'vacation',
        'ILS'
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that all category budgets reference the Travel category
      result.forEach(budget => {
        expect(budget.categoryId.toString()).toBe(travelCategory._id.toString());
        expect(budget.budgetedAmount).toBe(0);
        expect(budget.currency).toBe('ILS');
        expect(budget.subCategoryId).toBeDefined();
      });

      // Verify subcategories were created
      const subCategories = await SubCategory.find({
        parentCategory: travelCategory._id,
        userId: testUser._id
      });
      expect(subCategories.length).toBeGreaterThan(0);
    });

    test('should create Travel category if it does not exist', async () => {
      const result = await projectTemplateService.createProjectCategoryBudgets(
        testUser._id,
        'vacation',
        'USD'
      );

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify Travel category was created
      const travelCategory = await Category.findOne({
        name: 'Travel',
        type: 'Expense',
        userId: testUser._id
      });
      expect(travelCategory).toBeTruthy();

      // Check currency is set correctly
      result.forEach(budget => {
        expect(budget.currency).toBe('USD');
      });
    });

    test('should handle existing subcategories without duplicating', async () => {
      // Create Travel category and one subcategory
      const travelCategory = await Category.create({
        name: 'Travel',
        type: 'Expense',
        userId: testUser._id
      });

      const existingSubCategory = await SubCategory.create({
        name: 'Hotels',
        parentCategory: travelCategory._id,
        userId: testUser._id,
        keywords: ['hotels', 'accommodation']
      });

      const result = await projectTemplateService.createProjectCategoryBudgets(
        testUser._id,
        'vacation',
        'ILS'
      );

      expect(result).toBeInstanceOf(Array);
      
      // Find the Hotels budget
      const hotelBudget = result.find(budget => 
        budget.subCategoryId.toString() === existingSubCategory._id.toString()
      );
      expect(hotelBudget).toBeTruthy();

      // Verify no duplicate Hotels subcategory was created
      const hotelSubCategories = await SubCategory.find({
        name: 'Hotels',
        parentCategory: travelCategory._id,
        userId: testUser._id
      });
      expect(hotelSubCategories).toHaveLength(1);
    });

    test('should return empty array for unknown project type', async () => {
      const result = await projectTemplateService.createProjectCategoryBudgets(
        testUser._id,
        'unknown_type',
        'ILS'
      );

      expect(result).toEqual([]);
    });

    test('should use default currency when not specified', async () => {
      const result = await projectTemplateService.createProjectCategoryBudgets(
        testUser._id,
        'vacation'
      );

      expect(result).toBeInstanceOf(Array);
      result.forEach(budget => {
        expect(budget.currency).toBe('ILS'); // Default currency
      });
    });

    test('should create subcategories with proper keywords', async () => {
      await projectTemplateService.createProjectCategoryBudgets(
        testUser._id,
        'vacation',
        'ILS'
      );

      const travelCategory = await Category.findOne({
        name: 'Travel',
        userId: testUser._id
      });

      const flightsSubCategory = await SubCategory.findOne({
        name: 'Flights',
        parentCategory: travelCategory._id,
        userId: testUser._id
      });

      expect(flightsSubCategory).toBeTruthy();
      expect(flightsSubCategory.keywords).toContain('flights');
      expect(flightsSubCategory.keywords).toContain('airline');
    });
  });

  describe('getProjectTypeTemplate', () => {
    test('should return template preview for vacation', () => {
      const template = projectTemplateService.getProjectTypeTemplate('vacation');

      expect(template).toBeDefined();
      expect(template.name).toBe('Vacation');
      expect(template.categoryName).toBe('Travel');
      expect(template.subCategoryCount).toBeGreaterThan(0);
      expect(template.subCategories).toBeInstanceOf(Array);
    });

    test('should return null for unknown project type', () => {
      const template = projectTemplateService.getProjectTypeTemplate('unknown');

      expect(template).toBeNull();
    });
  });

  describe('getAvailableProjectTypes', () => {
    test('should return array of available project types', () => {
      const types = projectTemplateService.getAvailableProjectTypes();

      expect(types).toBeInstanceOf(Array);
      expect(types.length).toBeGreaterThan(0);
      
      const vacationType = types.find(type => type.type === 'vacation');
      expect(vacationType).toBeDefined();
      expect(vacationType.name).toBe('Vacation');
      expect(vacationType.subCategoryCount).toBeGreaterThan(0);
    });

    test('should include all template properties in each type', () => {
      const types = projectTemplateService.getAvailableProjectTypes();

      types.forEach(type => {
        expect(type.type).toBeDefined();
        expect(type.name).toBeDefined();
        expect(type.description).toBeDefined();
        expect(type.categoryName).toBeDefined();
        expect(type.subCategories).toBeInstanceOf(Array);
        expect(type.subCategoryCount).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid user ID', async () => {
      const invalidUserId = 'invalid-user-id';

      await expect(
        projectTemplateService.createProjectCategoryBudgets(invalidUserId, 'vacation')
      ).rejects.toThrow();
    });

    test('should create category budgets even for non-existent user', async () => {
      // The service creates categories and budgets regardless of user existence
      // This is the current behavior of the service
      const nonExistentUserId = new mongoose.Types.ObjectId();

      const result = await projectTemplateService.createProjectCategoryBudgets(
        nonExistentUserId, 
        'vacation',
        'ILS'
      );

      // Service still creates budgets even if user doesn't exist
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      // Verify all budgets have the correct structure
      result.forEach(budget => {
        expect(budget.categoryId).toBeDefined();
        expect(budget.subCategoryId).toBeDefined();
        expect(budget.budgetedAmount).toBe(0);
        expect(budget.currency).toBe('ILS');
      });
    });
  });
});
