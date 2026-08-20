const express = require('express');
const router = express.Router();
const auth = require('../../shared/middleware/auth');
const logger = require('../../shared/utils/logger');
const { User } = require('../../auth');
const { bankAccountService, Transaction, scrapingEvents } = require('../../banking');
const onboardingCreditCardDetectionService = require('../services/onboardingCreditCardDetectionService');
const {
  ISRACARD_BANK_ID,
  isValidCard6Digits
} = require('../../banking/utils/scraperCredentials');

/**
 * @route   POST /api/onboarding/checking-account
 * @desc    Add main checking account during onboarding
 * @access  Private
 */
router.post('/checking-account', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const { bankId, credentials, displayName } = req.body;
    
    logger.info(`Adding checking account for onboarding - User: ${userId}, Bank: ${bankId}`);
    
    // Validate required fields
    if (!bankId || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'Bank ID and credentials are required'
      });
    }
    // Create the bank account using the existing service
    const bankAccount = await bankAccountService.create(userId, {
      bankId,
      name: displayName || bankId,
      username: credentials.username,
      password: credentials.password
    });
    
    // Update onboarding structure with checking account details
    // Initialize transaction import status to ensure structure exists for event handler
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'onboarding.startedAt': new Date(), // Mark onboarding as started
          'onboarding.checkingAccount': {
            connected: true,
            accountId: bankAccount._id,
            connectedAt: new Date(),
            bankId: bankId
          },
          'onboarding.currentStep': 'transaction-import',
          'onboarding.transactionImport.scrapingStatus.isActive': true,
          'onboarding.transactionImport.scrapingStatus.status': 'scraping',
          'onboarding.transactionImport.scrapingStatus.progress': 50,
          'onboarding.transactionImport.scrapingStatus.message': 'Importing transactions...'
        },
        $addToSet: {
          'onboarding.completedSteps': 'checking-account'
        }
      },
      { new: true }
    );
    
    logger.info(`✅ Onboarding: Initial status set for user ${userId} - isActive: ${updatedUser.onboarding.transactionImport.scrapingStatus.isActive}, progress: ${updatedUser.onboarding.transactionImport.scrapingStatus.progress}`);
    
    logger.info(`✅ Onboarding: Checking account ${bankAccount._id} connected for user ${userId}`);
    
    res.json({
      success: true,
      data: {
        account: bankAccount,
        onboardingStep: 'transaction-import'
      }
    });
    
  } catch (error) {
    logger.error('Error adding checking account during onboarding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add checking account',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/onboarding/credit-card-account
 * @desc    Add credit card account during onboarding
 * @access  Private
 */
router.post('/credit-card-account', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const { bankId, credentials, displayName } = req.body;
    const accountName = typeof displayName === 'string' ? displayName.trim() : '';
    
    logger.info(`Adding credit card account for onboarding - User: ${userId}, Bank: ${bankId}`);
    
    // Validate required fields
    if (!bankId || !credentials || !accountName) {
      return res.status(400).json({
        success: false,
        error: 'Account name, bank ID and credentials are required'
      });
    }
    if (!credentials.username || !credentials.password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }
    if (bankId === ISRACARD_BANK_ID && !isValidCard6Digits(credentials.card6Digits)) {
      return res.status(400).json({
        success: false,
        error: 'Last 6 card digits must be exactly 6 digits'
      });
    }
    
    // Create the bank account using the existing service
    const bankAccount = await bankAccountService.create(userId, {
      bankId,
      name: accountName,
      username: credentials.username,
      password: credentials.password,
      card6Digits: credentials.card6Digits
    });
    
    // Add to onboarding credit card accounts array
    // Move to credit-card-matching step but mark as processing (not completed yet)
    await User.findByIdAndUpdate(userId, {
      $push: {
        'onboarding.creditCardSetup.creditCardAccounts': {
          accountId: bankAccount._id,
          connectedAt: new Date(),
          bankId: bankId,
          displayName: accountName
        }
      },
      $set: {
        'onboarding.currentStep': 'credit-card-matching',
        'onboarding.creditCardMatching.completed': false, // Mark as not completed
        'onboarding.creditCardMatching.processingAccountId': bankAccount._id, // Track which account is being processed
        'onboarding.creditCardMatching.completedAt': null,
        'onboarding.creditCardMatching.error': null,
        'onboarding.creditCardMatching.failedAccount': null
      }
    });
    
    logger.info(`✅ Onboarding: Credit card account ${bankAccount._id} added for user ${userId}, waiting for scraping and matching`);
    
    // Note: Credit card matching will be triggered automatically after scraping completes
    // via the credit-cards:completed event in onboardingEventHandlers
    
    res.json({
      success: true,
      data: {
        account: bankAccount,
        onboardingStep: 'credit-card-matching',
        processingAccountId: bankAccount._id,
        message: 'Credit card account added. Transactions will be imported and matched automatically.'
      }
    });
    
  } catch (error) {
    logger.error('Error adding credit card account during onboarding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add credit card account',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/onboarding/credit-card-account/:accountId/credentials
 * @desc    Repair a failed onboarding credit card account and retry its import
 * @access  Private
 */
router.put('/credit-card-account/:accountId/credentials', auth, async (req, res) => {
  const userId = req.user._id || req.user.userId;
  const { accountId } = req.params;
  const { username, password, card6Digits } = req.body;

  try {
    const user = await User.findById(userId);
    const account = user?.onboarding?.creditCardSetup?.creditCardAccounts?.find(
      candidate => candidate.accountId?.toString() === accountId
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Credit card account not found in onboarding'
      });
    }
    if (user.onboarding?.creditCardMatching?.failedAccount?.accountId?.toString() !== accountId) {
      return res.status(409).json({
        success: false,
        error: 'Credit card account is not awaiting repair'
      });
    }
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }
    if (account.bankId === ISRACARD_BANK_ID && !isValidCard6Digits(card6Digits)) {
      return res.status(400).json({
        success: false,
        error: 'Last 6 card digits must be exactly 6 digits'
      });
    }

    await User.findByIdAndUpdate(userId, {
      $set: {
        'onboarding.currentStep': 'credit-card-matching',
        'onboarding.creditCardMatching.completed': false,
        'onboarding.creditCardMatching.completedAt': null,
        'onboarding.creditCardMatching.error': null,
        'onboarding.creditCardMatching.failedAccount': null,
        'onboarding.creditCardMatching.processingAccountId': accountId
      }
    });

    try {
      const bankAccount = await bankAccountService.updateCredentials(
        accountId,
        userId,
        { username, password, card6Digits },
        { requireQueuedSync: true }
      );

      return res.json({
        success: true,
        data: {
          accountId: bankAccount._id,
          message: 'Credentials updated. Retrying the card import.'
        }
      });
    } catch (error) {
      const displayName = account.displayName || account.bankId || 'Credit card account';
      const matchingError = `${displayName} still needs attention. ${error.message}`;

      await User.findByIdAndUpdate(userId, {
        $set: {
          'onboarding.creditCardMatching.completed': true,
          'onboarding.creditCardMatching.completedAt': new Date(),
          'onboarding.creditCardMatching.error': matchingError,
          'onboarding.creditCardMatching.failedAccount': {
            accountId,
            bankId: account.bankId,
            displayName,
            error: error.message
          }
        },
        $unset: {
          'onboarding.creditCardMatching.processingAccountId': ''
        }
      });

      const queueFailed = error.code === 'SYNC_QUEUE_FAILED';
      return res.status(queueFailed ? 503 : 400).json({
        success: false,
        error: queueFailed
          ? 'Credentials updated, but the card import retry could not be started'
          : 'Failed to update credit card credentials',
        details: error.message
      });
    }
  } catch (error) {
    logger.error(`Failed to repair onboarding credit card account ${accountId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to repair credit card account'
    });
  }
});

/**
 * @route   DELETE /api/onboarding/credit-card-account/:accountId
 * @desc    Remove a failed credit card account from onboarding
 * @access  Private
 */
router.delete('/credit-card-account/:accountId', auth, async (req, res) => {
  const userId = req.user._id || req.user.userId;
  const { accountId } = req.params;

  try {
    const user = await User.findById(userId);
    const account = user?.onboarding?.creditCardSetup?.creditCardAccounts?.find(
      candidate => candidate.accountId?.toString() === accountId
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Credit card account not found in onboarding'
      });
    }
    if (user.onboarding?.creditCardMatching?.failedAccount?.accountId?.toString() !== accountId) {
      return res.status(409).json({
        success: false,
        error: 'Credit card account is not awaiting removal'
      });
    }

    const removed = await bankAccountService.delete(accountId, userId);
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Credit card account not found'
      });
    }

    const matching = user.onboarding.creditCardMatching;
    await User.findByIdAndUpdate(userId, {
      $pull: {
        'onboarding.creditCardSetup.creditCardAccounts': { accountId }
      },
      $set: {
        'onboarding.currentStep': 'credit-card-matching',
        'onboarding.creditCardMatching.completed': true,
        'onboarding.creditCardMatching.completedAt': new Date(),
        'onboarding.creditCardMatching.error': null,
        'onboarding.creditCardMatching.failedAccount': null
      },
      $unset: {
        'onboarding.creditCardMatching.processingAccountId': ''
      }
    });

    scrapingEvents.emit('credit-card-matching:completed', {
      userId,
      matchingResults: {
        coveredCount: matching.coveredPayments,
        uncoveredCount: matching.uncoveredPayments,
        coveragePercentage: matching.coveragePercentage
      }
    });

    return res.json({
      success: true,
      data: {
        accountId,
        message: 'Credit card account removed.'
      }
    });
  } catch (error) {
    logger.error(`Failed to remove onboarding credit card account ${accountId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove credit card account'
    });
  }
});

/**
 * @route   POST /api/onboarding/proceed-to-credit-card-setup
 * @desc    Move from detection to setup step
 * @access  Private
 */
router.post('/proceed-to-credit-card-setup', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    
    logger.info(`User ${userId} proceeding to credit card setup`);
    
    // Update step to credit-card-setup
    await User.findByIdAndUpdate(userId, {
      $set: {
        'onboarding.currentStep': 'credit-card-setup'
      },
      $addToSet: {
        'onboarding.completedSteps': 'credit-card-detection'
      }
    });
    
    logger.info(`✅ Onboarding: User ${userId} moved to credit-card-setup`);
    
    res.json({
      success: true,
      data: {
        currentStep: 'credit-card-setup'
      }
    });
    
  } catch (error) {
    logger.error('Error proceeding to credit card setup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to proceed to credit card setup',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/onboarding/skip-credit-cards
 * @desc    Skip credit card setup during onboarding
 * @access  Private
 */
router.post('/skip-credit-cards', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    
    logger.info(`User ${userId} skipping credit card setup`);
    
    // Mark credit card setup as skipped and complete onboarding
    await User.findByIdAndUpdate(userId, {
      $set: {
        'onboarding.creditCardSetup.skipped': true,
        'onboarding.creditCardSetup.skippedAt': new Date(),
        'onboarding.currentStep': 'complete',
        'onboarding.isComplete': true,
        'onboarding.completedAt': new Date()
      },
      $addToSet: {
        'onboarding.completedSteps': 'credit-card-setup'
      }
    });
    
    logger.info(`✅ Onboarding: User ${userId} completed onboarding (credit cards skipped)`);
    
    res.json({
      success: true,
      data: {
        onboardingComplete: true,
        creditCardsSkipped: true
      }
    });
    
  } catch (error) {
    logger.error('Error skipping credit cards during onboarding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to skip credit cards',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/onboarding/complete-onboarding
 * @desc    Complete onboarding (with or without full credit card coverage)
 * @access  Private
 */
router.post('/complete-onboarding', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    
    logger.info(`User ${userId} completing onboarding`);
    
    // Mark onboarding as complete
    await User.findByIdAndUpdate(userId, {
      $set: {
        'onboarding.currentStep': 'complete',
        'onboarding.isComplete': true,
        'onboarding.completedAt': new Date()
      },
      $addToSet: {
        'onboarding.completedSteps': { $each: ['credit-card-setup', 'credit-card-matching'] }
      }
    });
    
    logger.info(`✅ Onboarding: User ${userId} completed onboarding`);
    
    res.json({
      success: true,
      data: {
        onboardingComplete: true
      }
    });
    
  } catch (error) {
    logger.error('Error completing onboarding:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete onboarding',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/onboarding/status
 * @desc    Get complete onboarding status
 * @access  Private
 */
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    
    let user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const checkingAccountId =
      user.onboarding?.checkingAccount?.accountId?._id ||
      user.onboarding?.checkingAccount?.accountId;
    let importCountVerified = false;

    await user.populate('onboarding.checkingAccount.accountId');
    await user.populate('onboarding.creditCardSetup.creditCardAccounts.accountId');

    if (
      user.onboarding?.transactionImport?.completed &&
      !user.onboarding.transactionImport.countVerifiedAt &&
      checkingAccountId
    ) {
      const importedTransactions = await Transaction.countDocuments({
        userId,
        accountId: checkingAccountId
      });
      const storedTransactions = user.onboarding.transactionImport.transactionsImported || 0;

      const countVerifiedAt = new Date();
      const importUpdate = {
        'onboarding.transactionImport.countVerifiedAt': countVerifiedAt
      };

      if (importedTransactions > storedTransactions) {
        logger.info(
          `Refreshing onboarding import count for user ${userId}: ` +
          `${storedTransactions} -> ${importedTransactions}`
        );
        importUpdate['onboarding.transactionImport.transactionsImported'] = importedTransactions;
      }

      await User.updateOne(
        { _id: userId },
        { $set: importUpdate }
      );
      importCountVerified = true;
    }

    const detectionRefreshed = await onboardingCreditCardDetectionService.refreshIfStale(user);
    if (importCountVerified || detectionRefreshed) {
      user = await User.findById(userId)
        .populate('onboarding.checkingAccount.accountId')
        .populate('onboarding.creditCardSetup.creditCardAccounts.accountId');
    }
    
    // Transform old credit card matching data to new format if needed
    let onboardingData = user.onboarding.toObject ? user.onboarding.toObject() : user.onboarding;
    
    // Check if we have old format data (matchedPayments is a number instead of array)
    if (onboardingData.creditCardMatching && 
        typeof onboardingData.creditCardMatching.matchedPayments === 'number') {
      
      logger.info(`Transforming old credit card matching data format for user ${userId}`);
      
      // Get transactions to populate the array
      const { Transaction, CreditCard } = require('../../banking');
      
      const matchedTransactions = onboardingData.creditCardMatching.matchedTransactions || [];
      const matchedPaymentsArray = [];
      const uncoveredSampleTransactions = onboardingData.creditCardMatching.uncoveredTransactions || [];
      
      // Transform matched transactions to new format
      for (const mt of matchedTransactions) {
        try {
          const transaction = await Transaction.findById(mt.transactionId);
          const creditCard = await CreditCard.findById(mt.creditCardId);
          
          if (transaction && creditCard) {
            matchedPaymentsArray.push({
              payment: {
                id: transaction._id.toString(),
                date: transaction.date,
                description: transaction.description,
                amount: transaction.amount
              },
              matchedCreditCard: {
                id: creditCard._id.toString(),
                displayName: creditCard.displayName,
                cardNumber: creditCard.cardNumber || '',
                lastFourDigits: creditCard.lastFourDigits || '',
                provider: creditCard.provider || creditCard.bankId
              },
              matchedMonth: mt.matchedMonth || transaction.date.toISOString().substring(0, 7),
              matchConfidence: mt.matchConfidence || 95
            });
          }
        } catch (err) {
          logger.warn(`Failed to transform matched transaction ${mt.transactionId}:`, err.message);
        }
      }
      
      // Get connected credit cards
      const connectedCreditCards = await CreditCard.find({ userId, isActive: true });
      
      // Update the matching data with new format
      onboardingData.creditCardMatching = {
        ...onboardingData.creditCardMatching,
        totalCreditCardPayments: onboardingData.creditCardMatching.matchedPayments + onboardingData.creditCardMatching.unmatchedPayments,
        coveredPayments: onboardingData.creditCardMatching.matchedPayments,
        uncoveredPayments: onboardingData.creditCardMatching.unmatchedPayments,
        matchedPayments: matchedPaymentsArray,
        uncoveredSampleTransactions,
        connectedCreditCards: connectedCreditCards.map(cc => ({
          id: cc._id.toString(),
          displayName: cc.displayName,
          provider: cc.provider || cc.bankId
        }))
      };
      
      logger.info(`✅ Transformed ${matchedPaymentsArray.length} matched payments for user ${userId}`);
    }
    
    // Return complete onboarding status
    res.json({
      success: true,
      data: onboardingData
    });
    
  } catch (error) {
    logger.error('Error getting onboarding status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get onboarding status',
      message: error.message
    });
  }
});

module.exports = router;
