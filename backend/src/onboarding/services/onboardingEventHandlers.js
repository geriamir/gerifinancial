const { User } = require('../../auth');
const { BankAccount, Transaction, CreditCard, scrapingEvents, creditCardDetectionService } = require('../../banking');
const logger = require('../../shared/utils/logger');

/**
 * Event handlers for onboarding-specific scraping events
 * Updates bank account scraping status for real-time progress tracking
 */
class OnboardingEventHandlers {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize and register all event handlers
   */
  initialize() {
    if (this.initialized) {
      logger.info('Onboarding event handlers already initialized');
      return;
    }

    // Listen for checking-accounts strategy start to set initial status
    scrapingEvents.on('checking-accounts:started', this.handleCheckingAccountsStarted.bind(this));

    // Listen for checking-accounts strategy completion to update scraping status
    scrapingEvents.on('checking-accounts:completed', this.handleCheckingAccountsCompleted.bind(this));

    // Listen for checking-accounts strategy failure
    scrapingEvents.on('checking-accounts:failed', this.handleCheckingAccountsFailed.bind(this));

    // Listen for credit card scraping completion to trigger matching
    scrapingEvents.on('credit-cards:completed', this.handleCreditCardsCompleted.bind(this));

    this.initialized = true;
    logger.info('✅ Onboarding event handlers initialized and listening');
  }

  /**
   * Handle checking-accounts strategy start
   * Sets initial scraping status for onboarding progress tracking
   */
  async handleCheckingAccountsStarted(data) {
    const { strategyName, bankAccountId, userId } = data;
    
    logger.info(`📬 Onboarding: Received checking-accounts started event for account ${bankAccountId}`);
    
    try {
      // Check if this is the onboarding checking account
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`User ${userId} not found`);
        return;
      }

      const isOnboardingAccount = user.onboarding?.checkingAccount?.accountId?.toString() === bankAccountId.toString();
      const isOnboardingComplete = user.onboarding?.isComplete === true;
      
