const express = require('express');
const BankAccount = require('../models/BankAccount');
const auth = require('../../shared/middleware/auth');
const bankAccountService = require('../services/bankAccountService.js');
const { encrypt } = require('../../shared/utils/encryption');
const { OTP_BANKS } = require('../constants/enums');

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

    if (bankId === 'mercury') {
      if (!name || !credentials?.apiToken) {
        return res.status(400).json({ error: 'Missing required fields: name and API token are required for Mercury' });
      }
    } else if (OTP_BANKS.includes(bankId)) {
      if (!name || !credentials?.username || !credentials?.phoneOrEmail) {
        return res.status(400).json({ error: 'Missing required fields: name, ID number, and phone/email are required' });
      }
    } else if (bankId === 'ibkr') {
      if (!name || !credentials?.flexToken || !credentials?.queryId) {
        return res.status(400).json({ error: 'Missing required fields: name, Flex token, and Query ID are required for Interactive Brokers' });
      }
    } else {
      if (!bankId || !name || !credentials?.username || !credentials?.password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
    }

    const bankAccount = await bankAccountService.create(req.user._id, {
      bankId,
      name,
      username: credentials.username,
      password: credentials.password,
      apiToken: credentials.apiToken,
      flexToken: credentials.flexToken,
      queryId: credentials.queryId,
      phoneOrEmail: credentials.phoneOrEmail
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
    const { username, password, apiToken } = req.body;

    // Look up account to determine bank type
    const account = await BankAccount.findOne({ _id: req.params.id, userId: req.user._id });
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    if (account.bankId === 'mercury') {
      if (!apiToken) {
        return res.status(400).json({ error: 'API token is required for Mercury' });
      }
    } else {
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
    }

    const bankAccount = await bankAccountService.updateCredentials(
      req.params.id,
      req.user._id,
      { username, password, apiToken }
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

// ===== BALANCE ROUTES =====

const balanceService = require('../services/balanceService');

// Get current balance summary for all user accounts
router.get('/balance/summary', auth, async (req, res) => {
  try {
    const summary = await balanceService.getAccountSummary(req.user._id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get aggregated net worth history
router.get('/balance/net-worth', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = await balanceService.getNetWorthHistory(req.user._id, days);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get balance history for a specific account
router.get('/:id/balance/history', auth, async (req, res) => {
  try {
    // Verify ownership
    const bankAccount = await BankAccount.findOne({ _id: req.params.id, userId: req.user._id });
    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    const days = parseInt(req.query.days) || 30;
    const history = await balanceService.getBalanceHistory(req.params.id, days);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
