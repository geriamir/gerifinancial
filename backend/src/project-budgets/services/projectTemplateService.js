const { Category, SubCategory } = require('../../banking');
const logger = require('../../shared/utils/logger');

// Project templates as constants - starting with vacation only
const PROJECT_TEMPLATES = {
  vacation: {
    name: 'Vacation',
    description: 'Template for vacation and travel projects',
    categoryName: 'Travel', // Use existing Travel category
    subCategories: [
      // Existing subcategories
      { name: 'Flights', keywords: ['flights', 'airline', 'טיסות', 'airlines'] },
      { name: 'Hotels', keywords: ['hotels', 'accommodation', 'בתי מלון'] },
      { name: 'Recreation', keywords: ['recreation', 'tourist', 'תיירות'] },
      { name: 'Travel Transportation', keywords: ['travel transportation', 'taxi', 'rental car', 'תחבורה בנסיעות'] },
      { name: 'Travel Insurance', keywords: ['travel insurance', 'ביטוח נסיעות'] },
      { name: 'Travel - Miscellaneous', keywords: ['travel', 'vacation', 'נסיעות'] },
      
      // Suggested additional subcategories for better vacation planning
      { name: 'Restaurants & Dining', keywords: ['restaurant', 'dining', 'food', 'meal', 'מסעדה', 'אוכל'] },
      { name: 'Shopping & Souvenirs', keywords: ['shopping', 'souvenir', 'gifts', 'קניות', 'מזכרות'] },
      { name: 'Tours & Activities', keywords: ['tour', 'attraction', 'museum', 'sightseeing', 'activity', 'טיול', 'אטרקציה'] }
    ]
  }
};

class ProjectTemplateService {
  /**
   * Get project templates
   */
  getProjectTemplates() {
    return PROJECT_TEMPLATES;
  }

  /**
   * Create category budgets for a project based on its type
   */
  async createProjectCategoryBudgets(userId, projectType, projectCurrency = 'ILS') {
    try {
      const template = PROJECT_TEMPLATES[projectType];
      
      if (!template) {
        logger.warn(`No template found for project type: ${projectType}`);
        return [];
      }

      const categoryBudgets = [];

      // Find or create the main category
      let category = await Category.findOne({
        name: template.categoryName,
        type: 'Expense',
        userId
      });

      if (!category) {
        // This shouldn't happen since Travel category should exist from default categories
        logger.warn(`Travel category not found for user ${userId}, creating it`);
        category = await Category.findOrCreate({
          name: template.categoryName,
          type: 'Expense',
          userId,
          keywords: []
        });
      }

      // Create subcategories and add them to categoryBudgets
      for (const templateSubCategory of template.subCategories) {
        let subCategory = await SubCategory.findOne({
          name: templateSubCategory.name,
          parentCategory: category._id,
          userId
        });

        if (!subCategory) {
          subCategory = await SubCategory.findOrCreate({
            name: templateSubCategory.name,
            parentCategory: category._id,
            userId,
            keywords: templateSubCategory.keywords || []
          });
          logger.info(`Created new subcategory: ${templateSubCategory.name} for Travel category for user ${userId}`);
        }

        // Add to project category budgets with 0 amount (user can set amounts later)
        categoryBudgets.push({
          categoryId: category._id,
          subCategoryId: subCategory._id,
          budgetedAmount: 0,
          actualAmount: 0,
          currency: projectCurrency
        });
      }

      logger.info(`Created ${categoryBudgets.length} category budgets for ${projectType} project for user ${userId}`);
      return categoryBudgets;

    } catch (error) {
      logger.error(`Error creating project category budgets for type ${projectType}:`, error);
      throw error;
    }
  }

  /**
   * Get template preview for a project type (without creating categories)
   */
  getProjectTypeTemplate(projectType) {
    const template = PROJECT_TEMPLATES[projectType];
    
    if (!template) {
      return null;
    }

    return {
      ...template,
      subCategoryCount: template.subCategories.length
    };
  }

  /**
   * Get all available project types
   */
  getAvailableProjectTypes() {
    return Object.keys(PROJECT_TEMPLATES).map(type => ({
      type,
      ...this.getProjectTypeTemplate(type)
    }));
  }
}

module.exports = new ProjectTemplateService();
