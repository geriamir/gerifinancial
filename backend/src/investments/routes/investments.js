const express = require('express');
const router = express.Router();
const investmentService = require('../services/investmentService');
const { dataSyncService, queuedDataSyncService } = require('../../banking');
const auth = require('../../shared/middleware/auth');
const logger = require('../../shared/utils/logger');

// Apply authentication middleware to all routes
router.use(auth);

// Get user's investments
router.get('/', async (req, res) => {
  try {
    const { bankAccountId } = req.query;
    const options = bankAccountId ? { bankAccountId } : {};
    
    const investments = await investmentService.getUserInvestments(req.user.id, options);
    
    // Include portfolio-level cash balances (cash is not an investment, it belongs to the account)
    const portfolioCashBalances = await investmentService.getPortfolioCashBalances(req.user.id);
    
    // Include latest stock price data for holdings
    const holdingsPriceData = await investmentService.getHoldingsPriceData(req.user.id);
    
    res.json({ investments, portfolioCashBalances, holdingsPriceData });
  } catch (error) {
    logger.error('Error fetching investments:', error);
    res.status(500).json({ error: error.message });
  }
});

// === SPECIFIC ROUTES (must be before /:id to avoid conflicts) ===

// Get portfolio summary
router.get('/portfolio/summary', async (req, res) => {
  try {
    const summary = await investmentService.getPortfolioSummary(req.user.id);
    res.json({ portfolio: summary });
  } catch (error) {
    logger.error('Error fetching portfolio summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get portfolio trends
router.get('/portfolio/trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trends = await investmentService.getPortfolioTrends(
      req.user.id, 
      parseInt(days)
    );
    res.json({ trends });
  } catch (error) {
    logger.error('Error fetching portfolio trends:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get performance metrics
router.get('/portfolio/performance', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const performance = await investmentService.getPerformanceMetrics(
      req.user.id, 
      parseInt(days)
    );
    res.json({ performance });
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all investment transactions for user
router.get('/transactions', async (req, res) => {
  try {
    const {
      investmentId,
      symbol,
      transactionType,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    if (investmentId) options.investmentId = investmentId;
    if (symbol) options.symbol = symbol;
    if (transactionType) options.transactionType = transactionType;
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const result = await investmentService.getInvestmentTransactions(req.user.id, options);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching investment transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions by symbol
router.get('/transactions/symbol/:symbol', async (req, res) => {
  try {
    const { startDate, endDate, limit = 50 } = req.query;
    
    const options = {
      limit: parseInt(limit)
    };

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const transactions = await investmentService.getTransactionsBySymbol(
      req.user.id, 
      req.params.symbol.toUpperCase(), 
      options
    );
    
    res.json({ transactions });
  } catch (error) {
    logger.error('Error fetching transactions by symbol:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get investment transaction summary
router.get('/transactions/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const options = {};
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const summary = await investmentService.getInvestmentTransactionSummary(req.user.id, options);
    res.json({ summary });
  } catch (error) {
    logger.error('Error fetching investment transaction summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cost basis for a symbol
router.get('/cost-basis/:symbol', async (req, res) => {
  try {
    const costBasis = await investmentService.getCostBasisBySymbol(
      req.user.id, 
      req.params.symbol.toUpperCase()
    );
    res.json({ costBasis });
  } catch (error) {
    logger.error('Error calculating cost basis:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get holdings history for a specific symbol
router.get('/holdings/:symbol/history', async (req, res) => {
  try {
    const { days = 90 } = req.query;
    const history = await investmentService.getHoldingsHistory(
      req.user.id,
      req.params.symbol,
      parseInt(days)
    );
    res.json({ history });
  } catch (error) {
    logger.error('Error fetching holdings history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get holding timeline: stock price history + buy/sell events
router.get('/holdings/:symbol/timeline', async (req, res) => {
  try {
    const { days = 365 } = req.query;
    const symbol = req.params.symbol.toUpperCase();
    const timeline = await investmentService.getHoldingTimeline(
      req.user.id,
      symbol,
      parseInt(days)
    );
    res.json(timeline);
  } catch (error) {
    logger.error('Error fetching holding timeline:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get investments by bank account
router.get('/by-bank/:bankAccountId', async (req, res) => {
  try {
    const investments = await investmentService.getInvestmentsByBankAccount(
      req.user.id, 
      req.params.bankAccountId
    );
    res.json({ investments });
  } catch (error) {
    logger.error('Error fetching investments by bank account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync status for a bank account
router.get('/sync/status/:bankAccountId', async (req, res) => {
  try {
    const status = await dataSyncService.getSyncStatus(req.params.bankAccountId, req.user.id);
    res.json({ status });
  } catch (error) {
    logger.error('Error fetching sync status:', error);
    res.status(500).json({ error: error.message });
  }
});

// === PARAMETERIZED ROUTE (must be last to avoid conflicts) ===

// Get investment by ID
router.get('/:id', async (req, res) => {
  try {
    const investment = await investmentService.getInvestmentById(req.params.id, req.user.id);
    res.json({ investment });
  } catch (error) {
    logger.error('Error fetching investment:', error);
    res.status(500).json({ error: error.message });
  }
});



// Get sync status for a bank account
router.get('/sync/status/:bankAccountId', async (req, res) => {
  try {
    const status = await dataSyncService.getSyncStatus(req.params.bankAccountId, req.user.id);
    res.json({ status });
  } catch (error) {
    logger.error('Error fetching sync status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update investment prices (for manual price updates)
router.post('/prices/update', async (req, res) => {
  try {
    const { priceUpdates } = req.body; // Expected format: { "TEVA": 45.50, "AAPL": 150.00 }
    
    if (!priceUpdates || typeof priceUpdates !== 'object') {
      return res.status(400).json({ error: 'Price updates object is required' });
    }

    const updatedCount = await investmentService.updateInvestmentPrices(req.user.id, priceUpdates);
    
    res.json({
      message: `Updated prices for ${updatedCount} investment accounts`,
      updatedCount
    });
  } catch (error) {
    logger.error('Error updating investment prices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete/close an investment account
router.delete('/:id', async (req, res) => {
  try {
    const investment = await investmentService.deleteInvestment(req.params.id, req.user.id);
    res.json({
      message: 'Investment account marked as closed',
      investment
    });
  } catch (error) {
    logger.error('Error closing investment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get investments by bank account
router.get('/by-bank/:bankAccountId', async (req, res) => {
  try {
    const investments = await investmentService.getInvestmentsByBankAccount(
      req.user.id, 
      req.params.bankAccountId
    );
    res.json({ investments });
  } catch (error) {
    logger.error('Error fetching investments by bank account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get investment history
router.get('/:id/history', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const history = await investmentService.getInvestmentHistory(
      req.params.id, 
      parseInt(days)
    );
    res.json({ history });
  } catch (error) {
    logger.error('Error fetching investment history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions for a specific investment
router.get('/:id/transactions', async (req, res) => {
  try {
    const { startDate, endDate, limit = 50, offset = 0 } = req.query;
    
    const options = {
      investmentId: req.params.id,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const result = await investmentService.getInvestmentTransactions(req.user.id, options);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching investment transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get performance metrics based on transactions for specific investment
router.get('/:id/performance', async (req, res) => {
  try {
    const performance = await investmentService.calculatePerformanceFromTransactions(req.params.id);
    res.json({ performance });
  } catch (error) {
    logger.error('Error calculating investment performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create manual snapshot (for testing or manual updates)
router.post('/:id/snapshot', async (req, res) => {
  try {
    const investment = await investmentService.getInvestmentById(req.params.id, req.user.id);
    const snapshot = await investmentService.createDailySnapshot(investment);
    res.json({ 
      message: 'Snapshot created successfully',
      snapshot 
    });
  } catch (error) {
    logger.error('Error creating manual snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});


// Manually trigger comprehensive scraping for all accounts using queue system
router.post('/startup/scrape-all', async (req, res) => {
  try {
    const result = await queuedDataSyncService.queueMultipleAccountsSync(
      { status: 'active' }, // Filter for active accounts only
      { 
        priority: 'high', // High priority for manual triggers
        delayBetweenAccounts: 5000 // 5 second delay between accounts
      }
    );
    
    res.json({ 
      result: {
        message: `Queued comprehensive sync for ${result.successfulAccounts}/${result.totalAccounts} accounts`,
        totalAccounts: result.totalAccounts,
        successfulAccounts: result.successfulAccounts,
        failedAccounts: result.failedAccounts,
        totalJobs: result.totalJobs,
        queuedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error triggering manual scrape via queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get queue status and stats
router.get('/startup/queue-status', async (req, res) => {
  try {
    const stats = await queuedDataSyncService.getQueueStats();
    const health = await queuedDataSyncService.getHealthStatus();
    
    res.json({ 
      message: 'Queue system status',
      stats,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching queue status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
