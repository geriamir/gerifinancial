const { ManualCategorized, Transaction, Category, SubCategory } = require('../models');
const transactionClassifier = require('./transactionClassifier');
const llmCategorizer = require('./llmCategorizer');
const { enhancedKeywordMatcher } = require('./enhanced-keyword-matching');
const { CategorizationMethod, TransactionType } = require('../constants/enums');
const logger = require('../../shared/utils/logger');

/**
 * Returned instead of a result when a caller asked for the model tier to be
 * deferred and every cheaper tier declined. It means "not finished yet", which
 * is deliberately distinct from the undefined that means "finished, uncategorised" -
 * a deferred transaction must not have a default type written to it, because the
 * model tier may still choose a category whose type disagrees.
 */
const DEFERRED = Object.freeze({ deferred: true });

/**
 * Returned when a deferred transaction turned out not to be ours to settle:
 * it was deleted, or the user categorised it themselves while the model was
 * answering. Distinct from undefined so the batch counts it the way the first
 * pass counts one the user had already dealt with - as neither of ours.
 */
const SKIPPED = Object.freeze({ skipped: true });

class CategoryMappingService {
  /**
   * The category types a transaction may be given.
   *
   * Transfer is offered whatever the amount, because the sign of a transaction
   * tells you its direction and not its kind: money leaving an account is a
   * transfer out as readily as an expense. Every tier resolves against this same
   * list, so none of them can reach a category the others could not.
   */
  deriveCategoryTypes(transaction) {
    if (transaction.type) return [transaction.type];
    return [
      TransactionType.TRANSFER,
      transaction.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME
    ];
  }

  /**
   * Writes a suggestion onto a transaction, whichever tier produced it.
   */
  async applySuggestion(transaction, suggestion, method = CategorizationMethod.AI) {
    await transaction.categorize(
      suggestion.categoryId,
      suggestion.subCategoryId,
      method,
      suggestion.reasoning
    );

    if (!transaction.type) {
      transaction.type = suggestion.categoryType;
      await transaction.save();
    }

    return await Transaction.findById(transaction._id)
      .populate('category')
      .populate('subCategory');
  }

  /**
   * Nothing placed it, so record what its amount implies and leave it for the user.
   */
  async applyDefaultType(transaction) {
    if (!transaction.type) {
      transaction.type = transaction.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
      await transaction.save();
    }
  }

  /**
   * The exact question the model tier is asked about a transaction. Prefetching
   * a batch and later reading the answer back must build this identically: the
   * answer cache is keyed on the category types, description and memo, so a
   * request assembled even slightly differently in one of the two places files
   * the answer under a key the lookup will never find, and every transaction
   * quietly falls back to a request of its own.
   */
  toModelRequest(transaction) {
    return {
      description: transaction.description,
      memo: transaction.memo || transaction.rawData?.memo || null,
      amount: transaction.amount,
      categoryTypes: this.deriveCategoryTypes(transaction)
    };
  }

  /**
   * Runs the model tier for a transaction that was deferred, and settles it
   * either way. After a prefetch the answer is already cached, so this makes no
   * request at all.
   */
  async finishDeferred(staleTransaction, catalogue) {
    try {
      // Seconds passed while the model answered, and the user was very likely
      // looking at the same uncategorised list. The document held from the
      // first pass does not know they acted, and Transaction.categorize writes
      // category, subcategory and method unconditionally -- so applying a
      // suggestion to it would quietly replace their choice with a guess.
      const transaction = await Transaction.findById(staleTransaction._id);
      if (!transaction || transaction.category) return SKIPPED;

      const suggestion = await llmCategorizer.suggestFrom(
        catalogue, this.toModelRequest(transaction)
      );

      if (suggestion) return await this.applySuggestion(transaction, suggestion);

      await this.applyDefaultType(transaction);
    } catch (error) {
      logger.error('Deferred auto-categorization failed:', error);
    }
    return undefined;
  }
  /**
   * Attempt to automatically categorize a transaction, in descending order of
   * how much the evidence is worth:
   *
   * 1. An exact match against something this user categorised by hand.
   * 2. Keywords on the user's categories, then on their subcategories.
   * 3. The nearest of the user's own past corrections, by meaning.
   * 4. A language model choosing from the user's own list of categories.
   *
   * Anything that reaches the end is left uncategorised on purpose; the user
   * sees it and decides, and that decision feeds tier 1 and tier 3.
   *
   * `corpus` and `catalogue` let a caller working through many transactions load
   * the user's corrections and categories once instead of once per transaction.
   * Omit either and it is loaded on demand.
   *
   * `deferModel` stops before tier 4 and returns DEFERRED instead, so a caller
   * driving many transactions can collect everything the cheap tiers could not
   * place and ask the model about them together.
   */
  async attemptAutoCategorization(transaction, { corpus, catalogue, deferModel = false } = {}) {
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
      const categoryTypes = this.deriveCategoryTypes(transaction);

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
      // Scoped to the transaction's owner. Categories and subcategories are
      // per-user rows, so an unscoped query lets one user's keywords categorise
      // another user's transaction into a category that user does not own.
      const allSubCategories = await SubCategory.find({ userId: transaction.userId }).populate('parentCategory');
      
      // Filter subcategories to match valid category types
      const eligibleSubCategories = allSubCategories.filter(subCat => 
        subCat.parentCategory &&
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

      // Last resort: match against what this user has corrected before, by
      // meaning rather than by string. Everything above matches characters, so
      // this is where descriptions that never quite repeat get caught.
      const activeCorpus = corpus !== undefined
        ? corpus
        : await transactionClassifier.forUser(transaction.userId);

      const suggestion = await transactionClassifier.suggestFrom(activeCorpus, {
        description: transaction.description,
        memo: transaction.memo || transaction.rawData?.memo || null
      });

      if (suggestion && suggestion.categoryId) {
        const category = await Category.findById(suggestion.categoryId);
        // A correction belonging to another type would push the transaction into
        // a category that contradicts its own sign, so drop the suggestion
        // rather than trust the neighbours over the arithmetic.
        if (category && categoryTypes.includes(category.type)) {
          await transaction.categorize(
            suggestion.categoryId,
            suggestion.subCategoryId,
            CategorizationMethod.AI,
            suggestion.reasoning
          );

          if (!transaction.type) {
            transaction.type = category.type;
            await transaction.save();
          }

          return await Transaction.findById(transaction._id)
            .populate('category')
            .populate('subCategory');
        }
      }
      
      // Nothing the user has taught us fits. Ask the model to pick from their
      // own categories - the only tier that can say anything at all to someone
      // who has never corrected a transaction, which is everyone on their first
      // scrape. It declines far more readily than the tiers above, and costs
      // money when it does not, so it goes last.
      //
      // A caller working through a batch stops here instead, so every
      // transaction that got this far can be asked about in one request.
      if (deferModel) return DEFERRED;

      const activeCatalogue = catalogue !== undefined
        ? catalogue
        : await llmCategorizer.forUser(transaction.userId);

      const llmSuggestion = await llmCategorizer.suggestFrom(
        activeCatalogue, this.toModelRequest(transaction)
      );

      if (llmSuggestion) {
        return await this.applySuggestion(transaction, llmSuggestion);
      }

      await this.applyDefaultType(transaction);
    } catch (error) {
      logger.error('Auto-categorization failed:', error);
      return undefined;
    }
    return undefined;
  }
}

module.exports = new CategoryMappingService();
module.exports.DEFERRED = DEFERRED;
module.exports.SKIPPED = SKIPPED;
