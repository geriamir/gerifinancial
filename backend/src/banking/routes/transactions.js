const express = require('express');
const router = express.Router();
const auth = require('../../shared/middleware/auth');
const { Category, SubCategory, Transaction, Tag } = require('../../shared/models');
const transactionService = require('../services/transactionService');
const categoryAIService = require('../services/categoryAIService');
const tagService = require('../../shared/services/tagService');

// Get transactions with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      type,
      category,
      filter, // Support 'filter' parameter for backward compatibility
      subCategory,
      search,
      limit = '20',
      skip = '0',
      accountId,
      useProcessedDate = 'false'
    } = req.query;

    // Use 'filter' parameter if 'category' is not provided (backward compatibility)
    // Treat empty strings as undefined to avoid filtering issues
    const finalCategory = (category && category.trim()) || (filter && filter.trim()) || undefined;

    const validTypes = ['Expense', 'Income', 'Transfer'];
    const query = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      type: validTypes.includes(type) ? type : undefined,
      category: finalCategory, // Use finalCategory which supports both 'category' and 'filter' params
      subCategory,
      search,
      limit: parseInt(limit),
      skip: parseInt(skip),
      accountId,
      userId: req.user._id, // User ID from auth middleware
      useProcessedDate: useProcessedDate === 'true', // Convert string to boolean
    };
    
    const result = await transactionService.getTransactions(query);

    res.json(result);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions for a specific bank account
