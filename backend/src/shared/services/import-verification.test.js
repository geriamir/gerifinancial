/**
 * Import Verification Test
 * 
 * This test verifies that all budget services can be imported correctly
 * after the directory restructuring.
 */

describe('Budget Services Import Verification', () => {
  test('should import budgetService without errors', () => {
    expect(() => {
      require('../../monthly-budgets/services/budgetService');
    }).not.toThrow();
  });

  test('should import budgetCalculationService without errors', () => {
    expect(() => {
      require('../../monthly-budgets/services/budgetCalculationService');
    }).not.toThrow();
  });

  test('should import projectBudgetService without errors', () => {
    expect(() => {
      require('../../project-budgets/services/projectBudgetService');
    }).not.toThrow();
  });

  test('should import yearlyBudgetService without errors', () => {
    expect(() => {
      require('../../monthly-budgets/services/yearlyBudgetService');
    }).not.toThrow();
  });

  test('should import all budget services as a group', () => {
    expect(() => {
      const budgetService = require('../../monthly-budgets/services/budgetService');
      const budgetCalculationService = require('../../monthly-budgets/services/budgetCalculationService');
      const projectBudgetService = require('../../project-budgets/services/projectBudgetService');
      const yearlyBudgetService = require('../../monthly-budgets/services/yearlyBudgetService');

      // Verify they are objects/classes
      expect(budgetService).toBeDefined();
      expect(budgetCalculationService).toBeDefined();
      expect(projectBudgetService).toBeDefined();
      expect(yearlyBudgetService).toBeDefined();
    }).not.toThrow();
  });

  test('should have expected methods on budgetService', () => {
    const budgetService = require('../../monthly-budgets/services/budgetService');
    
    // Verify key methods exist (monthly budget specific methods only)
    expect(typeof budgetService.getMonthlyBudget).toBe('function');
    expect(typeof budgetService.createMonthlyBudget).toBe('function');
    expect(typeof budgetService.calculateMonthlyBudgetFromHistory).toBe('function');
    // Note: createProjectBudget and createYearlyBudget moved to their respective subsystems
  });

  test('should have expected methods on budgetCalculationService', () => {
    const budgetCalculationService = require('../../monthly-budgets/services/budgetCalculationService');
    
    // Verify key methods exist
    expect(typeof budgetCalculationService.calculateMonthlyBudgetFromHistory).toBe('function');
    expect(typeof budgetCalculationService.recalculateBudgetWithExclusions).toBe('function');
    expect(typeof budgetCalculationService.shouldPatternOccurInMonth).toBe('function');
  });

  test('should have expected methods on projectBudgetService', () => {
    const projectBudgetService = require('../../project-budgets/services/projectBudgetService');
    
    // Verify key methods exist
    expect(typeof projectBudgetService.createProjectBudget).toBe('function');
    expect(typeof projectBudgetService.getProjectBudget).toBe('function');
    expect(typeof projectBudgetService.updateProjectBudget).toBe('function');
    expect(typeof projectBudgetService.deleteProjectBudget).toBe('function');
  });

  test('should have expected methods on yearlyBudgetService', () => {
    const yearlyBudgetService = require('../../monthly-budgets/services/yearlyBudgetService');
    
    // Verify key methods exist
    expect(typeof yearlyBudgetService.createYearlyBudget).toBe('function');
    expect(typeof yearlyBudgetService.getYearlyBudget).toBe('function');
    expect(typeof yearlyBudgetService.updateYearlyBudget).toBe('function');
    expect(typeof yearlyBudgetService.deleteYearlyBudget).toBe('function');
  });
});

describe('External Import Verification', () => {
  test('should import from routes correctly', () => {
    expect(() => {
      // Simulate importing from routes directory
      const budgetService = require('../../monthly-budgets/services/budgetService');
      expect(budgetService).toBeDefined();
    }).not.toThrow();
  });

  test('should import with correct relative paths from parent directories', () => {
    expect(() => {
      // Test the paths that would be used from services directory
      const budgetService = require('../../monthly-budgets/services/budgetService');
      expect(budgetService).toBeDefined();
    }).not.toThrow();
  });
});
