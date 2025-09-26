const CreditCard = require('../models/CreditCard');
const BankAccount = require('../models/BankAccount');
const Transaction = require('../models/Transaction');
const logger = require('../../shared/utils/logger');
const mongoose = require('mongoose');

/**
 * Service for onboarding credit card accounts
 * Handles auto-creation of CreditCard instances from scraped data
 * and matching with monthly payment transactions
 */
class CreditCardOnboardingService {
  
  /**
   * Create CreditCard instances from scraped account data
   * @param {string} bankAccountId - Parent bank account ID (credit card provider)
   * @param {Array} scrapedAccounts - Array of scraped account objects
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of created CreditCard instances
   */
  async createCreditCardsFromScraping(bankAccountId, scrapedAccounts, userId) {
    try {
      logger.info(`Creating credit cards from scraping for bank account ${bankAccountId}, user ${userId}`);
      
      if (!scrapedAccounts || scrapedAccounts.length === 0) {
        logger.warn('No scraped accounts provided for credit card creation');
        return [];
      }
      
      const creditCards = [];
      
      for (const account of scrapedAccounts) {
        try {
          // Validate required fields
          if (!account.accountNumber) {
            logger.warn('Scraped account missing accountNumber, skipping');
            continue;
          }
          
          // Create or find existing credit card
          const creditCard = await CreditCard.findOrCreate({
            userId: new mongoose.Types.ObjectId(userId),
            bankAccountId: new mongoose.Types.ObjectId(bankAccountId),
            cardNumber: account.accountNumber,
            displayName: account.accountNumber, // Use accountNumber as initial display name
            isActive: true,
            // Extract additional info if available
            cardType: account.cardType || null,
            lastFourDigits: this.extractLastFourDigits(account.accountNumber)
          });
          
          creditCards.push(creditCard);
          
          logger.info(`Created/found credit card: ${creditCard.displayName} for user ${userId}`);
          
        } catch (error) {
          logger.error(`Error creating credit card for account ${account.accountNumber}:`, error);
          // Continue with other cards even if one fails
        }
      }
      
      logger.info(`Successfully created/found ${creditCards.length} credit cards for user ${userId}`);
      return creditCards;
      
    } catch (error) {
      logger.error(`Error creating credit cards from scraping:`, error);
      throw new Error(`Failed to create credit cards: ${error.message}`);
    }
  }
  
  /**
   * Match monthly credit card payments to validate connections
   * @param {string} userId - User ID
   * @param {Array} creditCards - Array of CreditCard instances
   * @param {number} monthsBack - Number of months to analyze (default: 6)
   * @returns {Promise<Object>} Matching results
   */
  async matchMonthlyPayments(userId, creditCards, monthsBack = 6) {
    try {
      console.log(`🔍 CREDIT CARD SERVICE: Matching monthly payments for ${creditCards.length} credit cards, user ${userId}`);
      logger.info(`Matching monthly payments for ${creditCards.length} credit cards, user ${userId}`);
      
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      
      // Get credit card payment transactions from checking accounts
      const creditCardPayments = await this.getCreditCardPaymentTransactions(userId, startDate);
      
      // Get monthly totals from each credit card account
      const creditCardMonthlyTotals = await this.getCreditCardMonthlyTotals(creditCards, startDate);
      
      // Perform matching analysis
      const matchingResults = await this.performPaymentMatching(
        creditCardPayments, 
        creditCardMonthlyTotals
      );
      
      // Update credit cards with matching confidence
      await this.updateCreditCardMatchingStatus(creditCards, matchingResults);
      
      const summary = {
        totalCreditCards: creditCards.length,
        totalPaymentTransactions: creditCardPayments.length,
        matchedCards: matchingResults.filter(r => r.confidence === 'high').length,
        partialMatches: matchingResults.filter(r => r.confidence === 'medium').length,
        unmatchedCards: matchingResults.filter(r => r.confidence === 'low').length,
        matchingAccuracy: this.calculateMatchingAccuracy(matchingResults),
        analysisDate: new Date(),
        matchingResults
      };
      
      logger.info(`Payment matching completed for user ${userId}: ${summary.matchedCards}/${summary.totalCreditCards} high-confidence matches`);
      return summary;
      
    } catch (error) {
      logger.error(`Error matching monthly payments for user ${userId}:`, error);
      throw new Error(`Failed to match monthly payments: ${error.message}`);
    }
  }
  
