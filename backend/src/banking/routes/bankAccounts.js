const express = require('express');
const BankAccount = require('../models/BankAccount');
const auth = require('../../shared/middleware/auth');
const bankAccountService = require('../services/bankAccountService.js');
const { encrypt } = require('../../shared/utils/encryption');

const router = express.Router();

// Get all bank accounts for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const accounts = await BankAccount.find({ userId: req.user._id });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new bank account
router.post('/', auth, async (req, res) => {
  try {
    const { bankId, name, credentials } = req.body;

    if (!bankId || !name || !credentials?.username || !credentials?.password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bankAccount = await bankAccountService.create(req.user._id, {
      bankId,
      name,
      username: credentials.username,
      password: credentials.password
    });

    // Return without sensitive data
    const response = bankAccount.toJSON();
    res.status(201).json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update bank account (name, scrapingConfig only)
router.patch('/:id', auth, async (req, res) => {
  try {
    const bankAccount = await bankAccountService.update(req.params.id, req.user._id, req.body);
    res.json(bankAccount.toJSON());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update bank account credentials
router.put('/:id/credentials', auth, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const bankAccount = await bankAccountService.updateCredentials(
      req.params.id,
      req.user._id,
      { username, password }
    );

    res.json({
      message: 'Credentials updated successfully',
      account: bankAccount.toJSON()
    });
  } catch (error) {
    res.status(400).json({
      error: 'Failed to update credentials',
      details: error.message
    });
  }
});

// Test bank connection
router.post('/:id/test', auth, async (req, res) => {
  try {
    const bankAccount = await bankAccountService.updateStatus(req.params.id, req.user._id, 'active');
    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    
    res.json({ 
      message: 'Connection test successful',
      nextScrapingTime: bankAccount.getNextScrapingTime()
    });
  } catch (error) {
    res.status(400).json({
      error: 'Connection test failed',
      details: error.message
    });
  }
});

// Delete bank account
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await bankAccountService.delete(req.params.id, req.user._id);
    
    if (!result) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Queue scraping jobs for all accounts
router.post('/scrape-all', auth, async (req, res) => {
  try {
    const options = {
      priority: req.body.priority || 'normal'
    };

    const result = await bankAccountService.queueAllAccountsScraping(req.user._id, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Queue scraping jobs for a single account (all strategies)
router.post('/:id/scrape', auth, async (req, res) => {
  try {
    const options = {
      priority: req.body.priority || 'high' // Single account scrapes get high priority
    };

    const result = await bankAccountService.queueAccountScraping(req.params.id, req.user._id, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Queue a specific strategy for a specific account
router.post('/:id/scrape/:strategy', auth, async (req, res) => {
  try {
    const { strategy } = req.params;
    const options = {
      priority: req.body.priority || 'normal'
    };

    const result = await bankAccountService.queueStrategyForAccount(req.params.id, req.user._id, strategy, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recover missing transactions by recalculating lastScraped from actual transaction data
router.post('/:id/recover-transactions', auth, async (req, res) => {
  try {
    const result = await bankAccountService.recoverMissingTransactions(req.params.id, req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue statistics
router.get('/queue/stats', auth, async (req, res) => {
  try {
    const stats = await bankAccountService.getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue health status
router.get('/queue/health', auth, async (req, res) => {
  try {
    const health = await bankAccountService.getQueueHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
