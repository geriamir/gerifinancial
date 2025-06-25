const express = require('express');
const BankAccount = require('../models/BankAccount');
const auth = require('../middleware/auth');
const transactionService = require('../services/transactionService');
const bankScraperService = require('../services/bankScraperService');
const { encrypt } = require('../utils/encryption');

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
    console.log('Adding bank account with environment:', process.env.NODE_ENV);
    const { bankId, name, credentials } = req.body;
    console.log('Request body:', { bankId, name, hasCredentials: !!credentials });

    if (!bankId || !name || !credentials || !credentials.username || !credentials.password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate bank credentials
    try {
      await bankScraperService.validateCredentials(bankId, credentials);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid credentials or bank service unavailable',
        details: error.message
      });
    }

    // Encrypt the password before saving
    const encryptedPassword = encrypt(credentials.password);
    const bankAccount = new BankAccount({
      userId: req.user._id,
      bankId,
      name,
      credentials: {
        username: credentials.username,
        password: encryptedPassword
      },
      status: 'active'
    });

    await bankAccount.save();

    // Return without sensitive data
    const response = bankAccount.toJSON();
    res.status(201).json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update bank account
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'credentials', 'status', 'scrapingConfig'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).json({ error: 'Invalid updates' });
  }

  try {
    const bankAccount = await BankAccount.findById(req.params.id);

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Check if user owns the account
    if (bankAccount.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this account' });
    }

    // Encrypt new password if it's being updated
    if (req.body.credentials?.password) {
      req.body.credentials.password = encrypt(req.body.credentials.password);
    }

    updates.forEach(update => {
      bankAccount[update] = req.body[update];
    });

    await bankAccount.save();
    res.json(bankAccount.toJSON());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Test bank connection
router.post('/:id/test', auth, async (req, res) => {
  let bankAccount = null;

  try {
    bankAccount = await BankAccount.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    await bankScraperService.testConnection(bankAccount);

    // Update last successful connection
    bankAccount.lastScraped = new Date();
    bankAccount.status = 'active';
    bankAccount.lastError = null;
    await bankAccount.save();

    res.json({ 
      message: 'Connection test successful',
      nextScrapingTime: bankAccount.getNextScrapingTime()
    });
  } catch (error) {
    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Update error status
    bankAccount.status = 'error';
    bankAccount.lastError = {
      message: error.message,
      date: new Date()
    };
    await bankAccount.save();

    res.status(400).json({
      error: 'Connection test failed',
      details: error.message
    });
  }
});

// Delete bank account
router.delete('/:id', auth, async (req, res) => {
  try {
    const bankAccount = await BankAccount.findById(req.params.id);
    
    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Check if user owns the account
    if (bankAccount.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this account' });
    }

    await BankAccount.deleteOne({ _id: bankAccount._id });
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scrape all accounts
router.post('/scrape-all', auth, async (req, res) => {
  try {
    const accounts = await BankAccount.find({ 
      userId: req.user._id,
      status: 'active'
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Default to last 7 days

    const results = {
      totalAccounts: accounts.length,
      successfulScrapes: 0,
      failedScrapes: 0,
      errors: []
    };

    // Process accounts sequentially to avoid overwhelming bank APIs
    for (const account of accounts) {
      try {
        const scrapeResult = await transactionService.scrapeTransactions(account, {
          showBrowser: false,
          startDate
        });
        results.successfulScrapes++;
      } catch (error) {
        results.failedScrapes++;
        results.errors.push({
          accountId: account._id,
          accountName: account.name,
          error: error.message
        });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger transaction scraping for an account
router.post('/:id/scrape', auth, async (req, res) => {
  try {
    const { showBrowser, startDate } = req.body;
    const account = await BankAccount.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const results = await transactionService.scrapeTransactions(account, {
      showBrowser,
      startDate: startDate ? new Date(startDate) : undefined
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