router.get('/account/:accountId', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const transactions = await transactionService.getTransactionsByDateRange(
      req.params.accountId,
      startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate ? new Date(endDate) : new Date(),
      req.user._id
    );

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uncategorized transactions
router.get('/uncategorized/:accountId', auth, async (req, res) => {
  try {
    const transactions = await transactionService.getUncategorizedTransactions(
      req.params.accountId,
      req.user._id
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uncategorized transactions statistics for dashboard
router.get('/uncategorized-stats', auth, async (req, res) => {
  try {
    const stats = await transactionService.getUncategorizedStats(req.user._id);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching uncategorized stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get spending summary
router.get('/summary/:accountId', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const rawSummary = await transactionService.getSpendingSummary(
      req.params.accountId,
      startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate ? new Date(endDate) : new Date()
    );

    res.json(rawSummary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Categorize a transaction
router.post('/:transactionId/categorize', auth, async (req, res) => {
  try {
    const { categoryId, subCategoryId, saveAsManual = false, matchingFields = {} } = req.body;
    
    if (!categoryId) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const category = await Category.findOne({
      _id: categoryId,
      userId: req.user._id
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // For Expense categories, subcategory is required
    if (category.type === 'Expense' && !subCategoryId) {
      return res.status(400).json({ error: 'Subcategory is required for Expense transactions' });
    }

    // For Income/Transfer categories, ensure no subcategory is provided
    const finalSubCategoryId = category.type === 'Expense' ? subCategoryId : null;

    // Validate subcategory if provided for Expense
    if (finalSubCategoryId) {
      const subCategory = await SubCategory.findOne({
        _id: finalSubCategoryId,
        userId: req.user._id,
        parentCategory: categoryId
      });

      if (!subCategory) {
        return res.status(404).json({ error: 'Subcategory not found or does not belong to the selected category' });
      }
    }

    const result = await transactionService.categorizeTransaction(
      req.params.transactionId,
      categoryId,
      finalSubCategoryId,
      saveAsManual,
      matchingFields
    );

    // Return the transaction with populated category and subcategory data
    const populatedTransaction = await Transaction.findById(result._id)
      .populate('category')
      .populate('subCategory');

    // If this was a manual categorization that was saved as a rule,
    // the result might include information about historical transactions updated
    const response = {
      transaction: populatedTransaction,
    };

    // Add historical update info if available
    if (result.historicalUpdates) {
      response.historicalUpdates = result.historicalUpdates;
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all categories with subcategories
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await Category.getAllWithSubCategories(req.user._id);
    if (!categories) {
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new category
router.post('/categories', auth, async (req, res) => {
  try {
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const category = await Category.findOrCreate({ 
      name, 
      type,
      userId: req.user._id 
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new subcategory
router.post('/categories/:categoryId/subcategories', auth, async (req, res) => {
  try {
    const { name, keywords = [], isDefault = false } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Verify that parent category exists and belongs to the user
    const parentCategory = await Category.findOne({
      _id: req.params.categoryId,
      userId: req.user._id
    });
    if (!parentCategory) {
      return res.status(404).json({ error: 'Parent category not found' });
    }

    const subCategory = await SubCategory.findOrCreate({
      name,
      keywords,
      isDefault,
      parentCategory: req.params.categoryId,
      userId: req.user._id
    });

    // Return populated subcategory
    const populatedSubCategory = await SubCategory.findById(subCategory._id)
      .populate('parentCategory')
      .lean();

    res.json(populatedSubCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update subcategory keywords
router.patch('/subcategories/:subCategoryId/keywords', auth, async (req, res) => {
  try {
    const { keywords } = req.body;
    
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords must be an array' });
    }

    const subCategory = await SubCategory.findOneAndUpdate(
      {
        _id: req.params.subCategoryId,
        userId: req.user._id
      },
      { $set: { keywords } },
      { new: true }
    );

    if (!subCategory) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.json(subCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a category (and its subcategories)
router.delete('/categories/:categoryId', auth, async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.categoryId,
      userId: req.user._id
    });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Remove all subcategories
    await SubCategory.deleteMany({ 
      parentCategory: category._id,
      userId: req.user._id 
    });
    
    // Remove the category
    await Category.deleteOne({ 
      _id: category._id,
      userId: req.user._id 
    });

    res.json({ message: 'Category and subcategories deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Request AI suggestion for transaction categorization
router.post('/:transactionId/suggest-category', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.transactionId,
      userId: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get all categories for the user
    const availableCategories = await Category.find({ userId: req.user._id })
      .populate('subCategories')
      .lean();

    // Get AI suggestion
    const availableCategoriesMapped = availableCategories.map(cat => ({
      id: cat._id.toString(),
      name: cat.name,
      type: cat.type,
      subCategories: cat.subCategories.map(sub => ({
        id: sub._id.toString(),
        name: sub.name,
        keywords: sub.keywords || []
      }))
    }));
    
    console.log('Requesting AI suggestion for:', {
      description: transaction.description,
      amount: transaction.amount,
      categoriesCount: availableCategoriesMapped.length
    });

    const suggestion = await categoryAIService.suggestCategory(
      transaction.description,
      transaction.amount,
      availableCategoriesMapped,
      req.user._id
    );

    console.log('Received AI suggestion:', suggestion);

    res.json({
      suggestion,
      transaction: {
        id: transaction._id,
        description: transaction.description,
        amount: transaction.amount
      }
    });
  } catch (error) {
    console.error('Error getting AI category suggestion:', error);
    res.status(500).json({ error: 'Failed to get category suggestion' });
  }
});

// ===== TAG MANAGEMENT ENDPOINTS =====

// Get all tags for the user
router.get('/tags', auth, async (req, res) => {
  try {
    const tags = await tagService.getUserTags(req.user._id);
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create or get existing tag
router.post('/tags', auth, async (req, res) => {
  try {
    const { name, color = '#1976d2' } = req.body;
    const tag = await tagService.createOrGetTag(req.user._id, name, color);
    res.json(tag);
  } catch (error) {
    console.error('Error creating tag:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Tag with this name already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Add tags to transaction
router.post('/:transactionId/tags', auth, async (req, res) => {
  try {
    const { tagNames } = req.body;
    const result = await tagService.addTagsToTransaction(
      req.user._id,
      req.params.transactionId,
      tagNames
    );
    
    const response = {
      ...result.transaction.toObject(),
      installmentInfo: result.installmentInfo
    };

    res.json(response);
  } catch (error) {
    console.error('Error adding tags to transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove tags from transaction
router.delete('/:transactionId/tags', auth, async (req, res) => {
  try {
    const { tagIds } = req.body;
    const result = await tagService.removeTagsFromTransaction(
      req.user._id,
      req.params.transactionId,
      tagIds
    );

    const response = {
      ...result.transaction.toObject(),
      installmentInfo: result.installmentInfo
    };

    res.json(response);
  } catch (error) {
    console.error('Error removing tags from transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
