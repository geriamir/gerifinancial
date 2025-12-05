const express = require('express');
const router = express.Router();
const auth = require('../../shared/middleware/auth');
const logger = require('../../shared/utils/logger');
const { User } = require('../../auth');
const { bankAccountService } = require('../../banking');

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
    
    logger.info(`Adding credit card account for onboarding - User: ${userId}, Bank: ${bankId}`);
    
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
    
    // Add to onboarding credit card accounts array
    // Move to credit-card-matching step but mark as processing (not completed yet)
    await User.findByIdAndUpdate(userId, {
      $push: {
        'onboarding.creditCardSetup.creditCardAccounts': {
          accountId: bankAccount._id,
          connectedAt: new Date(),
          bankId: bankId,
          displayName: displayName || bankId
        }
      },
      $set: {
        'onboarding.currentStep': 'credit-card-matching',
        'onboarding.creditCardMatching.completed': false, // Mark as not completed
        'onboarding.creditCardMatching.processingAccountId': bankAccount._id, // Track which account is being processed
        'onboarding.creditCardMatching.completedAt': null
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
    
    const user = await User.findById(userId)
      .populate('onboarding.checkingAccount.accountId')
      .populate('onboarding.creditCardSetup.creditCardAccounts.accountId');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
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
