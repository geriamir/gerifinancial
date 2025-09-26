const express = require('express');
const router = express.Router();
const auth = require('../../shared/middleware/auth');
const logger = require('../../shared/utils/logger');

// Import onboarding services
const creditCardDetectionService = require('../../banking/services/creditCardDetectionService');
const creditCardOnboardingService = require('../../banking/services/creditCardOnboardingService');
const BankClassificationService = require('../../banking/services/bankClassificationService');
const onboardingTransactionService = require('../services/onboardingTransactionService');
const bankAccountService = require('../../banking/services/bankAccountService');
const CreditCard = require('../../banking/models/CreditCard');

/**
 * @route   POST /api/onboarding/analyze-credit-cards
 * @desc    Analyze user's transaction history for credit card usage
 * @access  Private
 */
router.post('/analyze-credit-cards', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const { monthsBack = 6 } = req.body;
    
    logger.info(`Credit card analysis requested for user ${userId}`);
    
    // Use the existing comprehensive creditCardDetectionService
    const analysis = await creditCardDetectionService.analyzeCreditCardUsage(userId, monthsBack);
    
    // Transform the response to match frontend expectations
    res.json({
      success: true,
      data: {
        hasCreditCardActivity: analysis.hasCreditCardActivity,
        transactionCount: analysis.transactionCount,
        monthlyBreakdown: analysis.monthlyBreakdown.map(month => ({
          month: month.monthString,
          transactionCount: month.count,
          totalAmount: month.totalAmount
        })),
        averageMonthlySpending: analysis.monthlyBreakdown.length > 0 
          ? Math.round(analysis.monthlyBreakdown.reduce((sum, m) => sum + m.totalAmount, 0) / analysis.monthlyBreakdown.length)
          : 0,
        recommendation: analysis.recommendation,
        recommendationReason: analysis.recommendation === 'connect' 
          ? `${analysis.transactionCount} credit card transactions detected - connecting will improve your financial overview`
          : 'No significant credit card activity detected',
        recentTransactions: analysis.sampleTransactions,
        analyzedAt: analysis.analysisDate.toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error in analyze-credit-cards endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze credit card usage',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/onboarding/credit-card-stats
 * @desc    Get quick credit card statistics for dashboard
 * @access  Private
 */
router.get('/credit-card-stats', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    
    const stats = await creditCardDetectionService.getCreditCardStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Error in credit-card-stats endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit card statistics',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/onboarding/create-credit-cards
 * @desc    Create CreditCard instances from scraped account data
 * @access  Private
 */
router.post('/create-credit-cards', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const { bankAccountId, scrapedAccounts } = req.body;
    
    // Validate required fields
    if (!bankAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Bank account ID is required'
      });
    }
    
    if (!scrapedAccounts || !Array.isArray(scrapedAccounts)) {
      return res.status(400).json({
        success: false,
        error: 'Scraped accounts array is required'
      });
    }
    
    logger.info(`Creating credit cards for user ${userId}, bank account ${bankAccountId}`);
    
    // Create credit card instances from scraped data
    const creditCards = await creditCardOnboardingService.createCreditCardsFromScraping(
      bankAccountId,
      scrapedAccounts,
      userId
    );
    
    // Perform payment matching analysis
    console.log(`🔍 About to perform payment matching for user ${userId} with ${creditCards.length} credit cards`);
    const matchingResults = await creditCardOnboardingService.matchMonthlyPayments(
      userId,
      creditCards
    );
    console.log(`✅ Payment matching completed. Results:`, matchingResults);
    
    res.json({
      success: true,
      data: {
        creditCards: creditCards.map(card => ({
          id: card._id,
          displayName: card.displayName,
          cardNumber: card.cardNumber,
          cardType: card.cardType,
          lastFourDigits: card.lastFourDigits,
          isActive: card.isActive
        })),
        matchingResults,
        summary: {
          totalCreated: creditCards.length,
          matchingAccuracy: matchingResults.matchingAccuracy,
          highConfidenceMatches: matchingResults.matchedCards
        }
      }
    });
    
  } catch (error) {
    logger.error('Error in create-credit-cards endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create credit cards',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/onboarding/summary
 * @desc    Get comprehensive onboarding summary for user
 * @access  Private
 */
router.get('/summary', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    
    logger.info(`Getting onboarding summary for user ${userId}`);
    
    // Get credit card onboarding summary
    const creditCardSummary = await creditCardOnboardingService.getOnboardingSummary(userId);
    
    // Get credit card usage analysis
    const creditCardAnalysis = await creditCardDetectionService.getCreditCardStats(userId);
    
    // Get bank classification info
    const bankInfo = {
      checkingBanks: BankClassificationService.getCheckingBankDetails(),
      creditCardProviders: BankClassificationService.getCreditCardProviderDetails()
    };
    
    const summary = {
      user: {
        id: userId,
        hasCheckingAccount: creditCardSummary.hasCheckingAccount,
        hasCreditCards: creditCardSummary.hasCreditCards,
        creditCardCount: creditCardSummary.creditCardCount
      },
      creditCardAnalysis,
      creditCards: creditCardSummary.creditCards,
      bankInfo,
      onboardingStatus: {
        checkingAccountComplete: creditCardSummary.hasCheckingAccount,
        creditCardAnalysisComplete: true, // Always true if we got here
        creditCardSetupComplete: creditCardSummary.hasCreditCards,
        overallComplete: creditCardSummary.hasCheckingAccount && 
                        (creditCardSummary.hasCreditCards || creditCardAnalysis.recommendation === 'skip')
      },
      lastUpdated: new Date()
    };
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    logger.error('Error in onboarding summary endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get onboarding summary',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/onboarding/banks
 * @desc    Get banks filtered by type for onboarding
 * @access  Private
 */
router.get('/banks', auth, async (req, res) => {
  try {
    const { type } = req.query; // 'checking' or 'credit'
    
    let banks;
    if (type === 'checking') {
      banks = BankClassificationService.getCheckingBankDetails();
    } else if (type === 'credit') {
      banks = BankClassificationService.getCreditCardProviderDetails();
    } else {
      banks = {
        checking: BankClassificationService.getCheckingBankDetails(),
        credit: BankClassificationService.getCreditCardProviderDetails()
      };
    }
    
    res.json({
      success: true,
      data: banks
    });
    
  } catch (error) {
    logger.error('Error in onboarding banks endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get banks',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/onboarding/validate-bank
 * @desc    Validate bank selection for onboarding step
 * @access  Private
 */
router.post('/validate-bank', auth, async (req, res) => {
  try {
    const { bankId, expectedType } = req.body; // expectedType: 'checking' or 'credit'
    
    if (!bankId) {
      return res.status(400).json({
        success: false,
        error: 'Bank ID is required'
      });
    }
    
    const isSupported = BankClassificationService.isSupportedBank(bankId);
    if (!isSupported) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported bank'
      });
    }
    
    const bankType = BankClassificationService.getBankType(bankId);
    
    // Check if bank type matches expected type (if provided)
    if (expectedType && bankType !== expectedType) {
      return res.status(400).json({
        success: false,
        error: `Bank ${bankId} is not a ${expectedType} account provider`,
        actualType: bankType,
        expectedType
      });
    }
    
    res.json({
      success: true,
      data: {
        bankId,
        bankType,
        isValid: true
      }
    });
    
  } catch (error) {
    logger.error('Error in validate-bank endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate bank',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/onboarding/match-payments
 * @desc    Trigger payment matching for credit cards
 * @access  Private
 */
router.post('/match-payments', auth, async (req, res) => {
  try {
    const { userId } = req.user;
    const { creditCardIds, monthsBack = 6 } = req.body;
    
    if (!creditCardIds || !Array.isArray(creditCardIds)) {
      return res.status(400).json({
        success: false,
        error: 'Credit card IDs array is required'
      });
    }
    
    logger.info(`Payment matching requested for user ${userId}, ${creditCardIds.length} cards`);
    
    // Get credit card instances
    const creditCards = await CreditCard.find({
      _id: { $in: creditCardIds },
      userId,
      isActive: true
    });
    
    if (creditCards.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active credit cards found'
      });
    }
    
    // Perform payment matching
    const matchingResults = await creditCardOnboardingService.matchMonthlyPayments(
      userId,
      creditCards,
      monthsBack
    );
    
    res.json({
      success: true,
      data: matchingResults
    });
    
  } catch (error) {
    logger.error('Error in match-payments endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to match payments',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/onboarding/scraping-status
 * @desc    Get current scraping status for the user
 * @access  Private
 */
router.get('/scraping-status', auth, async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id || user.userId;
    
    logger.info(`Getting scraping status for user ${userId}`);
    
    // Use service layer instead of accessing data directly
    const scrapingStatus = await bankAccountService.getScrapingStatus(userId);
    
    res.json({
      success: true,
      data: scrapingStatus
    });
    
  } catch (error) {
    logger.error('Error getting scraping status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scraping status',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/onboarding/import-status/:sessionId
 * @desc    Get real-time status of transaction import
 * @access  Private
 */
router.get('/import-status/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    // Get current status
    const status = onboardingTransactionService.getScrapingStatus(sessionId);
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    logger.error('Error getting import status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get import status',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/onboarding/analyze-coverage
 * @desc    Analyze credit card transaction coverage after connecting accounts
 * @access  Private
 */
router.post('/analyze-coverage', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    
    logger.info(`Coverage analysis requested for user ${userId}`);
    
    // Use credit card detection service to analyze coverage
    const coverageAnalysis = await creditCardDetectionService.analyzeCreditCardCoverage(userId);
    
    res.json({
      success: true,
      data: coverageAnalysis
    });
    
  } catch (error) {
    logger.error('Error in analyze-coverage endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze credit card coverage',
      message: error.message
    });
  }
});

module.exports = router;