  /**
   * Get credit card payment transactions from checking accounts
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @returns {Promise<Array>} Array of credit card payment transactions
   */
  async getCreditCardPaymentTransactions(userId, startDate) {
    try {
      const payments = await Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            date: { $gte: startDate }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryDetails'
          }
        },
        {
          $match: {
            'categoryDetails.name': 'Credit Card',
            'categoryDetails.type': 'Transfer'
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' }
            },
            transactions: {
              $push: {
                _id: '$_id',
                amount: '$amount',
                date: '$date',
                description: '$description',
                accountId: '$accountId'
              }
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': -1, '_id.month': -1 }
        }
      ]);
      
      return payments.map(payment => ({
        year: payment._id.year,
        month: payment._id.month,
        monthString: `${payment._id.year}-${String(payment._id.month).padStart(2, '0')}`,
        totalAmount: Math.abs(payment.totalAmount),
        transactionCount: payment.count,
        transactions: payment.transactions.map(tx => ({
          ...tx,
          amount: Math.abs(tx.amount)
        }))
      }));
      
    } catch (error) {
      logger.error('Error getting credit card payment transactions:', error);
      return [];
    }
  }
  
  /**
   * Get monthly totals from credit card accounts
   * @param {Array} creditCards - Array of CreditCard instances  
   * @param {Date} startDate - Start date for analysis
   * @returns {Promise<Array>} Array of monthly totals per credit card
   */
  async getCreditCardMonthlyTotals(creditCards, startDate) {
    try {
      const cardTotals = [];
      
      for (const creditCard of creditCards) {
        // Get transactions from this credit card's bank account, excluding Transfer transactions
        const monthlyTotals = await Transaction.aggregate([
          {
            $match: {
              accountId: creditCard.bankAccountId,
              date: { $gte: startDate }
            }
          },
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'categoryDetails'
            }
          },
          {
            $match: {
              $or: [
                { 'categoryDetails.type': { $ne: 'Transfer' } },
                { category: null }
              ]
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' }
              },
              totalAmount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': -1, '_id.month': -1 }
          }
        ]);
        
        const formattedTotals = monthlyTotals.map(total => ({
          year: total._id.year,
          month: total._id.month,
          monthString: `${total._id.year}-${String(total._id.month).padStart(2, '0')}`,
          totalAmount: Math.abs(total.totalAmount),
          transactionCount: total.count
        }));
        
        cardTotals.push({
          creditCard,
          monthlyTotals: formattedTotals
        });
      }
      
      return cardTotals;
      
    } catch (error) {
      logger.error('Error getting credit card monthly totals:', error);
      return [];
    }
  }
  
  /**
   * Perform payment matching between checking account payments and credit card totals
   * @param {Array} creditCardPayments - Monthly payment transactions from checking
   * @param {Array} creditCardMonthlyTotals - Monthly totals from credit card accounts
   * @returns {Promise<Array>} Matching results
   */
  async performPaymentMatching(creditCardPayments, creditCardMonthlyTotals) {
    const matchingResults = [];
    const tolerancePercentage = 0.05; // 5% tolerance for amount matching
    
    // Debug logging: Show what we're comparing
    logger.info('=== CREDIT CARD PAYMENT MATCHING DEBUG ===');
    logger.info('Credit Card Payments from Checking Accounts:', JSON.stringify(creditCardPayments, null, 2));
    logger.info('Credit Card Monthly Totals (spending):', JSON.stringify(creditCardMonthlyTotals, null, 2));
    logger.info('============================================');
    
    for (const cardData of creditCardMonthlyTotals) {
      const { creditCard, monthlyTotals } = cardData;
      const matches = [];
      
      logger.info(`\n--- Matching for Credit Card: ${creditCard.displayName || creditCard.cardNumber} ---`);
      logger.info(`Credit card monthly spending:`, monthlyTotals);
      
      for (const cardMonth of monthlyTotals) {
        // Find corresponding payment in checking account
        const paymentMonth = creditCardPayments.find(payment => 
          payment.monthString === cardMonth.monthString
        );
        
        logger.info(`  Month ${cardMonth.monthString}: Credit card spent ${cardMonth.totalAmount}`);
        
        if (paymentMonth) {
          // Check if amounts match within tolerance
          const amountDifference = Math.abs(paymentMonth.totalAmount - cardMonth.totalAmount);
          const toleranceAmount = cardMonth.totalAmount * tolerancePercentage;
          
          logger.info(`    Found payment: ${paymentMonth.totalAmount}, difference: ${amountDifference}, tolerance: ${toleranceAmount}`);
          
          if (amountDifference <= toleranceAmount) {
            const confidence = amountDifference <= (toleranceAmount / 2) ? 'high' : 'medium';
            logger.info(`    ✅ MATCH! Confidence: ${confidence}`);
            matches.push({
              month: cardMonth.monthString,
              creditCardAmount: cardMonth.totalAmount,
              paymentAmount: paymentMonth.totalAmount,
              difference: amountDifference,
              confidence
            });
          } else {
            logger.info(`    ❌ No match - difference ${amountDifference} exceeds tolerance ${toleranceAmount}`);
          }
        } else {
          logger.info(`    ❌ No payment found for month ${cardMonth.monthString}`);
        }
      }
      
      logger.info(`Total matches for ${creditCard.displayName}: ${matches.length}/${monthlyTotals.length}`);
      
      // Calculate overall confidence based on match percentage
      const totalMonths = monthlyTotals.length;
      const matchedMonths = matches.length;
      const matchPercentage = totalMonths > 0 ? matchedMonths / totalMonths : 0;
      
      let overallConfidence = 'low';
      if (matchPercentage >= 0.8) overallConfidence = 'high';
      else if (matchPercentage >= 0.5) overallConfidence = 'medium';
      
      matchingResults.push({
        creditCard,
        matches,
        totalMonths,
        matchedMonths,
        matchPercentage,
        confidence: overallConfidence
      });
    }
    
    return matchingResults;
  }
  
  /**
   * Update credit card instances with matching status
   * @param {Array} creditCards - Array of CreditCard instances
   * @param {Array} matchingResults - Results from payment matching
   */
  async updateCreditCardMatchingStatus(creditCards, matchingResults) {
    try {
      for (const result of matchingResults) {
        // Note: CreditCard model doesn't have matching fields yet
        // This is where we would update matching confidence if we add those fields
        logger.info(`Credit card ${result.creditCard.displayName}: ${result.confidence} confidence (${result.matchedMonths}/${result.totalMonths} months matched)`);
      }
    } catch (error) {
      logger.error('Error updating credit card matching status:', error);
    }
  }
  
  /**
   * Calculate overall matching accuracy
   * @param {Array} matchingResults - Results from payment matching
   * @returns {number} Accuracy percentage (0-100)
   */
  calculateMatchingAccuracy(matchingResults) {
    if (matchingResults.length === 0) return 0;
    
    const totalCards = matchingResults.length;
    const highConfidenceCards = matchingResults.filter(r => r.confidence === 'high').length;
    
    return Math.round((highConfidenceCards / totalCards) * 100);
  }
  
  /**
   * Extract last 4 digits from account number for identification
   * @param {string} accountNumber - Full account number
   * @returns {string|null} Last 4 digits or null
   */
  extractLastFourDigits(accountNumber) {
    if (!accountNumber || accountNumber.length < 4) return null;
    return accountNumber.slice(-4);
  }
  
  /**
   * Get onboarding summary for a user's credit cards
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Onboarding summary
   */
  async getOnboardingSummary(userId) {
    try {
      const creditCards = await CreditCard.getUserActiveCards(userId);
      const hasCheckingAccount = await this.hasCheckingAccount(userId);
      
      return {
        hasCheckingAccount,
        creditCardCount: creditCards.length,
        hasCreditCards: creditCards.length > 0,
        creditCards: creditCards.map(card => ({
          id: card._id,
          displayName: card.displayName,
          cardType: card.cardType,
          lastFourDigits: card.lastFourDigits,
          isActive: card.isActive
        }))
      };
      
    } catch (error) {
      logger.error(`Error getting onboarding summary for user ${userId}:`, error);
      throw new Error(`Failed to get onboarding summary: ${error.message}`);
    }
  }
  
  /**
   * Check if user has a checking account
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user has a checking account
   */
  async hasCheckingAccount(userId) {
    try {
      const BankClassificationService = require('./bankClassificationService');
      const checkingBanks = BankClassificationService.getCheckingBanks();
      
      const count = await BankAccount.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        bankId: { $in: checkingBanks },
        status: 'active'
      });
      
      return count > 0;
      
    } catch (error) {
      logger.error(`Error checking for checking account for user ${userId}:`, error);
      return false;
    }
  }
}

module.exports = new CreditCardOnboardingService();
