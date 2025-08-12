const dataSyncService = require('./dataSyncService');
const BankAccount = require('../models/BankAccount');
const User = require('../models/User');
const logger = require('../utils/logger');

class OnboardingTransactionService {
  constructor() {
    // Map of active scraping sessions
    this.activeSessions = new Map();
  }

  /**
   * Initiate real-time scraping for onboarding
   * Returns a session ID for tracking progress
   */
  async initiateOnboardingScraping(userId, bankAccountId) {
    // Use atomic database operation to prevent race conditions
    const sessionId = `onboarding_${userId}_${Date.now()}`;
    
    const user = await User.findOneAndUpdate(
      { 
        _id: userId, 
        'onboardingStatus.scrapingStatus.isActive': { $ne: true } // Only update if not already active
      },
      { 
        $set: { 
          'onboardingStatus.scrapingStatus.isActive': true,
          'onboardingStatus.scrapingStatus.status': 'connecting',
          'onboardingStatus.scrapingStatus.progress': 0,
          'onboardingStatus.scrapingStatus.sessionId': sessionId,
          'onboardingStatus.scrapingStatus.message': 'Starting transaction import...'
        } 
      },
      { new: true }
    );

    if (!user) {
      // User already has an active scraping session or doesn't exist
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }
      
      const existingSessionId = existingUser.onboardingStatus.scrapingStatus.sessionId;
      if (existingSessionId && existingUser.onboardingStatus.scrapingStatus.isActive) {
        logger.warn(`User ${userId} already has an active scraping session ${existingSessionId}`);
        return { sessionId: existingSessionId };
      }
      
      throw new Error('Failed to start scraping session - user may have active session');
    }
    
    try {
      // Get bank account
      const bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) {
        // Reset user status on error
        await User.findByIdAndUpdate(userId, {
          $set: { 
            'onboardingStatus.scrapingStatus.isActive': false,
            'onboardingStatus.scrapingStatus.status': 'error',
            'onboardingStatus.scrapingStatus.error': 'Bank account not found'
          }
        });
        throw new Error('Bank account not found');
      }

      // Initialize session tracking
      this.activeSessions.set(sessionId, {
        userId,
        bankAccountId,
        status: 'connecting',
        progress: 0,
        stage: 'connecting',
        message: 'Connecting to your bank...',
        transactionsImported: 0,
        transactionsCategorized: 0,
        startedAt: new Date()
      });

      // Start the scraping process asynchronously
      this.performOnboardingScraping(sessionId, bankAccount).catch(error => {
        logger.error(`Onboarding scraping failed for session ${sessionId}:`, error);
        this.updateSessionStatus(sessionId, {
          status: 'error',
          stage: 'error',
          message: 'Import failed',
          error: error.message
        });
      });

