const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { ForeignCurrencyAccount, CurrencyExchange, Transaction } = require('../models');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all foreign currency routes
router.use(authMiddleware);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * @route   GET /api/foreign-currency/accounts
 * @desc    Get all foreign currency accounts for the user
 * @access  Private
 */
router.get('/accounts', [
  query('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  query('bankAccountId').optional().isMongoId().withMessage('Invalid bank account ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { currency, bankAccountId } = req.query;
    
    const options = {};
    if (currency) options.currency = currency;
    if (bankAccountId) options.bankAccountId = bankAccountId;
    
    const accounts = await ForeignCurrencyAccount.getUserAccounts(req.user.id, options);
    
    res.json({
      success: true,
      data: accounts.map(account => account.getSummary()),
      total: accounts.length
    });
  } catch (error) {
    logger.error('Error fetching foreign currency accounts:', error);
    res.status(500).json({
      error: 'Failed to fetch foreign currency accounts',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/foreign-currency/accounts/:accountNumber
 * @desc    Get specific foreign currency account details
 * @access  Private
 */
router.get('/accounts/:accountNumber', [
  param('accountNumber').isLength({ min: 1, max: 50 }).withMessage('Invalid account number'),
  handleValidationErrors
], async (req, res) => {
  try {
    const accountNumber = decodeURIComponent(req.params.accountNumber);
    
    const account = await ForeignCurrencyAccount.findOne({
      accountNumber: accountNumber,
      userId: req.user.id
    }).populate('bankAccountId', 'name bankId');
    
    if (!account) {
      return res.status(404).json({
        error: 'Foreign currency account not found'
      });
    }
    
    // Get current balance in ILS
    const balanceILS = await account.getBalanceInILS();
    
    const accountData = account.toJSON();
    accountData.currentBalanceILS = balanceILS;
    
    res.json({
      success: true,
      data: accountData
    });
  } catch (error) {
    logger.error('Error fetching foreign currency account:', error);
    res.status(500).json({
      error: 'Failed to fetch account details',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/foreign-currency/accounts/:accountNumber/transactions
 * @desc    Get transactions for a specific foreign currency account
 * @access  Private
 */
router.get('/accounts/:accountNumber/transactions', [
  param('accountNumber').isLength({ min: 1, max: 50 }).withMessage('Invalid account number'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { limit = 25, offset = 0, startDate, endDate } = req.query;
    const accountNumber = decodeURIComponent(req.params.accountNumber);
    
    // Verify account belongs to user
    const account = await ForeignCurrencyAccount.findOne({
      accountNumber: accountNumber,
      userId: req.user.id
    });
    
    if (!account) {
      return res.status(404).json({
        error: 'Foreign currency account not found'
      });
    }
    
    // Build query - use the MongoDB ObjectId for transaction lookup
    const query = {
      accountId: account._id,
      userId: req.user.id
    };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // Get transactions with pagination
    const [transactions, totalCount] = await Promise.all([
      Transaction.find(query)
        .sort({ date: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .populate('category', 'name')
        .populate('subCategory', 'name'),
      Transaction.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: totalCount > parseInt(offset) + parseInt(limit)
      },
      account: {
        id: account._id,
        currency: account.currency,
        displayName: account.displayName
      }
    });
  } catch (error) {
    logger.error('Error fetching foreign currency transactions:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/foreign-currency/summary
 * @desc    Get summary of all foreign currency accounts by currency
 * @access  Private
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await ForeignCurrencyAccount.getCurrencySummary(req.user.id);
    
    // Get latest exchange rates
    const currencies = summary.map(item => item._id);
    const exchangeRates = {};
    
    for (const currency of currencies) {
      try {
        const rate = await CurrencyExchange.getRate(currency, 'ILS');
        exchangeRates[currency] = rate;
      } catch (error) {
        logger.warn(`Failed to get exchange rate for ${currency}:`, error.message);
        exchangeRates[currency] = null;
      }
    }
    
    // Add current exchange rates to summary
    const enrichedSummary = summary.map(item => ({
      currency: item._id,
      totalBalance: item.totalBalance,
      totalBalanceILS: item.totalBalanceILS,
      accountCount: item.accountCount,
      totalTransactions: item.totalTransactions,
      lastTransactionDate: item.lastTransactionDate,
      currentExchangeRate: exchangeRates[item._id],
      currentBalanceILS: exchangeRates[item._id] ? item.totalBalance * exchangeRates[item._id] : null
    }));
    
    res.json({
      success: true,
      data: enrichedSummary,
      totalCurrencies: enrichedSummary.length
    });
  } catch (error) {
    logger.error('Error fetching foreign currency summary:', error);
    res.status(500).json({
      error: 'Failed to fetch currency summary',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/foreign-currency/exchange-rates
 * @desc    Get latest exchange rates
 * @access  Private
 */
router.get('/exchange-rates', [
  query('baseCurrency').optional().isLength({ min: 3, max: 3 }).withMessage('Base currency must be 3 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { baseCurrency = 'ILS' } = req.query;
    
    const rates = await CurrencyExchange.getLatestRates(baseCurrency);
    
    res.json({
      success: true,
      data: rates,
      baseCurrency,
      total: rates.length
    });
  } catch (error) {
    logger.error('Error fetching exchange rates:', error);
    res.status(500).json({
      error: 'Failed to fetch exchange rates',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/foreign-currency/exchange-rates
 * @desc    Manually update an exchange rate
 * @access  Private
 */
router.post('/exchange-rates', [
  body('fromCurrency').isLength({ min: 3, max: 3 }).withMessage('From currency must be 3 characters'),
  body('toCurrency').isLength({ min: 3, max: 3 }).withMessage('To currency must be 3 characters'),
  body('rate').isFloat({ min: 0.001 }).withMessage('Rate must be a positive number'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { fromCurrency, toCurrency, rate, date } = req.body;
    
    const exchangeRate = await CurrencyExchange.updateRate(
      fromCurrency,
      toCurrency,
      rate,
      date ? new Date(date) : new Date(),
      'manual',
      { updatedBy: req.user.id }
    );
    
    res.json({
      success: true,
      data: exchangeRate,
      message: `Updated exchange rate: ${fromCurrency}/${toCurrency} = ${rate}`
    });
  } catch (error) {
    logger.error('Error updating exchange rate:', error);
    res.status(500).json({
      error: 'Failed to update exchange rate',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/foreign-currency/accounts/:accountNumber/balance
 * @desc    Update foreign currency account balance
 * @access  Private
 */
router.put('/accounts/:accountNumber/balance', [
  param('accountNumber').isLength({ min: 1, max: 50 }).withMessage('Invalid account number'),
  body('balance').isNumeric().withMessage('Balance must be a number'),
  body('exchangeRate').optional().isFloat({ min: 0.001 }).withMessage('Exchange rate must be positive'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { balance, exchangeRate } = req.body;
    const accountNumber = decodeURIComponent(req.params.accountNumber);
    
    const account = await ForeignCurrencyAccount.findOne({
      accountNumber: accountNumber,
      userId: req.user.id
    });
    
    if (!account) {
      return res.status(404).json({
        error: 'Foreign currency account not found'
      });
    }
    
    await account.updateBalance(balance, exchangeRate);
    
    res.json({
      success: true,
      data: account.getSummary(),
      message: 'Account balance updated successfully'
    });
  } catch (error) {
    logger.error('Error updating account balance:', error);
    res.status(500).json({
      error: 'Failed to update account balance',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/foreign-currency/convert
 * @desc    Convert amount between currencies
 * @access  Private
 */
router.get('/convert', [
  query('amount').isFloat({ min: 0 }).withMessage('Amount must be non-negative'),
  query('fromCurrency').isLength({ min: 3, max: 3 }).withMessage('From currency must be 3 characters'),
  query('toCurrency').isLength({ min: 3, max: 3 }).withMessage('To currency must be 3 characters'),
  query('date').optional().isISO8601().withMessage('Invalid date format'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency, date } = req.query;
    
    const convertedAmount = await CurrencyExchange.convertAmount(
      parseFloat(amount),
      fromCurrency,
      toCurrency,
      date ? new Date(date) : new Date()
    );
    
    const rate = await CurrencyExchange.getRate(
      fromCurrency,
      toCurrency,
      date ? new Date(date) : new Date()
    );
    
    res.json({
      success: true,
      data: {
        originalAmount: parseFloat(amount),
        convertedAmount,
        fromCurrency,
        toCurrency,
        exchangeRate: rate,
        date: date || new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error converting currency:', error);
    res.status(500).json({
      error: 'Failed to convert currency',
      message: error.message
    });
  }
});

module.exports = router;
