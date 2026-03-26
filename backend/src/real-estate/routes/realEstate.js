const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../../shared/middleware/auth');
const logger = require('../../shared/utils/logger');
const realEstateService = require('../services/realEstateService');
const realEstateTransactionService = require('../services/realEstateTransactionService');

router.use(auth);

// Validate ObjectId middleware
const validateId = (paramName) => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
    return res.status(400).json({ error: `Invalid ${paramName}` });
  }
  next();
};

/**
 * GET /api/real-estate/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const displayCurrency = req.query.currency || 'USD';
    const summary = await realEstateService.getSummary(req.user.id, displayCurrency);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching real estate summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/**
 * GET /api/real-estate
 */
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    const investments = await realEstateService.getAll(req.user.id, { type, status });
    res.json(investments);
  } catch (error) {
    logger.error('Error fetching real estate investments:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
});

/**
 * POST /api/real-estate
 */
router.post('/', async (req, res) => {
  try {
    const investment = await realEstateService.create(req.user.id, req.body);
    res.status(201).json(investment);
  } catch (error) {
    logger.error('Error creating real estate investment:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An investment with this name already exists' });
    }
    res.status(500).json({ error: `Failed to create investment: ${error.message}` });
  }
});

/**
 * GET /api/real-estate/:id
 */
router.get('/:id', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.getById(req.params.id, req.user.id);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error fetching real estate investment:', error);
    res.status(500).json({ error: 'Failed to fetch investment' });
  }
});

/**
 * PUT /api/real-estate/:id
 */
router.put('/:id', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.update(req.params.id, req.user.id, req.body);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error updating real estate investment:', error);
    res.status(500).json({ error: 'Failed to update investment' });
  }
});

/**
 * DELETE /api/real-estate/:id
 */
router.delete('/:id', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.delete(req.params.id, req.user.id);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.json({ message: 'Investment deleted' });
  } catch (error) {
    logger.error('Error deleting real estate investment:', error);
    res.status(500).json({ error: 'Failed to delete investment' });
  }
});

// --- Installments ---

/**
 * POST /api/real-estate/:id/installments
 */
router.post('/:id/installments', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.addInstallment(req.params.id, req.user.id, req.body);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.status(201).json(investment);
  } catch (error) {
    logger.error('Error adding installment:', error);
    res.status(500).json({ error: 'Failed to add installment' });
  }
});

/**
 * PUT /api/real-estate/:id/installments/:installmentId
 */
router.put('/:id/installments/:installmentId', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.updateInstallment(
      req.params.id, req.user.id, req.params.installmentId, req.body
    );
    if (!investment) {
      return res.status(404).json({ error: 'Investment or installment not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error updating installment:', error);
    res.status(500).json({ error: 'Failed to update installment' });
  }
});

/**
 * DELETE /api/real-estate/:id/installments/:installmentId
 */
router.delete('/:id/installments/:installmentId', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.deleteInstallment(
      req.params.id, req.user.id, req.params.installmentId
    );
    if (!investment) {
      return res.status(404).json({ error: 'Investment or installment not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error deleting installment:', error);
    res.status(500).json({ error: 'Failed to delete installment' });
  }
});

/**
 * POST /api/real-estate/:id/installments/:installmentId/link-transaction/:transactionId
 */
