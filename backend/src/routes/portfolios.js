const express = require('express');
const portfolioService = require('../services/portfolioService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all portfolios for user
router.get('/', auth, async (req, res) => {
  try {
    const { bankAccountId } = req.query;
    const options = bankAccountId ? { bankAccountId } : {};
    
    const portfolios = await portfolioService.getUserPortfolios(req.user.id, options);
    res.json(portfolios);
  } catch (error) {
    logger.error('Error fetching portfolios:', error);
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
});

// Get portfolio by ID
router.get('/:portfolioId', auth, async (req, res) => {
  try {
    const portfolio = await portfolioService.getPortfolioById(req.params.portfolioId, req.user.id);
    res.json(portfolio);
  } catch (error) {
    logger.error('Error fetching portfolio:', error);
    if (error.message === 'Portfolio not found or access denied') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
  }
});

// Get portfolio summary
router.get('/summary/overview', auth, async (req, res) => {
  try {
    const summary = await portfolioService.getPortfolioSummary(req.user.id);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching portfolio summary:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio summary' });
  }
});

// Get portfolio performance metrics
router.get('/metrics/performance', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const metrics = await portfolioService.getPerformanceMetrics(req.user.id, days);
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Get portfolio trends
router.get('/trends/history', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const trends = await portfolioService.getPortfolioTrends(req.user.id, days);
    res.json(trends);
  } catch (error) {
    logger.error('Error fetching portfolio trends:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio trends' });
  }
});

// Get portfolio history for specific portfolio
router.get('/:portfolioId/history', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = await portfolioService.getPortfolioHistory(req.params.portfolioId, days);
    res.json(history);
  } catch (error) {
    logger.error('Error fetching portfolio history:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio history' });
  }
});

// Get investments history by symbol across all portfolios
router.get('/investments/:symbol/history', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const history = await portfolioService.getInvestmentsHistory(req.user.id, req.params.symbol, days);
    res.json(history);
  } catch (error) {
    logger.error('Error fetching investments history:', error);
    res.status(500).json({ error: 'Failed to fetch investments history' });
  }
});

// Update portfolio prices
router.put('/prices/update', auth, async (req, res) => {
  try {
    const { priceUpdates } = req.body;
    
    if (!priceUpdates || typeof priceUpdates !== 'object') {
      return res.status(400).json({ error: 'Invalid price updates format' });
    }
    
    const updatedCount = await portfolioService.updatePortfolioPrices(req.user.id, priceUpdates);
    res.json({ 
      message: 'Prices updated successfully', 
      updatedPortfolios: updatedCount 
    });
  } catch (error) {
    logger.error('Error updating portfolio prices:', error);
    res.status(500).json({ error: 'Failed to update portfolio prices' });
  }
});

// Delete/close portfolio
router.delete('/:portfolioId', auth, async (req, res) => {
  try {
    const portfolio = await portfolioService.deletePortfolio(req.params.portfolioId, req.user.id);
    res.json({ 
      message: 'Portfolio closed successfully', 
      portfolio 
    });
  } catch (error) {
    logger.error('Error deleting portfolio:', error);
    if (error.message === 'Portfolio not found or access denied') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete portfolio' });
    }
  }
});

// Get portfolios by bank account
router.get('/bank-account/:bankAccountId', auth, async (req, res) => {
  try {
    const portfolios = await portfolioService.getPortfoliosByBankAccount(req.user.id, req.params.bankAccountId);
    res.json(portfolios);
  } catch (error) {
    logger.error('Error fetching portfolios by bank account:', error);
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
});

module.exports = router;
