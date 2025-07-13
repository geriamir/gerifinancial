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
      if (transaction.type) {
        // If transaction already has a type, use it
        categoryTypes.push(transaction.type);
      } else {
        // For transactions without type, consider all types but prefer amount-based logic
        // Transfer type is allowed regardless of amount
        categoryTypes.push(TransactionType.TRANSFER);
        categoryTypes.push(transaction.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME);
      }

      // Try to match by manual categorization
      const manualMatches = await ManualCategorized.findMatches(
        transaction.description,
        transaction.userId,
        transaction.memo || transaction.rawData?.memo || null
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
        // Build reasoning for manual match
        const reasoning = `Manual categorization match: Found similar transaction previously categorized. Description: "${transaction.description}"${transaction.memo || transaction.rawData?.memo ? `, Memo: "${transaction.memo || transaction.rawData?.memo}"` : ''}`;
        
        await transaction.categorize(
          manualMatch.category,
          manualMatch.subCategory,
          CategorizationMethod.PREVIOUS_DATA,
          reasoning
        );
        
        // Set transaction type based on the category type
        const category = await Category.findById(manualMatch.category);
        if (category && !transaction.type) {
          transaction.type = category.type;
          await transaction.save();
        }
        
        return await Transaction.findById(transaction._id)
          .populate('category')
          .populate('subCategory');
      }

      // Try keyword-based matching - gather all potential search terms
      const searchTerms = [
        transaction.description,
        transaction.memo || transaction.rawData?.memo,
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

      if (filteredSubCategories.length === 1) {
        const subCategory = filteredSubCategories[0];
        
        // Find which keywords matched for reasoning - ensure keywords and terms are not empty
        const matchedKeywords = subCategory.keywords.filter(keyword => 
          keyword && keyword.trim() && // Ensure keyword is not empty
          searchTerms.some(term => term && term.trim() && term.toLowerCase().includes(keyword.toLowerCase()))
        );
        
        const matchingFields = [];
        if (transaction.description && transaction.description.trim() && matchedKeywords.some(keyword => 
          keyword && keyword.trim() && transaction.description.toLowerCase().includes(keyword.toLowerCase()))) {
          matchingFields.push('description');
        }
        if ((transaction.memo || transaction.rawData?.memo) && (transaction.memo || transaction.rawData?.memo).trim() && matchedKeywords.some(keyword => 
          keyword && keyword.trim() && (transaction.memo || transaction.rawData?.memo).toLowerCase().includes(keyword.toLowerCase()))) {
          matchingFields.push('memo');
        }
        if (transaction.rawData?.category && transaction.rawData.category.trim() && matchedKeywords.some(keyword => 
          keyword && keyword.trim() && transaction.rawData.category.toLowerCase().includes(keyword.toLowerCase()))) {
          matchingFields.push('rawData.category');
        }
        
        // Only proceed if we have actual keywords and fields matched
        if (matchedKeywords.length > 0 && matchingFields.length > 0) {
          const reasoning = `Keyword match: Found "${matchedKeywords.join(', ')}" in ${matchingFields.join(', ')}. Matched subcategory: "${subCategory.name}"`;
          
          await transaction.categorize(
            subCategory.parentCategory._id,
            subCategory._id,
            CategorizationMethod.PREVIOUS_DATA,
            reasoning
          );
          
          // Set transaction type based on the category type
          if (!transaction.type) {
            transaction.type = subCategory.parentCategory.type;
            await transaction.save();
          }
          
          return await Transaction.findById(transaction._id)
            .populate('category')
            .populate('subCategory');
        } else {
          // Log this case for debugging - should not happen if SubCategory.findMatchingSubCategories works correctly
          logger.warn(`Transaction ${transaction._id}: Keyword match found subcategory "${subCategory.name}" but no actual keywords or fields matched. This suggests an issue with keyword matching logic.`);
        }
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
        transaction.memo || transaction.rawData?.memo || ''
      );

      // Always categorize with AI suggestion, but mark for verification

      if (suggestion.categoryId && suggestion.subCategoryId) {
        // Get category and subcategory names for reasoning
        const category = await Category.findById(suggestion.categoryId);
        const subCategory = await SubCategory.findById(suggestion.subCategoryId);
        
        // Build reasoning based on what fields were used for AI analysis
        const usedFields = [];
        if (transaction.description) usedFields.push(`description: "${transaction.description}"`);
        if (transaction.memo || transaction.rawData?.memo) usedFields.push(`memo: "${transaction.memo || transaction.rawData?.memo}"`);
        if (transaction.rawData?.category) usedFields.push(`rawData.category: "${transaction.rawData.category}"`);
        
        const reasoning = `AI categorization: Analyzed ${usedFields.join(', ')}. AI suggested category: "${category?.name}" > "${subCategory?.name}"${suggestion.reasoning ? `. AI reasoning: ${suggestion.reasoning}` : ''}`;
        
        await transaction.categorize(
          suggestion.categoryId,
          suggestion.subCategoryId,
          CategorizationMethod.AI,
          reasoning
        );
        
        // Set transaction type based on the category type
        if (category && !transaction.type) {
          transaction.type = category.type;
          await transaction.save();
        }
        
        return await Transaction.findById(transaction._id)
          .populate('category')
          .populate('subCategory');
      }
      
      // If no categorization was successful and transaction has no type, set default type based on amount
      if (!transaction.type) {
        transaction.type = transaction.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        await transaction.save();
      }
    } catch (error) {
      logger.error('Auto-categorization failed:', error);
      return undefined;
    }
    return undefined;
  }
}

module.exports = new CategoryMappingService();