      const bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) {
        logger.warn(`Bank account ${bankAccountId} not found for scraping status update`);
        return;
      }

      // Set initial scraping status in bank account
      bankAccount.scrapingStatus = {
        isActive: true,
        status: 'scraping',
        progress: 50,
        message: 'Importing transactions...',
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
        transactionsImported: 0,
        transactionsCategorized: 0
      };

      await bankAccount.save();
      
      // Only update onboarding structure if this is the onboarding checking account
      if (isOnboardingAccount && !isOnboardingComplete) {
        const updateResult = await User.findByIdAndUpdate(
          userId,
          {
            $set: {
              'onboarding.transactionImport.scrapingStatus.isActive': true,
              'onboarding.transactionImport.scrapingStatus.status': 'scraping',
              'onboarding.transactionImport.scrapingStatus.progress': 50,
              'onboarding.transactionImport.scrapingStatus.message': 'Importing transactions...',
              'onboarding.currentStep': 'transaction-import'
            }
          },
          { new: true }
        );
        logger.info(`✅ Onboarding: Updated onboarding scraping status for checking account ${bankAccountId} - isActive: ${updateResult.onboarding.transactionImport.scrapingStatus.isActive}`);
      }
      
      logger.info(`✅ Onboarding: Set initial scraping status for account ${bankAccountId}`);
    } catch (error) {
      logger.error(`❌ Onboarding: Failed to set initial scraping status for account ${bankAccountId}:`, error.message);
      logger.error(error.stack);
    }
  }

  /**
   * Handle checking-accounts strategy completion
   * Updates bank account scraping status for onboarding progress tracking
   */
  async handleCheckingAccountsCompleted(data) {
    const { strategyName, bankAccountId, userId, result } = data;
    
    logger.info(`📬 Onboarding: Received checking-accounts completion event for account ${bankAccountId}`);
    
    try {
      // Check if this is the onboarding checking account or credit card account
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`User ${userId} not found`);
        return;
      }

      const isOnboardingCheckingAccount = user.onboarding?.checkingAccount?.accountId?.toString() === bankAccountId.toString();
      const isOnboardingComplete = user.onboarding?.isComplete === true;
      const onboardingCreditCards = user.onboarding?.creditCardSetup?.creditCardAccounts || [];
      const isOnboardingCreditCard = onboardingCreditCards.some(
        cc => cc.accountId?.toString() === bankAccountId.toString()
      );
      
      // Get fresh bank account data
      const bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) {
        logger.warn(`Bank account ${bankAccountId} not found for scraping status update`);
        return;
      }

      // Extract transaction count from result
      const newTransactions = result.transactions?.newTransactions || 0;
      
      // Count categorized transactions for this user
      const categorizedCount = await Transaction.countDocuments({
        userId: userId,
        category: { $exists: true, $ne: null }
      });

      // Update bank account scraping status for onboarding UI
      bankAccount.scrapingStatus = {
        isActive: false,
        status: 'complete',
        progress: 100,
        message: `Import complete! ${newTransactions} transactions imported.`,
        startedAt: bankAccount.scrapingStatus?.startedAt || new Date(),
        lastUpdatedAt: new Date(),
        transactionsImported: newTransactions,
        transactionsCategorized: categorizedCount
      };

      await bankAccount.save();
      
      // Handle onboarding checking account completion
      if (isOnboardingCheckingAccount && !isOnboardingComplete) {
        // Run credit card detection
        logger.info(`Running credit card detection for user ${userId}`);
        const analysis = await creditCardDetectionService.analyzeCreditCardUsage(userId, 2);
        
        // Update new onboarding structure - always show detection step first
        const updateResult = await User.findByIdAndUpdate(
          userId,
          {
            $set: {
              'onboarding.transactionImport.completed': true,
              'onboarding.transactionImport.transactionsImported': newTransactions,
              'onboarding.transactionImport.completedAt': new Date(),
              'onboarding.transactionImport.scrapingStatus.isActive': false,
              'onboarding.transactionImport.scrapingStatus.status': 'complete',
              'onboarding.transactionImport.scrapingStatus.progress': 100,
              'onboarding.transactionImport.scrapingStatus.message': `Import complete! ${newTransactions} transactions imported.`,
              'onboarding.creditCardDetection.analyzed': true,
              'onboarding.creditCardDetection.analyzedAt': new Date(),
              'onboarding.creditCardDetection.transactionCount': analysis.transactionCount,
              'onboarding.creditCardDetection.recommendation': analysis.recommendation,
              'onboarding.creditCardDetection.sampleTransactions': analysis.sampleTransactions.slice(0, 5),
              'onboarding.currentStep': 'credit-card-detection' // Always show detection UI first
            },
            $addToSet: {
              'onboarding.completedSteps': 'transaction-import'
            }
          },
          { new: true }
        );
        
        logger.info(`✅ Onboarding: Credit card detection completed for user ${userId} - recommendation: ${analysis.recommendation}, currentStep: ${updateResult.onboarding.currentStep}, isActive: ${updateResult.onboarding.transactionImport.scrapingStatus.isActive}`);
        
        // Emit credit card detection completed event
        scrapingEvents.emit('credit-card-detection:completed', {
          userId,
          analysis
        });
      }
      
      // Handle onboarding credit card account completion
      if (isOnboardingCreditCard && !isOnboardingComplete) {
        logger.info(`Onboarding credit card account ${bankAccountId} scraping completed`);
        
        // Check if this is the account we're currently waiting for (tracked by processingAccountId)
        const processingAccountId = user.onboarding?.creditCardMatching?.processingAccountId?.toString();
        
        // If no processingAccountId is set, this is the first card or legacy flow - proceed with matching
        // Otherwise, only proceed if this is the account being tracked
        if (processingAccountId && processingAccountId !== bankAccountId.toString()) {
          logger.info(`Account ${bankAccountId} completed but not the currently tracked account (${processingAccountId}), skipping matching`);
          return;
        }
        
        logger.info(`Processing account ${bankAccountId} completed, running payment matching for user ${userId}`);

        // Get all credit cards for this user
        const creditCards = await CreditCard.find({
          userId,
          isActive: true
        });

        if (creditCards.length === 0) {
          logger.warn(`No credit cards found for user ${userId}, skipping matching`);
          // Still mark as complete even without credit cards
          await User.findByIdAndUpdate(userId, {
            $set: {
              'onboarding.creditCardMatching': {
                completed: true,
                completedAt: new Date(),
                matchedPayments: 0,
                unmatchedPayments: 0,
                coveragePercentage: 0
              },
              'onboarding.currentStep': 'complete',
              'onboarding.isComplete': true,
              'onboarding.completedAt': new Date()
            },
            $addToSet: {
              'onboarding.completedSteps': { $each: ['credit-card-setup', 'credit-card-matching'] }
            }
          });
          return;
        }

        // Run credit card coverage analysis (includes matching)
        const coverageAnalysis = await creditCardDetectionService.analyzeCreditCardCoverage(userId);
        
        // Mark matched transactions with their credit card
        for (const match of coverageAnalysis.matchedPayments || []) {
          await Transaction.findByIdAndUpdate(match.payment.id, {
            $set: {
              'matchedCreditCard': {
                creditCardId: match.matchedCreditCard.id,
                displayName: match.matchedCreditCard.displayName,
                matchConfidence: match.matchConfidence,
                matchedAt: new Date()
              }
            }
          });
        }

        logger.info(`✅ Onboarding: Marked ${coverageAnalysis.matchedPayments?.length || 0} transactions with matched credit cards`);

        // Only complete if 100% coverage, otherwise show matching results
        const isFullCoverage = coverageAnalysis.coveragePercentage === 100;
        const nextStep = isFullCoverage ? 'complete' : 'credit-card-matching';

        logger.info(`✅ Onboarding: Coverage ${coverageAnalysis.coveragePercentage}% - ${isFullCoverage ? 'Complete' : 'Showing matching results'}`);

        // Update onboarding structure with matching results including detailed transaction data
        await User.findByIdAndUpdate(userId, {
          $set: {
            'onboarding.creditCardMatching': {
              completed: true,
              completedAt: new Date(),
              totalCreditCardPayments: coverageAnalysis.totalCreditCardPayments,
              coveredPayments: coverageAnalysis.coveredPayments,
              uncoveredPayments: coverageAnalysis.uncoveredPayments,
              coveragePercentage: coverageAnalysis.coveragePercentage,
              matchedPayments: (coverageAnalysis.matchedPayments || []).map(match => ({
                payment: {
                  id: match.payment.id,
                  date: match.payment.date,
                  description: match.payment.description,
                  amount: match.payment.amount
                },
                matchedCreditCard: {
                  id: match.matchedCreditCard.id,
                  displayName: match.matchedCreditCard.displayName,
                  cardNumber: match.matchedCreditCard.cardNumber,
                  lastFourDigits: match.matchedCreditCard.lastFourDigits,
                  provider: match.matchedCreditCard.provider
                },
                matchedMonth: match.matchedMonth,
                matchConfidence: match.matchConfidence
              })),
              uncoveredSampleTransactions: (coverageAnalysis.uncoveredSampleTransactions || []).map(tx => ({
                date: tx.date,
                description: tx.description,
                amount: tx.amount
              })),
              connectedCreditCards: (coverageAnalysis.connectedCreditCards || []).map(cc => ({
                id: cc.id,
                displayName: cc.displayName,
                provider: cc.provider
              }))
            },
            'onboarding.currentStep': nextStep,
            'onboarding.isComplete': isFullCoverage,
            'onboarding.completedAt': isFullCoverage ? new Date() : null
          },
          $addToSet: {
            'onboarding.completedSteps': { $each: ['credit-card-setup', 'credit-card-matching'] }
          }
        });

        // Emit credit card matching completed event
        scrapingEvents.emit('credit-card-matching:completed', {
          userId,
          matchingResults: {
            coveredCount: coverageAnalysis.coveredPayments,
            uncoveredCount: coverageAnalysis.uncoveredPayments,
            coveragePercentage: coverageAnalysis.coveragePercentage,
            matchedPayments: coverageAnalysis.matchedPayments || []
          }
        });

        logger.info(`✅ Onboarding: Credit card matching completed for user ${userId} - ${coverageAnalysis.coveragePercentage}% coverage`);
      }
      
      // Update legacy onboarding status (for backward compatibility)
      await User.findByIdAndUpdate(userId, {
        $set: {
          'onboardingStatus.hasImportedTransactions': true,
          'onboardingStatus.transactionsImported': newTransactions,
          'onboardingStatus.importCompletedAt': new Date(),
          'onboardingStatus.scrapingStatus.isActive': false,
          'onboardingStatus.scrapingStatus.status': 'complete',
          'onboardingStatus.scrapingStatus.progress': 100
        },
        $addToSet: {
          'onboardingStatus.completedSteps': 'transaction-import'
        }
      });
      
      logger.info(`✅ Onboarding: Updated scraping status for account ${bankAccountId} - ${newTransactions} transactions imported, ${categorizedCount} categorized`);
    } catch (error) {
      logger.error(`❌ Onboarding: Failed to update scraping status for account ${bankAccountId}:`, error.message);
      logger.error(`❌ Onboarding: Full error details:`, error);
      logger.error(`❌ Onboarding: Stack trace:`, error.stack);
      // Don't throw - this is async post-processing
    }
  }

  /**
   * Handle credit card scraping completion
   * Triggers payment matching for onboarding credit cards
   */
  async handleCreditCardsCompleted(data) {
    const { strategyName, bankAccountId, userId, result } = data;
    
    logger.info(`📬 Onboarding: Received credit-cards completion event for account ${bankAccountId}`);
    
    try {
      // Check if this is an onboarding credit card account
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`User ${userId} not found`);
        return;
      }

      const onboardingCreditCards = user.onboarding?.creditCardSetup?.creditCardAccounts || [];
      const isOnboardingCreditCard = onboardingCreditCards.some(
        cc => cc.accountId?.toString() === bankAccountId.toString()
      );

      if (!isOnboardingCreditCard) {
        logger.info(`Credit card account ${bankAccountId} is not an onboarding account, skipping matching`);
        return;
      }

      // Check if all onboarding credit card accounts have finished scraping
      const allAccountIds = onboardingCreditCards.map(cc => cc.accountId);
      const accounts = await BankAccount.find({ _id: { $in: allAccountIds } });
      
      // Log status of each account for debugging
      logger.info(`[credit-cards handler] Checking scraping status for ${accounts.length} onboarding credit card accounts:`);
      accounts.forEach(acc => {
        logger.info(`  Account ${acc._id}: isActive=${acc.scrapingStatus?.isActive}, status=${acc.scrapingStatus?.status}`);
      });
      
      // All accounts must have status 'complete' or 'error' (not pending/scraping/null)
      const allComplete = accounts.every(acc => 
        acc.scrapingStatus?.status === 'complete' || acc.scrapingStatus?.status === 'error'
      );

      if (!allComplete) {
        logger.info(`[credit-cards handler] Not all onboarding credit card accounts have completed scraping yet - waiting for remaining accounts`);
        const pendingAccounts = accounts.filter(acc => 
          acc.scrapingStatus?.status !== 'complete' && acc.scrapingStatus?.status !== 'error'
        );
        logger.info(`[credit-cards handler] Pending accounts: ${pendingAccounts.map(a => a._id).join(', ')}`);
        return;
      }

      logger.info(`All onboarding credit card accounts complete, running payment matching for user ${userId}`);

      // Get all credit cards for this user
      const creditCards = await CreditCard.find({
        userId,
        isActive: true
      });

      if (creditCards.length === 0) {
        logger.warn(`No credit cards found for user ${userId}`);
        return;
      }

      // Run credit card coverage analysis (includes matching)
      const coverageAnalysis = await creditCardDetectionService.analyzeCreditCardCoverage(userId);
      
      // Mark matched transactions with their credit card
      for (const match of coverageAnalysis.matchedPayments || []) {
        await Transaction.findByIdAndUpdate(match.payment.id, {
          $set: {
            'matchedCreditCard': {
              creditCardId: match.matchedCreditCard.id,
              displayName: match.matchedCreditCard.displayName,
              matchConfidence: match.matchConfidence,
              matchedAt: new Date()
            }
          }
        });
      }

      logger.info(`✅ Onboarding: Marked ${coverageAnalysis.matchedPayments?.length || 0} transactions with matched credit cards`);

      // Update onboarding structure with matching results
      await User.findByIdAndUpdate(userId, {
        $set: {
          'onboarding.creditCardMatching': {
            completed: true,
            completedAt: new Date(),
            totalCreditCardPayments: coverageAnalysis.totalCreditCardPayments,
            coveredPayments: coverageAnalysis.coveredPayments,
            uncoveredPayments: coverageAnalysis.uncoveredPayments,
            coveragePercentage: coverageAnalysis.coveragePercentage,
            matchedPayments: (coverageAnalysis.matchedPayments || []).map(match => ({
              payment: {
                id: match.payment.id,
                date: match.payment.date,
                description: match.payment.description,
                amount: match.payment.amount
              },
              matchedCreditCard: {
                id: match.matchedCreditCard.id,
                displayName: match.matchedCreditCard.displayName,
                cardNumber: match.matchedCreditCard.cardNumber,
                lastFourDigits: match.matchedCreditCard.lastFourDigits,
                provider: match.matchedCreditCard.provider
              },
              matchedMonth: match.matchedMonth,
              matchConfidence: match.matchConfidence
            })),
            uncoveredSampleTransactions: (coverageAnalysis.uncoveredSampleTransactions || []).map(tx => ({
              date: tx.date,
              description: tx.description,
              amount: tx.amount
            })),
            connectedCreditCards: (coverageAnalysis.connectedCreditCards || []).map(cc => ({
              id: cc.id,
              displayName: cc.displayName,
              provider: cc.provider
            }))
          },
          'onboarding.currentStep': 'complete',
          'onboarding.isComplete': true,
          'onboarding.completedAt': new Date()
        },
        $addToSet: {
          'onboarding.completedSteps': { $each: ['credit-card-setup', 'credit-card-matching'] }
        }
      });

      // Emit credit card matching completed event
      scrapingEvents.emit('credit-card-matching:completed', {
        userId,
        matchingResults: {
          coveredCount: coverageAnalysis.coveredPayments,
          uncoveredCount: coverageAnalysis.uncoveredPayments,
          coveragePercentage: coverageAnalysis.coveragePercentage,
          matchedPayments: coverageAnalysis.matchedPayments || []
        }
      });

      logger.info(`✅ Onboarding: Credit card matching completed for user ${userId} - ${coverageAnalysis.coveragePercentage}% coverage`);

    } catch (error) {
      logger.error(`❌ Onboarding: Failed to process credit card completion for account ${bankAccountId}:`, error.message);
      logger.error(`❌ Onboarding: Full error details:`, error);
      logger.error(`❌ Onboarding: Stack trace:`, error.stack);
      // Don't throw - this is async post-processing
    }
  }

  /**
   * Handle checking-accounts strategy failure
   * Updates bank account scraping status with error
   */
  async handleCheckingAccountsFailed(data) {
    const { strategyName, bankAccountId, userId, error } = data;
    
    logger.info(`📬 Onboarding: Received checking-accounts failed event for account ${bankAccountId}`);
    
    try {
      const bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) {
        logger.warn(`Bank account ${bankAccountId} not found for scraping status update`);
        return;
      }

      // Update bank account scraping status with error
      bankAccount.scrapingStatus = {
        isActive: false,
        status: 'error',
        progress: 0,
        message: `Import failed: ${error.message || 'Unknown error'}`,
        startedAt: bankAccount.scrapingStatus?.startedAt || new Date(),
        lastUpdatedAt: new Date(),
        transactionsImported: 0,
        transactionsCategorized: 0
      };

      await bankAccount.save();
      
      logger.info(`✅ Onboarding: Updated scraping status to error for account ${bankAccountId}`);
    } catch (err) {
      logger.error(`❌ Onboarding: Failed to update error status for account ${bankAccountId}:`, err.message);
    }
  }
}

// Export singleton instance
const onboardingEventHandlers = new OnboardingEventHandlers();

module.exports = onboardingEventHandlers;
