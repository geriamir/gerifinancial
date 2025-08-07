const express = require('express');
const BankAccount = require('../models/BankAccount');
const auth = require('../middleware/auth');
const transactionService = require('../services/transactionService');
const bankAccountService = require('../services/bankAccountService.js');
const dataSyncService = require('../services/dataSyncService');
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

// Scrape all accounts
router.post('/scrape-all', auth, async (req, res) => {
  try {
    const accounts = await BankAccount.find({ 
      userId: req.user._id,
      status: 'active'
    });

    const results = {
      totalAccounts: accounts.length,
      successfulScrapes: 0,
      failedScrapes: 0,
      errors: [],
      transactions: {
        total: 0,
        new: 0
      },
      investments: {
        total: 0,
        new: 0,
        updated: 0
      }
    };

    // Process accounts sequentially to avoid overwhelming bank APIs
    for (const account of accounts) {
      try {
        const scrapeResult = await dataSyncService.syncBankAccountData(account);
        
        // Count as successful if no major errors occurred
        if (!scrapeResult.hasErrors) {
          results.successfulScrapes++;
        } else {
          results.failedScrapes++;
        }

        // Aggregate transaction results
        results.transactions.new += scrapeResult.transactions.newTransactions;
        results.transactions.total += scrapeResult.transactions.totalTransactions || 0;

        // Aggregate investment results
        results.investments.new += scrapeResult.investments.newInvestments;
        results.investments.updated += scrapeResult.investments.updatedInvestments;
        results.investments.total += scrapeResult.investments.totalInvestments || 0;

        // Collect any errors
        if (scrapeResult.transactions.errors?.length > 0) {
          results.errors.push(...scrapeResult.transactions.errors.map(err => ({
            accountId: account._id,
            accountName: account.name,
            type: 'transaction',
            error: err.error || err
          })));
        }

        if (scrapeResult.investments.errors?.length > 0) {
          results.errors.push(...scrapeResult.investments.errors.map(err => ({
            accountId: account._id,
            accountName: account.name,
            type: 'investment',
            error: err.error || err
          })));
        }

      } catch (error) {
        results.failedScrapes++;
        results.errors.push({
          accountId: account._id,
          accountName: account.name,
          type: 'general',
          error: error.message
        });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger complete data scraping for an account (transactions + investments)
router.post('/:id/scrape', auth, async (req, res) => {
  try {
    const account = await BankAccount.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const results = await dataSyncService.syncBankAccountData(account);

    // Format response to match frontend expectations
    const allErrors = [
      ...(results.transactions.errors || []),
      ...(results.investments.errors || [])
    ];

    const response = {
      newTransactions: results.transactions.newTransactions || 0,
      duplicates: 0, // Not currently tracked by dataSyncService
      needsVerification: 0, // Not currently tracked by dataSyncService  
      newInvestments: results.investments.newInvestments || 0,
      updatedInvestments: results.investments.updatedInvestments || 0,
      errors: allErrors.map(err => ({
        error: typeof err === 'string' ? err : (err.error || err.message || 'Unknown error')
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Error scraping account data:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
