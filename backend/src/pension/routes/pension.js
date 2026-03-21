const express = require('express');
const router = express.Router();
const auth = require('../../shared/middleware/auth');
const logger = require('../../shared/utils/logger');
const { PensionAccount, PensionSnapshot } = require('../models');
const PhoenixApiClient = require('../services/phoenixApiClient');
const pensionService = require('../services/pensionService');
const BankAccount = require('../../banking/models/BankAccount');

// All routes require auth
router.use(auth);

/**
 * GET /api/pension/summary
 * Aggregate totals grouped by product type
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await PensionAccount.getSummary(req.user.id);
    const totalBalance = summary.reduce((sum, group) => sum + group.totalBalance, 0);
    res.json({
      totalBalance,
      currency: 'ILS',
      groups: summary
    });
  } catch (error) {
    logger.error('Error fetching pension summary:', error);
    res.status(500).json({ error: 'Failed to fetch pension summary' });
  }
});

/**
 * GET /api/pension/accounts
 * List all pension accounts for the user
 */
router.get('/accounts', async (req, res) => {
  try {
    const { productType, provider } = req.query;
    const options = {};
    if (productType) options.productType = productType;
    if (provider) options.provider = provider;

    const accounts = await PensionAccount.findByUser(req.user.id, options);
    res.json(accounts);
  } catch (error) {
    logger.error('Error fetching pension accounts:', error);
    res.status(500).json({ error: 'Failed to fetch pension accounts' });
  }
});

/**
 * GET /api/pension/accounts/:id
 * Get detailed pension account info
 */
router.get('/accounts/:id', async (req, res) => {
  try {
    const account = await PensionAccount.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('bankAccountId', 'name bankId');

    if (!account) {
      return res.status(404).json({ error: 'Pension account not found' });
    }

    res.json(account);
  } catch (error) {
    logger.error('Error fetching pension account:', error);
    res.status(500).json({ error: 'Failed to fetch pension account' });
  }
});

/**
 * GET /api/pension/accounts/:id/snapshots
 * Get balance history for a pension account
 */
router.get('/accounts/:id/snapshots', async (req, res) => {
  try {
    const { days = 365 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const snapshots = await PensionSnapshot.getHistory(
      req.params.id,
      startDate
    );

    res.json(snapshots);
  } catch (error) {
    logger.error('Error fetching pension snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch pension snapshots' });
  }
});

/**
 * GET /api/pension/history
 * Get aggregated balance history across all pension accounts
 */
router.get('/history', async (req, res) => {
  try {
    const { days = 365 } = req.query;
    const history = await PensionSnapshot.getUserHistory(req.user.id, parseInt(days));
    res.json(history);
  } catch (error) {
    logger.error('Error fetching pension history:', error);
    res.status(500).json({ error: 'Failed to fetch pension history' });
  }
});

/**
 * POST /api/pension/sync/initiate
 * Initiate OTP for Phoenix login
 * Body: { bankAccountId, connection: 'sms'|'email', destination: '+972...' }
 */
router.post('/sync/initiate', async (req, res) => {
  try {
    const { bankAccountId, connection, destination } = req.body;

    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      userId: req.user.id,
      bankId: 'phoenix'
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Phoenix bank account not found' });
    }

    const client = new PhoenixApiClient();
    const idNumber = bankAccount.credentials.username;
    await client.initiateOtp(idNumber, connection, destination);

    res.json({ message: 'OTP sent successfully', connection });
  } catch (error) {
    logger.error('Error initiating Phoenix OTP:', error);
    res.status(500).json({ error: `Failed to initiate OTP: ${error.message}` });
  }
});

/**
 * POST /api/pension/sync/verify
 * Verify OTP and sync Phoenix data
 * Body: { bankAccountId, otp, connection, destination }
 */
router.post('/sync/verify', async (req, res) => {
  try {
    const { bankAccountId, otp, connection, destination } = req.body;

    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      userId: req.user.id,
      bankId: 'phoenix'
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Phoenix bank account not found' });
    }

    // Authenticate
    const client = new PhoenixApiClient();
    await client.verifyOtp(otp, connection, destination);

    // Fetch all products
    const allProducts = await client.getAllProducts();
    const results = await pensionService.processAllProducts(
      allProducts,
      req.user.id,
      bankAccountId
    );

    // Fetch details for savings products
    const savingsCategories = ['gemel', 'gemelInvestment', 'hishtalmut', 'lifeSaving', 'pension', 'pizuim'];
    let detailCount = 0;

    for (const category of savingsCategories) {
      const products = allProducts[category];
      if (!Array.isArray(products)) continue;

      for (const product of products) {
        const policyNum = product.policyNumber || product.policyId;
        if (!policyNum) continue;

        try {
          const detail = await client.getAccountDetail(policyNum);
          await pensionService.processAccountDetail(detail, policyNum);
          detailCount++;
        } catch (err) {
          logger.warn(`Failed to fetch detail for ${policyNum}: ${err.message}`);
          results.errors.push(`Detail: ${policyNum}: ${err.message}`);
        }
      }
    }

    // Update strategy sync
    bankAccount.updateStrategySync('phoenix-pension', true);
    await bankAccount.save();

    res.json({
      message: 'Phoenix sync completed',
      synced: results.synced,
      detailsFetched: detailCount,
      errors: results.errors
    });
  } catch (error) {
    logger.error('Error during Phoenix sync:', error);
    res.status(500).json({ error: `Phoenix sync failed: ${error.message}` });
  }
});

module.exports = router;
