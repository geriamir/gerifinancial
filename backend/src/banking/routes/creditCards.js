const express = require('express');
const auth = require('../../shared/middleware/auth');
const creditCardService = require('../services/creditCardService');

const router = express.Router();

// Get all credit cards for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const creditCards = await creditCardService.getUserCreditCards(req.user._id);
    res.json(creditCards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get credit card details with basic stats
router.get('/:id', auth, async (req, res) => {
  try {
    const creditCard = await creditCardService.getCreditCardDetails(req.params.id, req.user._id);
    
    if (!creditCard) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    res.json(creditCard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get credit card basic statistics (6-month summary)
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const stats = await creditCardService.getCreditCardBasicStats(req.params.id, req.user._id);
    
    if (!stats) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly statistics for a specific month
router.get('/:id/stats/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    
    // Validate year and month
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Invalid year or month parameter' });
    }

    const monthlyStats = await creditCardService.getCreditCardMonthlyStats(
      req.params.id, 
      yearNum, 
      monthNum, 
      req.user._id
    );
    
    if (!monthlyStats) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    res.json(monthlyStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get credit card transactions with filtering and pagination
router.get('/:id/transactions', auth, async (req, res) => {
  try {
    const filters = {};
    
    // Parse query parameters for filtering
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate);
    }
    
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate);
    }
    
    if (req.query.category) {
      filters.category = req.query.category;
    }
    
    if (req.query.subCategory) {
      filters.subCategory = req.query.subCategory;
    }
    
    if (req.query.minAmount) {
      filters.minAmount = parseFloat(req.query.minAmount);
    }
    
    if (req.query.maxAmount) {
      filters.maxAmount = parseFloat(req.query.maxAmount);
    }
    
    if (req.query.description) {
      filters.description = req.query.description;
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'processedDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    filters.page = page;
    filters.limit = limit;
    filters.sortBy = sortBy;
    filters.sortOrder = sortOrder;

    const result = await creditCardService.getCreditCardTransactions(
      req.params.id, 
      filters, 
      req.user._id
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get credit card trend data (6-month trend)
router.get('/:id/trend', auth, async (req, res) => {
  try {
    const trendData = await creditCardService.getCreditCardTrend(req.params.id, req.user._id);
    
    if (!trendData) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    res.json(trendData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
