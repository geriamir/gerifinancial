const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Category, SubCategory } = require('../models');
const transactionService = require('../services/transactionService');

// Get transactions with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      type,
      category,
      search,
      limit = '20',
      skip = '0',
      accountId
    } = req.query;

    const validTypes = ['Expense', 'Income', 'Transfer'];
    const query = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      type: validTypes.includes(type) ? type : undefined,
      category,
      search,
      limit: parseInt(limit),
      skip: parseInt(skip),
      accountId,
      userId: req.user._id, // User ID from auth middleware
    };

    console.log('Transaction request:', {
      rawParams: req.query,
      parsedQuery: {
        type: query.type,
        startDate: query.startDate?.toISOString(),
        endDate: query.endDate?.toISOString(),
        userId: query.userId.toString()
      }
    });
    
    const result = await transactionService.getTransactions(query);

    console.log('Found transactions:', {
      userId: req.user._id,
      total: result.total,
      transactionCount: result.transactions.length
    });

    // Log response sample
    if (result.transactions.length > 0) {
      console.log('First transaction:', {
        _id: result.transactions[0]._id,
        userId: result.transactions[0].userId,
        description: result.transactions[0].description
      });
    } else {
      console.log('No transactions found for query');
    }

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
    const { categoryId, subCategoryId } = req.body;
    
    if (!categoryId || !subCategoryId) {
      return res.status(400).json({ error: 'Category and subcategory are required' });
    }

    const category = await Category.findById(categoryId);
    const subCategory = await SubCategory.findById(subCategoryId);

    if (!category || !subCategory) {
      return res.status(404).json({ error: 'Category or subcategory not found' });
    }

    const transaction = await transactionService.categorizeTransaction(
      req.params.transactionId,
      categoryId,
      subCategoryId
    );

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all categories with subcategories
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await Category.getAllWithSubCategories();
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

    const category = await Category.findOrCreate({ name, type });
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

    // Verify that parent category exists
    const parentCategory = await Category.findById(req.params.categoryId);
    if (!parentCategory) {
      return res.status(404).json({ error: 'Parent category not found' });
    }

    const subCategory = await SubCategory.findOrCreate({
      name,
      keywords,
      isDefault,
      parentCategory: req.params.categoryId
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

    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.subCategoryId,
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
    const category = await Category.findById(req.params.categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Remove all subcategories
    await SubCategory.deleteMany({ parentCategory: category._id });
    
    // Remove the category
    await Category.deleteOne({ _id: category._id });

    res.json({ message: 'Category and subcategories deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
