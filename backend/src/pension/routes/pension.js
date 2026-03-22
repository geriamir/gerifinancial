const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../../shared/middleware/auth');
const logger = require('../../shared/utils/logger');
const { PensionAccount, PensionSnapshot } = require('../models');
const PhoenixApiClient = require('../services/phoenixApiClient');
const ClalApiClient = require('../services/clalApiClient');
const pensionService = require('../services/pensionService');
const clalDataMapper = require('../services/clalDataMapper');
const BankAccount = require('../../banking/models/BankAccount');

const { OTP_BANKS: OTP_PROVIDERS } = require('../../banking/constants/enums');

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
 * PATCH /api/pension/accounts/:id
 * Update editable fields on a pension account (e.g., owner, policyNickname)
 */
router.patch('/accounts/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid account ID' });
    }

    const { owner, policyNickname } = req.body;
    const update = {};
    if (owner !== undefined) update.owner = owner;
    if (policyNickname !== undefined) update.policyNickname = policyNickname;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'At least one of owner or policyNickname must be provided' });
    }

    const account = await PensionAccount.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: update },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: 'Pension account not found' });
    }

    res.json(account);
  } catch (error) {
    logger.error('Error updating pension account:', error);
    res.status(500).json({ error: 'Failed to update pension account' });
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
 * Start browser-based OTP login for a pension provider.
 * Body: { bankAccountId }
 */
router.post('/sync/initiate', async (req, res) => {
  try {
    const { bankAccountId } = req.body;

    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      userId: req.user.id,
      bankId: { $in: OTP_PROVIDERS }
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'OTP pension bank account not found' });
    }

    const client = bankAccount.bankId === 'clal' ? new ClalApiClient() : new PhoenixApiClient();
    const idNumber = bankAccount.credentials.username;
    const phoneOrEmail = bankAccount.credentials.phoneOrEmail;

    await client.startLogin(idNumber, phoneOrEmail, bankAccountId);

    res.json({ message: 'OTP sent via SMS', destination: 'SMS' });
  } catch (error) {
    logger.error('Error initiating OTP:', error);
    res.status(500).json({ error: `Failed to initiate OTP: ${error.message}` });
  }
});

/**
 * POST /api/pension/sync/verify
 * Complete OTP login and sync pension data.
 * Body: { bankAccountId, otp }
 */
router.post('/sync/verify', async (req, res) => {
  try {
    const { bankAccountId, otp } = req.body;

    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      userId: req.user.id,
      bankId: { $in: OTP_PROVIDERS }
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'OTP pension bank account not found' });
    }

    const provider = bankAccount.bankId;
    const strategyName = `${provider}-pension`;
    let results;
    let detailCount = 0;

    if (provider === 'clal') {
      const client = new ClalApiClient();
      const { portfolioData, ownerName } = await client.completeLoginAndSync(bankAccountId, otp);

      results = await clalDataMapper.processPortfolioData(
        portfolioData,
        req.user.id,
        bankAccountId,
        ownerName
      );
    } else {
      // Phoenix
      const client = new PhoenixApiClient();
      const { allProducts, details, ownerName } = await client.completeLoginAndSync(bankAccountId, otp);

      results = await pensionService.processAllProducts(
        allProducts,
        req.user.id,
        bankAccountId,
        ownerName
      );

      // Process captured detail data (Phoenix-specific)
      for (const [policyNum, detailData] of Object.entries(details)) {
        try {
          await pensionService.processAccountDetail(detailData, policyNum, req.user.id);
          detailCount++;
        } catch (err) {
          logger.warn(`Failed to process detail for ${policyNum}: ${err.message}`);
          results.errors.push(`Detail: ${policyNum}: ${err.message}`);
        }
      }
    }

    // Update strategy sync and clear stale errors
    bankAccount.updateStrategySync(strategyName, true);
    bankAccount.lastError = undefined;
    await bankAccount.save();

    res.json({
      message: `${provider} sync completed`,
      synced: results.synced,
      detailsFetched: detailCount,
      errors: results.errors
    });
  } catch (error) {
    logger.error('Error during pension sync:', error);
    try {
      const bankAccount = await BankAccount.findOne({ _id: req.body.bankAccountId, userId: req.user.id });
      if (bankAccount && bankAccount.isOtpBank()) {
        const strategyName = `${bankAccount.bankId}-pension`;
        bankAccount.updateStrategySync(strategyName, false, error.message);
        await bankAccount.save();
      }
    } catch (updateErr) {
      logger.error('Failed to update strategy sync status:', updateErr);
    }
    res.status(500).json({ error: `Pension sync failed: ${error.message}` });
  }
});

module.exports = router;
