const ManualCategorized = require('../models/ManualCategorized');
const { SubCategory, Category, Transaction } = require('../models');
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
        return await Transaction.findById(transaction._id)
          .populate('category')
          .populate('subCategory');
    }

    try {
      // Determine valid category types
      let categoryTypes = [];
      // Allow Transfer type regardless of amount
      if (transaction.type === TransactionType.TRANSFER) {
        categoryTypes.push(TransactionType.TRANSFER);
      } else {
        // For non-transfer transactions, use appropriate type based on amount
        categoryTypes.push(transaction.amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE);
      }

      // Try to match by manual categorization
      const manualMatches = await ManualCategorized.findMatches(
        transaction.description,
        transaction.userId,
        transaction.memo || null
      );
      
      // Filter matches by category type
      const validMatches = await Promise.all(
        manualMatches.map(async match => {
          const category = await Category.findById(match.category);
          return categoryTypes.includes(category?.type) ? match : null;
        })
      );

      const manualMatch = validMatches.filter(Boolean)[0];

      if (manualMatch) {
        await transaction.categorize(
          manualMatch.category,
          manualMatch.subCategory,
          CategorizationMethod.PREVIOUS_DATA,
          false // needs verification
        );
        return await Transaction.findById(transaction._id)
          .populate('category')
          .populate('subCategory');
      }

      // Try keyword-based matching - gather all potential search terms
      const searchTerms = [
        transaction.description,
        transaction.memo,
        transaction.rawData?.description,
        transaction.rawData?.memo,
        transaction.rawData?.category
      ].filter(Boolean);

      // Get subcategories and filter by parent category type
      const allMatchingSubCategories = await SubCategory.findMatchingSubCategories(searchTerms);
      const matchingSubCategories = await Promise.all(
        allMatchingSubCategories.map(async subCat => {
          await subCat.populate('parentCategory');
          return categoryTypes.includes(subCat.parentCategory.type) ? subCat : null;
        })
      );

      const filteredSubCategories = matchingSubCategories.filter(Boolean);

      console.log('Matching subcategories for keywords:', {
        searchTerms,
        filteredSubCategories: filteredSubCategories.map(sc => ({
          name: sc.name,
          keywords: sc.keywords
        }))
      });

      if (filteredSubCategories.length === 1) {
        const subCategory = filteredSubCategories[0];
        await transaction.categorize(
          subCategory.parentCategory._id,
          subCategory._id,
          CategorizationMethod.PREVIOUS_DATA,
          false // needs verification
        );
        return await Transaction.findById(transaction._id)
          .populate('category')
          .populate('subCategory');
      }

      // Try AI categorization as last resort
      // Only get categories matching the transaction type
      const availableCategories = await Category.find({ 
        userId: transaction.userId,
        type: { $in: categoryTypes }
      }).populate('subCategories').lean();

      console.log('Attempting AI categorization for transaction:', {
        description: transaction.description,
        rawCategory: transaction.rawData?.category,
        memo: transaction.memo
      });

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
      console.log('AI categorization result:', suggestion);

      if (suggestion.categoryId && suggestion.subCategoryId) {
        await transaction.categorize(
          suggestion.categoryId,
          suggestion.subCategoryId,
          CategorizationMethod.AI,
          false // needs verification
        );
        return await Transaction.findById(transaction._id)
          .populate('category')
          .populate('subCategory');
      }
    } catch (error) {
      logger.error('Auto-categorization failed:', error);
      return undefined;
    }
    return undefined;
  }
}

module.exports = new CategoryMappingService();
