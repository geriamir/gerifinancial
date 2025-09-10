const { ManualCategorized, Transaction, Category, SubCategory } = require('../models');
const categoryAIService = require('./categoryAIService');
const { enhancedKeywordMatcher } = require('./enhanced-keyword-matching');
const { CategorizationMethod, TransactionType } = require('../constants/enums');
const logger = require('../../shared/utils/logger');

class CategoryMappingService {
  /**
   * Attempt to automatically categorize a transaction using various methods:
   * 1. Vendor mapping
   * 2. Keyword matching
   * 3. AI suggestion
   */
  async attemptAutoCategorization(transaction) {
    // Skip if already categorized
    // For Expenses: need both category and subcategory
    // For Income/Transfer: only need category (no subcategory)
    if (transaction.category) {
      const category = await Category.findById(transaction.category);
      if (category && (category.type !== 'Expense' || transaction.subCategory)) {
        return await Transaction.findById(transaction._id)
          .populate('category')
          .populate('subCategory');
      }
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
          return (category && categoryTypes.includes(category.type)) ? match : null;
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
      ].filter(term => term && term.trim()); // Filter out falsy values and empty/whitespace terms

      // Try enhanced keyword matching for categories (Income/Transfer)
      const categoriesWithKeywords = await Category.find({
        userId: transaction.userId,
        type: { $in: categoryTypes },
        keywords: { $exists: true, $not: { $size: 0 } }
      });

      let categoryMatch = null;
      let categoryMatchDetails = null;

      for (const category of categoriesWithKeywords) {
        // Try enhanced keyword matching for each search term
        for (const searchTerm of searchTerms) {
          if (!searchTerm || !searchTerm.trim()) continue;
          
          try {
            const keywordResult = await enhancedKeywordMatcher.matchKeywords(
              searchTerm,
              searchTerm, // Use same text for both original and translated
              category.keywords
            );

            if (keywordResult.hasMatches && keywordResult.confidence > 0.5) {
              // Determine which field matched
              let matchingField = 'unknown';
              if (searchTerm === transaction.description) matchingField = 'description';
              else if (searchTerm === (transaction.memo || transaction.rawData?.memo)) matchingField = 'memo';
              else if (searchTerm === transaction.rawData?.category) matchingField = 'rawData.category';

              categoryMatch = category;
              categoryMatchDetails = { 
                reasoning: keywordResult.reasoning, 
                matchingField,
                confidence: keywordResult.confidence
              };
              break;
            }
          } catch (error) {
            logger.warn(`Enhanced keyword matching failed for category ${category.name}:`, error);
            // Continue to next category
          }
        }
        
        if (categoryMatch) break; // Stop at first successful match
      }

      if (categoryMatch) {
        const reasoning = `Enhanced keyword match: ${categoryMatchDetails.reasoning} in ${categoryMatchDetails.matchingField}. Matched category: "${categoryMatch.name}" (confidence: ${categoryMatchDetails.confidence.toFixed(2)})`;
        
        await transaction.categorize(
          categoryMatch._id,
          null, // No subcategory for Income/Transfer
          CategorizationMethod.PREVIOUS_DATA,
          reasoning
        );
        
        // Set transaction type based on the category type
        if (!transaction.type) {
          transaction.type = categoryMatch.type;
          await transaction.save();
        }
        
        return await Transaction.findById(transaction._id)
          .populate('category')
          .populate('subCategory');
      }

      // Try enhanced keyword matching for subcategories (for Expenses)
      const allSubCategories = await SubCategory.find({}).populate('parentCategory');
      
      // Filter subcategories to match valid category types
      const eligibleSubCategories = allSubCategories.filter(subCat => 
        categoryTypes.includes(subCat.parentCategory.type) && 
        subCat.keywords && 
        subCat.keywords.length > 0
      );

      let subCategoryMatch = null;
      let subCategoryMatchDetails = null;

      for (const subCategory of eligibleSubCategories) {
        // Try enhanced keyword matching for each search term
        for (const searchTerm of searchTerms) {
          if (!searchTerm || !searchTerm.trim()) continue;
          
          try {
            const keywordResult = await enhancedKeywordMatcher.matchKeywords(
              searchTerm,
              searchTerm, // Use same text for both original and translated
              subCategory.keywords
            );

            if (keywordResult.hasMatches && keywordResult.confidence > 0.5) {
              // Determine which field matched
              let matchingField = 'unknown';
              if (searchTerm === transaction.description) matchingField = 'description';
              else if (searchTerm === (transaction.memo || transaction.rawData?.memo)) matchingField = 'memo';
              else if (searchTerm === transaction.rawData?.category) matchingField = 'rawData.category';

              subCategoryMatch = subCategory;
              subCategoryMatchDetails = { 
                reasoning: keywordResult.reasoning, 
                matchingField,
                confidence: keywordResult.confidence
              };
              break;
            }
          } catch (error) {
            logger.warn(`Enhanced keyword matching failed for subcategory ${subCategory.name}:`, error);
            // Continue to next subcategory
          }
        }
        
        if (subCategoryMatch) break; // Stop at first successful match
      }

      if (subCategoryMatch) {
        const reasoning = `Enhanced keyword match: ${subCategoryMatchDetails.reasoning} in ${subCategoryMatchDetails.matchingField}. Matched subcategory: "${subCategoryMatch.name}" (confidence: ${subCategoryMatchDetails.confidence.toFixed(2)})`;
        
        await transaction.categorize(
          subCategoryMatch.parentCategory._id,
          subCategoryMatch._id,
          CategorizationMethod.PREVIOUS_DATA,
          reasoning
        );
        
        // Set transaction type based on the category type
        if (!transaction.type) {
          transaction.type = subCategoryMatch.parentCategory.type;
          await transaction.save();
        }
        
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

      const suggestion = await categoryAIService.suggestCategory(
        transaction.description,
        transaction.amount,
        availableCategories.map(cat => ({
          id: cat._id.toString(),
          name: cat.name,
          type: cat.type,
          keywords: cat.keywords || [], // Category-level keywords for Income/Transfer
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

      if (suggestion.categoryId) {
        // Get category and subcategory names for reasoning
        const category = await Category.findById(suggestion.categoryId);
        const subCategory = suggestion.subCategoryId ? await SubCategory.findById(suggestion.subCategoryId) : null;
        
        // Build reasoning based on what fields were used for AI analysis
        const usedFields = [];
        if (transaction.description) usedFields.push(`description: "${transaction.description}"`);
        if (transaction.memo || transaction.rawData?.memo) usedFields.push(`memo: "${transaction.memo || transaction.rawData?.memo}"`);
        if (transaction.rawData?.category) usedFields.push(`rawData.category: "${transaction.rawData.category}"`);
        
        let reasoning;
        if (subCategory) {
          reasoning = `AI categorization: Analyzed ${usedFields.join(', ')}. AI suggested category: "${category?.name}" > "${subCategory.name}"${suggestion.reasoning ? `. AI reasoning: ${suggestion.reasoning}` : ''}`;
        } else {
          reasoning = `AI categorization: Analyzed ${usedFields.join(', ')}. AI suggested category: "${category?.name}"${suggestion.reasoning ? `. AI reasoning: ${suggestion.reasoning}` : ''}`;
        }
        
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
