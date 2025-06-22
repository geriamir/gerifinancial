const express = require('express');
const { createScraper } = require('israeli-bank-scrapers');
const BankAccount = require('../models/BankAccount');
const auth = require('../middleware/auth');

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
    const { bankId, accountNumber, credentials } = req.body;

    // Validate bank credentials by trying to scrape
    const scraper = createScraper({
      companyId: bankId,
      verbose: false
    });

    try {
      await scraper.initialize();
      await scraper.login(credentials);
      // If login successful, save the account
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid credentials or bank service unavailable',
        details: error.message
      });
    }

    const bankAccount = new BankAccount({
      userId: req.user._id,
      bankId,
      accountNumber,
      credentials,
      status: 'active'
    });

    await bankAccount.save();

    res.status(201).json(bankAccount);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update bank account
router.patch('/:id', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['credentials', 'status'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).json({ error: 'Invalid updates' });
  }

  try {
    const bankAccount = await BankAccount.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    updates.forEach(update => {
      bankAccount[update] = req.body[update];
    });

    await bankAccount.save();
    res.json(bankAccount);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete bank account
router.delete('/:id', auth, async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    res.json(bankAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test bank account connection
router.post('/:id/test', auth, async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const scraper = createScraper({
      companyId: bankAccount.bankId,
      verbose: false
    });

    await scraper.initialize();
    await scraper.login(bankAccount.credentials);

    // Update last successful connection
    bankAccount.lastScraped = new Date();
    bankAccount.status = 'active';
    bankAccount.lastError = null;
    await bankAccount.save();

    res.json({ message: 'Connection successful' });
  } catch (error) {
    // Update error status
    if (bankAccount) {
      bankAccount.status = 'error';
      bankAccount.lastError = {
        message: error.message,
        date: new Date()
      };
      await bankAccount.save();
    }

    res.status(400).json({
      error: 'Connection failed',
      details: error.message
    });
  }
});

module.exports = router;
