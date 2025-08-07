const express = require('express');
const router = express.Router();
const investmentService = require('../services/investmentService');
const bankScraperService = require('../services/bankScraperService');
const startupInvestmentService = require('../services/startupInvestmentService');
const dataSyncService = require('../services/dataSyncService');
const { BankAccount } = require('../models');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// Apply authentication middleware to all routes
router.use(auth);

// Get user's investments
router.get('/', async (req, res) => {
  try {
    const { bankAccountId } = req.query;
    const options = bankAccountId ? { bankAccountId } : {};
    
    const investments = await investmentService.getUserInvestments(req.user.id, options);
    res.json({ investments });
  } catch (error) {
    logger.error('Error fetching investments:', error);
    res.status(500).json({ error: error.message });
  }
});

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

// Sync investments for a specific bank account
router.post('/sync/:bankAccountId', async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOne({
      _id: req.params.bankAccountId,
      userId: req.user.id
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Use investment-only sync to avoid affecting transactions
    const result = await dataSyncService.syncInvestmentsOnly(bankAccount, req.body.options || {});
    
    res.json({
      message: 'Investment sync completed',
      result: result.investments,
      hasErrors: result.hasErrors
    });
  } catch (error) {
    logger.error('Error syncing investments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync all data (transactions + investments) for a bank account
router.post('/sync-all/:bankAccountId', async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOne({
      _id: req.params.bankAccountId,
      userId: req.user.id
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const result = await dataSyncService.syncBankAccountData(bankAccount, req.body.options || {});
    
    res.json({
      message: 'Complete data sync finished',
      transactions: result.transactions,
      investments: result.investments,
      totalNewItems: result.totalNewItems,
      totalUpdatedItems: result.totalUpdatedItems,
      hasErrors: result.hasErrors
    });
  } catch (error) {
    logger.error('Error syncing bank account data:', error);
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

// Startup service management endpoints

// Get current scraping status
router.get('/startup/status', async (req, res) => {
  try {
    const status = startupInvestmentService.getScrapingStatus();
    res.json({ status });
  } catch (error) {
    logger.error('Error fetching startup scraping status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger investment scraping for all accounts
router.post('/startup/scrape-all', async (req, res) => {
  try {
    const result = await startupInvestmentService.forceScrapeAllAccounts();
    res.json({ result });
  } catch (error) {
    logger.error('Error triggering manual scrape:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually check and scrape accounts (same as startup process)
router.post('/startup/check-and-scrape', async (req, res) => {
  try {
    // Run the same process as server startup
    await startupInvestmentService.checkAndScrapeAccounts();
    res.json({ 
      message: 'Account data sync check and scraping process initiated',
      status: startupInvestmentService.getScrapingStatus()
    });
  } catch (error) {
    logger.error('Error running check and scrape:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
