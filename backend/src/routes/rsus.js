const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const rsuService = require('../services/rsuService');
const taxCalculationService = require('../services/taxCalculationService');
const vestingService = require('../services/vestingService');
const stockPriceService = require('../services/stockPriceService');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Grant Management Routes

/**
 * GET /api/rsus/grants
 * Get user's RSU grants with optional filtering
 */
router.get('/grants', 
  auth,
  [
    query('status').optional().isIn(['active', 'completed', 'cancelled']),
    query('stockSymbol').optional().isString().trim().isLength({ min: 1, max: 10 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, stockSymbol } = req.query;
      const filters = {};
      
      if (status) filters.status = status;
      if (stockSymbol) filters.stockSymbol = stockSymbol.toUpperCase();
      
      const grants = await rsuService.getUserGrants(req.user.id, filters);
      
      res.json({
        success: true,
        data: grants
      });
    } catch (error) {
      console.error('Error getting user grants:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/rsus/grants
 * Create a new RSU grant
 */
router.post('/grants',
  auth,
  [
    body('stockSymbol').isString().trim().isLength({ min: 1, max: 10 }),
    body('company').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('grantDate').isISO8601().toDate(),
    body('totalValue').isFloat({ min: 0.01 }),
    body('totalShares').isInt({ min: 1 }),
    body('notes').optional().isString().trim().isLength({ max: 500 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const grantData = req.body;
      const grant = await rsuService.createGrant(req.user.id, grantData);
      
      res.status(201).json({
        success: true,
        data: grant,
        message: 'RSU grant created successfully'
      });
    } catch (error) {
      console.error('Error creating grant:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/grants/:id
 * Get a specific grant by ID
 */
router.get('/grants/:id',
  auth,
  [
    param('id').isMongoId()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const grants = await rsuService.getUserGrants(req.user.id);
      const grant = grants.find(g => g._id.toString() === req.params.id);
      
      if (!grant) {
        return res.status(404).json({
          success: false,
          error: 'Grant not found'
        });
      }
      
      res.json({
        success: true,
        data: grant
      });
    } catch (error) {
      console.error('Error getting grant:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/rsus/grants/:id
 * Update a grant
 */
router.put('/grants/:id',
  auth,
  [
    param('id').isMongoId(),
    body('stockSymbol').optional().isString().trim().isLength({ min: 1, max: 10 }),
    body('company').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('totalValue').optional().isFloat({ min: 0.01 }),
    body('totalShares').optional().isInt({ min: 1 }),
    body('notes').optional().isString().trim().isLength({ max: 500 }),
    body('status').optional().isIn(['active', 'completed', 'cancelled'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Verify grant ownership
      const grants = await rsuService.getUserGrants(req.user.id);
      const existingGrant = grants.find(g => g._id.toString() === req.params.id);
      
      if (!existingGrant) {
        return res.status(404).json({
          success: false,
          error: 'Grant not found'
        });
      }
      
      const updatedGrant = await rsuService.updateGrant(req.params.id, req.body);
      
      res.json({
        success: true,
        data: updatedGrant,
        message: 'Grant updated successfully'
      });
    } catch (error) {
      console.error('Error updating grant:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/rsus/grants/:id
 * Delete a grant and its associated sales
 */
router.delete('/grants/:id',
  auth,
  [
    param('id').isMongoId()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Verify grant ownership
      const grants = await rsuService.getUserGrants(req.user.id);
      const existingGrant = grants.find(g => g._id.toString() === req.params.id);
      
      if (!existingGrant) {
        return res.status(404).json({
          success: false,
          error: 'Grant not found'
        });
      }
      
      const deletionSummary = await rsuService.deleteGrant(req.params.id);
      
      res.json({
        success: true,
        data: deletionSummary,
        message: 'Grant and associated sales deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting grant:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Sales Management Routes

/**
 * GET /api/rsus/sales
 * Get user's RSU sales with optional filtering
 */
router.get('/sales',
  auth,
  [
    query('grantId').optional().isMongoId(),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { grantId, startDate, endDate } = req.query;
      const filters = {};
      
      if (grantId) filters.grantId = grantId;
      if (startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }
      
      const sales = await rsuService.getUserSales(req.user.id, filters);
      
      res.json({
        success: true,
        data: sales
      });
    } catch (error) {
      console.error('Error getting user sales:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/rsus/sales
 * Record a new RSU sale
 */
router.post('/sales',
  auth,
  [
    body('grantId').isMongoId(),
    body('saleDate').isISO8601().toDate(),
    body('sharesAmount').isInt({ min: 1 }),
    body('pricePerShare').isFloat({ min: 0.01 }),
    body('notes').optional().isString().trim().isLength({ max: 500 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Verify grant ownership
      const grants = await rsuService.getUserGrants(req.user.id);
      const grant = grants.find(g => g._id.toString() === req.body.grantId);
      
      if (!grant) {
        return res.status(404).json({
          success: false,
          error: 'Grant not found'
        });
      }
      
      const sale = await rsuService.recordSale(req.user.id, req.body);
      
      res.status(201).json({
        success: true,
        data: sale,
        message: 'RSU sale recorded successfully'
      });
    } catch (error) {
      console.error('Error recording sale:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/sales/:id
 * Get a specific sale by ID
 */
router.get('/sales/:id',
  auth,
  [
    param('id').isMongoId()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const sales = await rsuService.getUserSales(req.user.id);
      const sale = sales.find(s => s._id.toString() === req.params.id);
      
      if (!sale) {
        return res.status(404).json({
          success: false,
          error: 'Sale not found'
        });
      }
      
      res.json({
        success: true,
        data: sale
      });
    } catch (error) {
      console.error('Error getting sale:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/rsus/sales/:id
 * Update a sale (recalculates taxes)
 */
router.put('/sales/:id',
  auth,
  [
    param('id').isMongoId(),
    body('saleDate').optional().isISO8601().toDate(),
    body('sharesAmount').optional().isInt({ min: 1 }),
    body('pricePerShare').optional().isFloat({ min: 0.01 }),
    body('notes').optional().isString().trim().isLength({ max: 500 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Verify sale ownership
      const sales = await rsuService.getUserSales(req.user.id);
      const existingSale = sales.find(s => s._id.toString() === req.params.id);
      
      if (!existingSale) {
        return res.status(404).json({
          success: false,
          error: 'Sale not found'
        });
      }
      
      // For updates, we need to delete and recreate to recalculate taxes properly
      const { RSUSale } = require('../models');
      await RSUSale.findByIdAndDelete(req.params.id);
      
      const updatedSaleData = {
        grantId: existingSale.grantId._id || existingSale.grantId,
        saleDate: req.body.saleDate || existingSale.saleDate,
        sharesAmount: req.body.sharesAmount || existingSale.sharesAmount,
        pricePerShare: req.body.pricePerShare || existingSale.pricePerShare,
        notes: req.body.notes !== undefined ? req.body.notes : existingSale.notes
      };
      
      const updatedSale = await rsuService.recordSale(req.user.id, updatedSaleData);
      
      res.json({
        success: true,
        data: updatedSale,
        message: 'Sale updated successfully'
      });
    } catch (error) {
      console.error('Error updating sale:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/rsus/sales/:id
 * Delete a sale
 */
router.delete('/sales/:id',
  auth,
  [
    param('id').isMongoId()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Verify sale ownership
      const sales = await rsuService.getUserSales(req.user.id);
      const existingSale = sales.find(s => s._id.toString() === req.params.id);
      
      if (!existingSale) {
        return res.status(404).json({
          success: false,
          error: 'Sale not found'
        });
      }
      
      const { RSUSale } = require('../models');
      await RSUSale.findByIdAndDelete(req.params.id);
      
      res.json({
        success: true,
        message: 'Sale deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting sale:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Portfolio & Analytics Routes

/**
 * GET /api/rsus/portfolio
 * Get comprehensive portfolio summary
 */
router.get('/portfolio',
  auth,
  async (req, res) => {
    try {
      const portfolioSummary = await rsuService.getPortfolioSummary(req.user.id);
      
      res.json({
        success: true,
        data: portfolioSummary
      });
    } catch (error) {
      console.error('Error getting portfolio summary:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/performance
 * Get portfolio performance metrics
 */
router.get('/performance',
  auth,
  [
    query('timeframe').optional().isIn(['1M', '3M', '6M', '1Y', 'ALL'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { timeframe = '1Y' } = req.query;
      const performance = await rsuService.getPortfolioPerformance(req.user.id, timeframe);
      
      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('Error getting portfolio performance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/grants/:id/performance
 * Get performance for a specific grant
 */
router.get('/grants/:id/performance',
  auth,
  [
    param('id').isMongoId()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Verify grant ownership
      const grants = await rsuService.getUserGrants(req.user.id);
      const grant = grants.find(g => g._id.toString() === req.params.id);
      
      if (!grant) {
        return res.status(404).json({
          success: false,
          error: 'Grant not found'
        });
      }
      
      const performance = await rsuService.getGrantPerformance(req.params.id);
      
      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('Error getting grant performance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Vesting Routes

/**
 * GET /api/rsus/vesting/upcoming
 * Get upcoming vesting events
 */
router.get('/vesting/upcoming',
  auth,
  [
    query('days').optional().isInt({ min: 1, max: 365 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const upcomingVesting = await rsuService.getUpcomingVesting(req.user.id, parseInt(days));
      
      res.json({
        success: true,
        data: upcomingVesting
      });
    } catch (error) {
      console.error('Error getting upcoming vesting:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/vesting/calendar
 * Get vesting calendar
 */
router.get('/vesting/calendar',
  auth,
  [
    query('months').optional().isInt({ min: 1, max: 24 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { months = 12 } = req.query;
      const calendar = await vestingService.getVestingCalendar(req.user.id, parseInt(months));
      
      res.json({
        success: true,
        data: calendar
      });
    } catch (error) {
      console.error('Error getting vesting calendar:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Tax Calculation Routes

/**
 * POST /api/rsus/tax/preview
 * Preview tax calculation for a potential sale
 */
router.post('/tax/preview',
  auth,
  [
    body('grantId').isMongoId(),
    body('sharesAmount').isInt({ min: 1 }),
    body('salePrice').isFloat({ min: 0.01 }),
    body('saleDate').optional().isISO8601().toDate()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Verify grant ownership
      const grants = await rsuService.getUserGrants(req.user.id);
      const grant = grants.find(g => g._id.toString() === req.body.grantId);
      
      if (!grant) {
        return res.status(404).json({
          success: false,
          error: 'Grant not found'
        });
      }
      
      const { grantId, sharesAmount, salePrice, saleDate = new Date() } = req.body;
      const taxPreview = await rsuService.getTaxPreview(req.user.id, grantId, sharesAmount, salePrice);
      
      res.json({
        success: true,
        data: taxPreview
      });
    } catch (error) {
      console.error('Error getting tax preview:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/tax/projections
 * Get tax projections for a year
 */
router.get('/tax/projections',
  auth,
  [
    query('year').optional().isInt({ min: 2020, max: 2030 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { year = new Date().getFullYear() } = req.query;
      const projections = await rsuService.getTaxProjections(req.user.id, parseInt(year));
      
      res.json({
        success: true,
        data: projections
      });
    } catch (error) {
      console.error('Error getting tax projections:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/tax/summary/:year
 * Get annual tax summary
 */
router.get('/tax/summary/:year',
  auth,
  [
    param('year').isInt({ min: 2020, max: 2030 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const summary = await taxCalculationService.getAnnualTaxSummary(req.user.id, year);
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting tax summary:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Stock Price Routes

/**
 * GET /api/rsus/prices/:symbol
 * Get current stock price
 */
router.get('/prices/:symbol',
  auth,
  [
    param('symbol').isString().trim().isLength({ min: 1, max: 10 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { StockPrice } = require('../models');
      const stockPrice = await StockPrice.findOne({ symbol: req.params.symbol.toUpperCase() });
      
      if (!stockPrice) {
        return res.status(404).json({
          success: false,
          error: 'Stock price not found'
        });
      }
      
      res.json({
        success: true,
        data: stockPrice
      });
    } catch (error) {
      console.error('Error getting stock price:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/rsus/prices/:symbol
 * Update stock price manually
 */
router.post('/prices/:symbol',
  auth,
  [
    param('symbol').isString().trim().isLength({ min: 1, max: 10 }),
    body('price').isFloat({ min: 0.01 }),
    body('companyName').optional().isString().trim().isLength({ max: 200 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { StockPrice } = require('../models');
      const symbol = req.params.symbol.toUpperCase();
      const { price, companyName } = req.body;
      
      let stockPrice = await StockPrice.findOne({ symbol });
      
      if (!stockPrice) {
        stockPrice = await StockPrice.findOrCreate(symbol, price, 'manual');
      } else {
        stockPrice.updatePrice(price, 'manual', { companyName });
        await stockPrice.save();
      }
      
      res.json({
        success: true,
        data: stockPrice,
        message: 'Stock price updated successfully'
      });
    } catch (error) {
      console.error('Error updating stock price:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/prices/:symbol/history
 * Get stock price history
 */
router.get('/prices/:symbol/history',
  auth,
  [
    param('symbol').isString().trim().isLength({ min: 1, max: 10 }),
    query('days').optional().isInt({ min: 1, max: 365 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { StockPrice } = require('../models');
      const { days = 30 } = req.query;
      const stockPrice = await StockPrice.findOne({ symbol: req.params.symbol.toUpperCase() });
      
      if (!stockPrice) {
        return res.status(404).json({
          success: false,
          error: 'Stock price not found'
        });
      }
      
      const history = days <= 7 ? stockPrice.priceHistory7Days : stockPrice.priceHistory30Days;
      
      res.json({
        success: true,
        data: {
          symbol: stockPrice.symbol,
          currentPrice: stockPrice.price,
          history: history
        }
      });
    } catch (error) {
      console.error('Error getting price history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/rsus/prices/update-all
 * Update all active stock prices
 */
router.post('/prices/update-all',
  auth,
  async (req, res) => {
    try {
      const updateResults = await stockPriceService.updateAllActivePrices();
      
      res.json({
        success: true,
        data: updateResults,
        message: `Updated ${updateResults.updated} stock prices, ${updateResults.failed} failed`
      });
    } catch (error) {
      console.error('Error updating all stock prices:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/rsus/prices/:symbol/refresh
 * Force refresh a specific stock price
 */
router.post('/prices/:symbol/refresh',
  auth,
  [
    param('symbol').isString().trim().isLength({ min: 1, max: 10 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const stockPrice = await stockPriceService.updatePrice(symbol);
      
      if (!stockPrice) {
        return res.status(404).json({
          success: false,
          error: 'Failed to update stock price'
        });
      }
      
      res.json({
        success: true,
        data: stockPrice,
        message: `${symbol} price updated successfully`
      });
    } catch (error) {
      console.error('Error refreshing stock price:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/market/summary
 * Get market summary for user's portfolio
 */
router.get('/market/summary',
  auth,
  async (req, res) => {
    try {
      // Get user's unique stock symbols
      const grants = await rsuService.getUserGrants(req.user.id, { status: 'active' });
      const userSymbols = [...new Set(grants.map(grant => grant.stockSymbol))];
      
      const marketSummary = await stockPriceService.getMarketSummary(userSymbols);
      
      res.json({
        success: true,
        data: marketSummary || {
          totalSymbols: 0,
          positiveMovers: 0,
          negativeMovers: 0,
          neutralMovers: 0
        }
      });
    } catch (error) {
      console.error('Error getting market summary:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/rsus/prices/:symbol/historical
 * Populate historical prices for a symbol
 */
router.post('/prices/:symbol/historical',
  auth,
  [
    param('symbol').isString().trim().isLength({ min: 1, max: 10 }),
    body('startDate').isISO8601().toDate(),
    body('endDate').optional().isISO8601().toDate()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const { startDate, endDate = new Date() } = req.body;
      
      const stockPrice = await stockPriceService.populateHistoricalPrices(symbol, startDate, endDate);
      
      res.json({
        success: true,
        data: stockPrice,
        message: `Historical prices populated for ${symbol}`
      });
    } catch (error) {
      console.error('Error populating historical prices:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/rsus/prices/:symbol/date/:date
 * Get price for a specific date
 */
router.get('/prices/:symbol/date/:date',
  auth,
  [
    param('symbol').isString().trim().isLength({ min: 1, max: 10 }),
    param('date').isISO8601()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const date = new Date(req.params.date);
      
      const price = await stockPriceService.getPriceOnDate(symbol, date);
      
      if (price === null) {
        return res.status(404).json({
          success: false,
          error: `No price data found for ${symbol} on ${date.toDateString()}`
        });
      }
      
      res.json({
        success: true,
        data: {
          symbol: symbol,
          date: date,
          price: price
        }
      });
    } catch (error) {
      console.error('Error getting price on date:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;