router.post('/:id/installments/:installmentId/link-transaction/:transactionId', validateId('id'), validateId('transactionId'), async (req, res) => {
  try {
    const investment = await realEstateService.linkTransactionToInstallment(
      req.params.id, req.user.id, req.params.installmentId, req.params.transactionId
    );
    if (!investment) {
      return res.status(404).json({ error: 'Investment or installment not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error linking transaction to installment:', error);
    res.status(500).json({ error: 'Failed to link transaction' });
  }
});

/**
 * DELETE /api/real-estate/:id/installments/:installmentId/link-transaction/:transactionId
 */
router.delete('/:id/installments/:installmentId/link-transaction/:transactionId', validateId('id'), validateId('transactionId'), async (req, res) => {
  try {
    const investment = await realEstateService.unlinkTransactionFromInstallment(
      req.params.id, req.user.id, req.params.installmentId, req.params.transactionId
    );
    if (!investment) {
      return res.status(404).json({ error: 'Investment or installment not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error unlinking transaction from installment:', error);
    res.status(500).json({ error: 'Failed to unlink transaction' });
  }
});

// --- Rental Income ---

/**
 * POST /api/real-estate/:id/rental-income
 */
router.post('/:id/rental-income', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.addRentalIncome(req.params.id, req.user.id, req.body);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.status(201).json(investment);
  } catch (error) {
    logger.error('Error adding rental income:', error);
    res.status(500).json({ error: 'Failed to add rental income' });
  }
});

/**
 * PUT /api/real-estate/:id/rental-income/:incomeId
 */
router.put('/:id/rental-income/:incomeId', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.updateRentalIncome(
      req.params.id, req.user.id, req.params.incomeId, req.body
    );
    if (!investment) {
      return res.status(404).json({ error: 'Investment or income record not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error updating rental income:', error);
    res.status(500).json({ error: 'Failed to update rental income' });
  }
});

// --- Sale (Flip) ---

/**
 * POST /api/real-estate/:id/sell
 */
router.post('/:id/sell', validateId('id'), async (req, res) => {
  try {
    const { salePrice, saleDate, saleExpenses } = req.body;
    if (!salePrice || salePrice <= 0) {
      return res.status(400).json({ error: 'Sale price is required and must be positive' });
    }
    const investment = await realEstateService.markSold(req.params.id, req.user.id, {
      salePrice, saleDate, saleExpenses
    });
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error marking investment as sold:', error);
    res.status(500).json({ error: 'Failed to mark as sold' });
  }
});

// --- Transactions ---

/**
 * GET /api/real-estate/:id/transactions
 */
router.get('/:id/transactions', validateId('id'), async (req, res) => {
  try {
    const transactions = await realEstateTransactionService.getTransactions(req.params.id, req.user.id);
    res.json(transactions);
  } catch (error) {
    logger.error('Error fetching investment transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * POST /api/real-estate/:id/transactions/:transactionId/tag
 */
router.post('/:id/transactions/:transactionId/tag', validateId('id'), validateId('transactionId'), async (req, res) => {
  try {
    const transaction = await realEstateTransactionService.tagTransaction(
      req.params.id, req.user.id, req.params.transactionId
    );
    res.json(transaction);
  } catch (error) {
    logger.error('Error tagging transaction:', error);
    res.status(500).json({ error: `Failed to tag transaction: ${error.message}` });
  }
});

/**
 * DELETE /api/real-estate/:id/transactions/:transactionId/tag
 */
router.delete('/:id/transactions/:transactionId/tag', validateId('id'), validateId('transactionId'), async (req, res) => {
  try {
    const transaction = await realEstateTransactionService.untagTransaction(
      req.params.id, req.user.id, req.params.transactionId
    );
    res.json(transaction);
  } catch (error) {
    logger.error('Error untagging transaction:', error);
    res.status(500).json({ error: `Failed to untag transaction: ${error.message}` });
  }
});

/**
 * POST /api/real-estate/:id/transactions/bulk-tag
 */
router.post('/:id/transactions/bulk-tag', validateId('id'), async (req, res) => {
  try {
    const { transactionIds } = req.body;
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'transactionIds array is required' });
    }
    const result = await realEstateTransactionService.bulkTagTransactions(
      req.params.id, req.user.id, transactionIds
    );
    res.json(result);
  } catch (error) {
    logger.error('Error bulk tagging transactions:', error);
    res.status(500).json({ error: 'Failed to bulk tag transactions' });
  }
});

// --- Bank Account Linking ---

/**
 * POST /api/real-estate/:id/link-account
 */
router.post('/:id/link-account', validateId('id'), async (req, res) => {
  try {
    const { bankAccountId } = req.body;
    if (!bankAccountId || !mongoose.Types.ObjectId.isValid(bankAccountId)) {
      return res.status(400).json({ error: 'Valid bankAccountId is required' });
    }
    const investment = await realEstateService.linkBankAccount(req.params.id, req.user.id, bankAccountId);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    // Auto-tag existing transactions from the linked account
    const result = await realEstateTransactionService.autoTagLinkedAccountTransactions(
      req.params.id, req.user.id
    );

    res.json({ investment, autoTagged: result.tagged });
  } catch (error) {
    logger.error('Error linking bank account:', error);
    res.status(500).json({ error: 'Failed to link bank account' });
  }
});

/**
 * DELETE /api/real-estate/:id/link-account
 */
router.delete('/:id/link-account', validateId('id'), async (req, res) => {
  try {
    const investment = await realEstateService.unlinkBankAccount(req.params.id, req.user.id);
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.json(investment);
  } catch (error) {
    logger.error('Error unlinking bank account:', error);
    res.status(500).json({ error: 'Failed to unlink bank account' });
  }
});

module.exports = router;
