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
    const { bankId, name, credentials } = req.body;

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
      name,
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
  const allowedUpdates = ['name', 'credentials', 'status', 'scrapingConfig'];
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

// Account Management Routes

// Get scraping configuration
router.get('/:id/scraping-config', auth, async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    res.json({
      scrapingConfig: bankAccount.scrapingConfig,
      nextScrapingTime: bankAccount.getNextScrapingTime()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update scraping configuration
router.patch('/:id/scraping-config', auth, async (req, res) => {
  try {
    const bankAccount = await BankAccount.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Validate and update scraping configuration
    if (req.body.schedule) {
      const { frequency, dayOfWeek, dayOfMonth, timeOfDay } = req.body.schedule;
      
      if (frequency) {
        bankAccount.scrapingConfig.schedule.frequency = frequency;
      }
      
      if (dayOfWeek !== undefined && frequency === 'weekly') {
        bankAccount.scrapingConfig.schedule.dayOfWeek = dayOfWeek;
      }
      
      if (dayOfMonth !== undefined && frequency === 'monthly') {
        bankAccount.scrapingConfig.schedule.dayOfMonth = dayOfMonth;
      }
      
      if (timeOfDay) {
        bankAccount.scrapingConfig.schedule.timeOfDay = timeOfDay;
      }
    }

    if (req.body.options) {
      const { startDate, monthsBack } = req.body.options;
      
      if (startDate) {
        bankAccount.scrapingConfig.options.startDate = new Date(startDate);
      }
      
      if (monthsBack) {
        bankAccount.scrapingConfig.options.monthsBack = monthsBack;
      }
    }

    await bankAccount.save();
    
    res.json({
      scrapingConfig: bankAccount.scrapingConfig,
      nextScrapingTime: bankAccount.getNextScrapingTime()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Bank Connection Routes
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

    const scraper = createScraper(bankAccount.getScraperOptions());

    await scraper.initialize();
    await scraper.login(bankAccount.credentials);

    // Update last successful connection
    bankAccount.lastScraped = new Date();
    bankAccount.status = 'active';
    bankAccount.lastError = null;
    await bankAccount.save();

    res.json({ 
      message: 'Connection successful',
      nextScrapingTime: bankAccount.getNextScrapingTime()
    });
  } catch (error) {
    // Handle bank account not found
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
      error: 'Connection failed',
      details: error.message
    });
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

module.exports = router;