      logger.info(`Started onboarding scraping session ${sessionId} for user ${userId}`);
      return { sessionId };

    } catch (error) {
      // Clean up session on error
      this.activeSessions.delete(sessionId);
      
      // Reset user status
      await User.findByIdAndUpdate(userId, {
        $set: { 
          'onboardingStatus.scrapingStatus.isActive': false,
          'onboardingStatus.scrapingStatus.status': 'error',
          'onboardingStatus.scrapingStatus.error': error.message
        }
      });
      
      logger.error(`Failed to initiate onboarding scraping for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get current status of an onboarding scraping session
   */
  getScrapingStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { status: 'not_found', message: 'Scraping session not found' };
    }
    
    return {
      status: session.status,
      stage: session.stage,
      progress: session.progress,
      message: session.message,
      transactionsImported: session.transactionsImported,
      transactionsCategorized: session.transactionsCategorized,
      error: session.error,
      startedAt: session.startedAt
    };
  }

  /**
   * Perform the actual scraping process with real-time updates
   */
  async performOnboardingScraping(sessionId, bankAccount) {
    try {
      // Stage 1: Connect and login
      await this.updateSessionStatus(sessionId, {
        status: 'connecting',
        stage: 'connecting',
        progress: 5,
        message: 'Logging into your bank account...'
      });

      // Stage 2: Scraping transactions, investments, and portfolios
      await this.updateSessionStatus(sessionId, {
        status: 'scraping',
        stage: 'scraping',
        progress: 15,
        message: 'Importing and processing data from the last 6 months...'
      });

      // Perform comprehensive data sync using dataSyncService
      // This includes scraping, processing, AND categorization
      const syncResult = await dataSyncService.syncBankAccountData(bankAccount, {
        verbose: true,
        onProgress: (progressInfo) => {
          // Update progress during scraping if supported
          const progress = Math.min(15 + (progressInfo.percentage || 0) * 0.8, 95); // 15-95%
          this.updateSessionStatus(sessionId, {
            progress,
            message: `Processing ${progressInfo.imported || 0} items...`
          });
        }
      });

      // Extract counts from comprehensive sync result
      const newTransactions = syncResult.transactions?.newTransactions || 0;
      const newInvestments = syncResult.investments?.newInvestments || 0;
      const newPortfolios = syncResult.portfolios?.newPortfolios || 0;

      // Query MongoDB for categorized transactions count
      const { Transaction } = require('../models');
      const categorizedCount = await Transaction.countDocuments({
        userId: bankAccount.userId,
        category: { $exists: true, $ne: null }
      });

      // Stage 3: Complete
      await this.updateSessionStatus(sessionId, {
        status: 'complete',
        stage: 'complete',
        progress: 100,
        transactionsImported: newTransactions,
        transactionsCategorized: categorizedCount,
        message: 'Import complete! Your financial data is ready.',
        completedAt: new Date()
      });

      // Update user onboarding status
      await this.updateUserScrapingStatus(bankAccount.userId, {
        isScrapingActive: false,
        scrapingStatus: 'complete',
        scrapingProgress: 100,
        hasImportedTransactions: true,
        transactionsImported: newTransactions,
        transactionsCategorized: categorizedCount,
        importCompletedAt: new Date()
      });

      // Clean up session after a delay to allow frontend to get final status
      setTimeout(() => {
        this.activeSessions.delete(sessionId);
      }, 30000); // 30 seconds

      logger.info(`Completed onboarding scraping session ${sessionId} - imported ${newTransactions} transactions, ${newInvestments} investments, ${newPortfolios} portfolios, ${categorizedCount} transactions categorized`);
      
      return {
        success: true,
        transactionsImported: newTransactions,
        transactionsCategorized: categorizedCount,
        investmentsImported: newInvestments,
        portfoliosImported: newPortfolios
      };

    } catch (error) {
      await this.updateSessionStatus(sessionId, {
        status: 'error',
        stage: 'error',
        progress: 0,
        message: 'Import failed',
        error: error.message
      });

      // Update user status
      await this.updateUserScrapingStatus(bankAccount.userId, {
        isScrapingActive: false,
        scrapingStatus: 'error',
        scrapingError: error.message
      });

      throw error;
    }
  }

  /**
   * Update session status and notify user
   */
  async updateSessionStatus(sessionId, updates) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    // Update session
    Object.assign(session, updates, { lastUpdated: new Date() });

    // Update user record
    await this.updateUserScrapingStatus(session.userId, {
      scrapingStatus: updates.status || session.status,
      scrapingProgress: updates.progress || session.progress,
      scrapingMessage: updates.message || session.message,
      scrapingError: updates.error
    });

    logger.info(`Updated scraping session ${sessionId}: ${updates.message || session.message} (${session.progress}%)`);
  }

  /**
   * Update user's scraping status in database
   */
  async updateUserScrapingStatus(userId, statusUpdate) {
    try {
      const updateData = {};
      
      if (statusUpdate.isScrapingActive !== undefined) {
        updateData['onboardingStatus.scrapingStatus.isActive'] = statusUpdate.isScrapingActive;
      }
      if (statusUpdate.scrapingStatus) {
        updateData['onboardingStatus.scrapingStatus.status'] = statusUpdate.scrapingStatus;
      }
      if (statusUpdate.scrapingProgress !== undefined) {
        updateData['onboardingStatus.scrapingStatus.progress'] = statusUpdate.scrapingProgress;
      }
      if (statusUpdate.scrapingMessage) {
        updateData['onboardingStatus.scrapingStatus.message'] = statusUpdate.scrapingMessage;
      }
      if (statusUpdate.scrapingSessionId) {
        updateData['onboardingStatus.scrapingStatus.sessionId'] = statusUpdate.scrapingSessionId;
      }
      if (statusUpdate.scrapingError) {
        updateData['onboardingStatus.scrapingStatus.error'] = statusUpdate.scrapingError;
      }
      if (statusUpdate.hasImportedTransactions !== undefined) {
        updateData['onboardingStatus.hasImportedTransactions'] = statusUpdate.hasImportedTransactions;
      }
      if (statusUpdate.transactionsImported !== undefined) {
        updateData['onboardingStatus.transactionsImported'] = statusUpdate.transactionsImported;
      }
      if (statusUpdate.transactionsCategorized !== undefined) {
        updateData['onboardingStatus.transactionsCategorized'] = statusUpdate.transactionsCategorized;
      }
      if (statusUpdate.importCompletedAt) {
        updateData['onboardingStatus.importCompletedAt'] = statusUpdate.importCompletedAt;
      }

      await User.findByIdAndUpdate(userId, { $set: updateData });
    } catch (error) {
      logger.error(`Failed to update user scraping status for user ${userId}:`, error);
    }
  }

  /**
   * Clean up old sessions (cleanup job)
   */
  cleanupOldSessions() {
    const now = new Date();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.startedAt > maxAge) {
        this.activeSessions.delete(sessionId);
        logger.info(`Cleaned up old scraping session ${sessionId}`);
      }
    }
  }

  /**
   * Get all active sessions (for monitoring)
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      ...session
    }));
  }

}

module.exports = new OnboardingTransactionService();
