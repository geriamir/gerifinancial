const { VendorMapping, SubCategory, Category } = require('../models');
const categoryAIService = require('./categoryAIService');
const { CategorizationMethod, TransactionType } = require('../constants/enums');
const logger = require('../utils/logger');

class CategoryMappingService {
  /**
   * Attempt to automatically categorize a transaction using various methods:
   * 1. Vendor mapping
   * 2. Keyword matching
   * 3. AI suggestion
   */
  async attemptAutoCategorization(transaction) {
    // Skip if already categorized
    if (transaction.category && transaction.subCategory) {
      return;
    }

    try {
      // Determine valid category types - always include Transfer type
      const categoryTypes = ['Transfer'];
      categoryTypes.push(transaction.amount > 0 ? 'Income' : 'Expense');

      // Try to match by vendor mapping
      const vendorMappings = await VendorMapping.findMatches(
        transaction.description,
        transaction.userId
      );
      
      // Filter vendor mappings by category type
      const validVendorMappings = await Promise.all(
        vendorMappings.map(async mapping => {
          const category = await Category.findById(mapping.category);
          return categoryTypes.includes(category?.type) ? mapping : null;
        })
      );

      const vendorMapping = validVendorMappings.filter(Boolean)[0];

      if (vendorMapping) {
        await transaction.categorize(
          vendorMapping.category,
          vendorMapping.subCategory,
          CategorizationMethod.PREVIOUS_DATA,
          false // needs verification
        );
        return;
      }

      // Try keyword-based matching
      const searchText = [
        transaction.description,
        transaction.memo,
        transaction.rawData?.description,
        transaction.rawData?.memo,
        transaction.rawData?.category
      ].filter(Boolean).join(' ');

      // Get subcategories and filter by parent category type
      const allMatchingSubCategories = await SubCategory.findMatchingSubCategories(searchText);
      const matchingSubCategories = await Promise.all(
        allMatchingSubCategories.map(async subCat => {
          await subCat.populate('parentCategory');
          return categoryTypes.includes(subCat.parentCategory.type) ? subCat : null;
        })
      );

      const filteredSubCategories = matchingSubCategories.filter(Boolean);

      if (filteredSubCategories.length === 1) {
        const subCategory = filteredSubCategories[0];
        await transaction.categorize(
          subCategory.parentCategory._id,
          subCategory._id,
          CategorizationMethod.PREVIOUS_DATA,
          false // needs verification
        );
        return;
      }

      // Try AI categorization as last resort
      // Only get categories matching the transaction type
      const availableCategories = await Category.find({ 
        userId: transaction.userId,
        type: { $in: categoryTypes }
      }).populate('subCategories').lean();

      const suggestion = await categoryAIService.suggestCategory(
        transaction.description,
        transaction.amount,
        availableCategories.map(cat => ({
          id: cat._id.toString(),
          name: cat.name,
          type: cat.type,
          subCategories: cat.subCategories.map(sub => ({
            id: sub._id.toString(),
            name: sub.name,
            keywords: sub.keywords || []
          }))
        })),
        transaction.userId.toString(),
        transaction.rawData?.category || '',
        transaction.memo || ''
      );

      // Always categorize with AI suggestion, but mark for verification
      if (suggestion.categoryId && suggestion.subCategoryId) {
        await transaction.categorize(
          suggestion.categoryId,
          suggestion.subCategoryId,
          CategorizationMethod.AI,
          false // needs verification
        );
      }
    } catch (error) {
      logger.error('Auto-categorization failed:', error);
    }
  }
}

module.exports = new CategoryMappingService();
