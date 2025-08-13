const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const CreditCard = require('../models/CreditCard');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Service for detecting credit card usage from transaction data
 * Uses existing AI categorization to identify credit card transactions
 */
class CreditCardDetectionService {
  
  /**
   * Analyze user's transaction history for credit card usage
   * @param {string} userId - User ID to analyze
   * @param {number} monthsBack - Number of months to look back (default: 6)
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeCreditCardUsage(userId, monthsBack = 6) {
    try {
      logger.info(`Analyzing credit card usage for user ${userId} over ${monthsBack} months`);
      
      // Calculate date threshold
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      
      
      // Get credit card transactions using aggregation pipeline
      // This leverages the existing AI categorization that identifies "Credit Card" + "Transfer"
      const creditCardTransactions = await Transaction.aggregate([
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
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' },
            minAmount: { $min: '$amount' },
            maxAmount: { $max: '$amount' },
            transactions: { 
              $push: {
                date: '$date',
                amount: '$amount',
                description: '$description'
              }
            }
          }
        }
      ]);
      
      const hasTransactions = creditCardTransactions.length > 0;
      const transactionData = hasTransactions ? creditCardTransactions[0] : null;
      
      // Get monthly breakdown for more detailed analysis
      const monthlyBreakdown = await this.getMonthlyBreakdown(userId, startDate);
      
      // Generate analysis results
      const analysis = {
        hasCreditCardActivity: hasTransactions && transactionData.count > 0,
        transactionCount: hasTransactions ? transactionData.count : 0,
        totalAmount: hasTransactions ? Math.abs(transactionData.totalAmount) : 0,
        averageAmount: hasTransactions ? Math.abs(transactionData.avgAmount) : 0,
        monthlyBreakdown,
        activeMonths: monthlyBreakdown.length,
        monthlyAverage: monthlyBreakdown.length > 0 ? 
          Math.round(transactionData?.count / monthlyBreakdown.length) || 0 : 0,
        recommendation: this.generateRecommendation(transactionData, monthlyBreakdown),
        analysisDate: new Date(),
        lookbackMonths: monthsBack,
        // All transactions for user confidence (sorted by date)
        sampleTransactions: hasTransactions ? 
          transactionData.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(tx => ({
              date: tx.date,
              amount: Math.abs(tx.amount),
              description: tx.description
            })) : []
      };
      
      logger.info(`Credit card analysis completed for user ${userId}: ${analysis.transactionCount} transactions found`);
      return analysis;
      
    } catch (error) {
      logger.error(`Error analyzing credit card usage for user ${userId}:`, error);
      throw new Error(`Failed to analyze credit card usage: ${error.message}`);
    }
  }
  
  /**
   * Get monthly breakdown of credit card transactions
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @returns {Promise<Array>} Monthly breakdown data
   */
  async getMonthlyBreakdown(userId, startDate) {
    try {
      const monthlyData = await Transaction.aggregate([
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
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        {
          $sort: { '_id.year': -1, '_id.month': -1 }
        }
      ]);
      
      return monthlyData.map(item => ({
        year: item._id.year,
        month: item._id.month,
        monthString: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        count: item.count,
        totalAmount: Math.abs(item.totalAmount)
      }));
      
    } catch (error) {
      logger.error('Error getting monthly breakdown:', error);
      return [];
    }
  }
  
  /**
   * Generate recommendation based on transaction analysis
   * Simple rule: If we found any unmatched credit card transactions, recommend connecting
   * @param {Object} transactionData - Aggregated transaction data
   * @param {Array} monthlyBreakdown - Monthly breakdown data  
   * @returns {string} Recommendation: 'connect' or 'skip'
   */
  generateRecommendation(transactionData, monthlyBreakdown) {
    // If we found even 1 credit card transaction that we couldn't match to a credit card, recommend connecting
    if (transactionData && transactionData.count > 0) {
      return 'connect';
    }
    
    return 'skip';
  }
  
  /**
   * Check if user has any credit card transactions (simple check)
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} True if user has credit card transactions
   */
  async hasCreditCardTransactions(userId) {
    try {
      const count = await Transaction.aggregate([
        {
          $match: { userId: new mongoose.Types.ObjectId(userId) }
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
          $count: 'total'
        }
      ]);
      
      return count.length > 0 && count[0].total > 0;
      
    } catch (error) {
      logger.error(`Error checking credit card transactions for user ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Get credit card transaction statistics for dashboard
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Quick stats
   */
  async getCreditCardStats(userId) {
    try {
      const analysis = await this.analyzeCreditCardUsage(userId, 3); // Last 3 months
      
      return {
        hasActivity: analysis.hasCreditCardActivity,
        recentTransactionCount: analysis.transactionCount,
        recommendation: analysis.recommendation,
        lastAnalyzed: analysis.analysisDate
      };
      
    } catch (error) {
      logger.error(`Error getting credit card stats for user ${userId}:`, error);
      return {
        hasActivity: false,
        recentTransactionCount: 0,
        recommendation: 'skip',
        lastAnalyzed: new Date()
      };
    }
  }

  /**
   * Detect unconnected credit cards and update user tasks
   * This method is called after categorization during data sync
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async detectAndUpdateCreditCards(userId) {
    try {
      logger.info(`Starting credit card detection for user ${userId}`);
      
      // Analyze recent credit card activity
      const analysis = await this.analyzeCreditCardUsage(userId, 2); // Last 2 months
      
      if (!analysis.hasCreditCardActivity) {
        logger.info(`No credit card activity found for user ${userId}`);
        return;
      }
      
      // Check if user already has credit card accounts connected
      const existingCreditCards = await CreditCard.find({ 
        userId, 
        isActive: true 
      });
      
      // If user has unmatched credit card transactions but no connected credit cards, create a task
      if (analysis.transactionCount > 0 && existingCreditCards.length === 0) {
        await this.createCreditCardConnectionTask(userId, analysis);
        logger.info(`Created credit card connection task for user ${userId}`);
      } else if (existingCreditCards.length > 0) {
        // User has credit cards - clear any existing tasks
        await this.clearCreditCardConnectionTask(userId);
        logger.info(`Credit cards already connected for user ${userId}, cleared tasks`);
      }
      
    } catch (error) {
      logger.error(`Error in credit card detection for user ${userId}:`, error);
      // Don't throw - this should not fail the data sync
    }
  }

  /**
   * Create a task for connecting credit cards
   * @param {string} userId - User ID
   * @param {Object} analysis - Credit card analysis results
   * @returns {Promise<void>}
   */
  async createCreditCardConnectionTask(userId, analysis) {
    try {      
      const taskData = {
        type: 'credit_card_connection',
        title: 'Connect Credit Card Accounts',
        description: `We found ${analysis.transactionCount} credit card transactions. Connecting your credit cards will improve your financial tracking.`,
        priority: 'medium',
        data: {
          transactionCount: analysis.transactionCount,
          recentTransactions: analysis.sampleTransactions.slice(0, 3),
          detectedAt: new Date()
        }
      };

      // Update user with the task (assuming there's a tasks field or create one)
      await User.findByIdAndUpdate(
        userId,
        { 
          $addToSet: { 
            'tasks': taskData 
          }
        }
      );
      
    } catch (error) {
      logger.error(`Error creating credit card connection task for user ${userId}:`, error);
    }
  }

  /**
   * Clear credit card connection tasks
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async clearCreditCardConnectionTask(userId) {
    try {
      // Remove credit card connection tasks
      await User.findByIdAndUpdate(
        userId,
        { 
          $pull: { 
            'tasks': { type: 'credit_card_connection' }
          }
        }
      );
      
    } catch (error) {
      logger.error(`Error clearing credit card connection task for user ${userId}:`, error);
    }
  }

  /**
   * Analyze credit card transaction coverage after connecting accounts
   * Matches "Credit Card" categorized transactions against actual credit card spending by monthly totals
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Coverage analysis results
   */
  async analyzeCreditCardCoverage(userId) {
    try {
      logger.info(`Analyzing credit card coverage for user ${userId}`);
      
      // Get analysis period (last 1 month for recent transactions only)
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      logger.info(`Looking for credit card payments since ${startDate.toISOString()}`);
      
      // First, check if we have any transactions at all for this user
      const totalTransactionCount = await Transaction.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate }
      });
      logger.info(`User has ${totalTransactionCount} total transactions in the last 3 months`);
      
      // Check categorized transactions
      const categorizedCount = await Transaction.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate },
        category: { $ne: null }
      });
      logger.info(`User has ${categorizedCount} categorized transactions in the last 3 months`);
      
      // Get all "Credit Card" categorized transactions (payments from checking accounts)
      const creditCardPayments = await Transaction.aggregate([
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
          $sort: { date: -1 }
        }
      ]);
      
      logger.info(`Found ${creditCardPayments.length} credit card payment transactions`);

      // Get all connected credit cards
      const connectedCreditCards = await CreditCard.find({ 
        userId: new mongoose.Types.ObjectId(userId), 
        isActive: true 
      }).populate('bankAccountId');
      
      logger.info(`Found ${connectedCreditCards.length} connected credit cards`);

      // If no transactions are categorized yet, provide a helpful response
      if (categorizedCount === 0) {
        logger.info(`No categorized transactions found for user ${userId} - transactions may still be processing`);
        return {
          totalCreditCardPayments: 0,
          coveredPayments: 0,
          uncoveredPayments: 0,
          coveragePercentage: 100, // No data yet, so assume complete for now
          connectedCreditCards: connectedCreditCards.map(cc => ({
            id: cc._id.toString(),
            displayName: cc.displayName,
            cardNumber: cc.cardNumber,
            provider: cc.bankAccountId?.bankId || 'unknown',
            lastFourDigits: cc.lastFourDigits
          })),
          matchedPayments: [],
          uncoveredSampleTransactions: [],
          recommendation: 'processing',
          recommendationReason: `Transactions are still being processed. ${totalTransactionCount} transactions imported, categorization in progress. Please check back in a few minutes.`
        };
      }

      if (connectedCreditCards.length === 0) {
        return {
          totalCreditCardPayments: creditCardPayments.length,
          coveredPayments: 0,
          uncoveredPayments: creditCardPayments.length,
          coveragePercentage: 0,
          connectedCreditCards: [],
          matchedPayments: [],
          uncoveredSampleTransactions: creditCardPayments.slice(0, 10).map(tx => ({
            date: tx.date,
            description: tx.description,
            amount: Math.abs(tx.amount)
          })),
          recommendation: 'connect_cards',
          recommendationReason: 'No credit cards are connected. Connect your credit card providers to track coverage.'
        };
      }

      // Get monthly spending totals for each connected credit card
      const creditCardMonthlyTotals = await this.getCreditCardMonthlyTotals(connectedCreditCards, startDate);
      
      // Match credit card payments to credit card monthly spending
      const matchingResults = await this.matchPaymentsToCards(creditCardPayments, creditCardMonthlyTotals);
      
      const coverageAnalysis = {
        totalCreditCardPayments: creditCardPayments.length,
        coveredPayments: matchingResults.coveredCount,
        uncoveredPayments: matchingResults.uncoveredCount,
        coveragePercentage: creditCardPayments.length > 0 
          ? Math.round((matchingResults.coveredCount / creditCardPayments.length) * 100) 
          : 100,
        connectedCreditCards: connectedCreditCards.map(cc => ({
          id: cc._id.toString(),
          displayName: cc.displayName,
          cardNumber: cc.cardNumber,
          provider: cc.bankAccountId?.bankId || 'unknown',
          lastFourDigits: cc.lastFourDigits
        })),
        matchedPayments: matchingResults.matchedPayments,
        uncoveredSampleTransactions: matchingResults.uncoveredPayments.slice(0, 10).map(tx => ({
          date: tx.date,
          description: tx.description,
          amount: Math.abs(tx.amount)
        })),
        recommendation: matchingResults.coveragePercentage >= 80 ? 'complete' : 'connect_more',
        recommendationReason: matchingResults.coveragePercentage >= 80 
          ? `Excellent coverage! ${matchingResults.coveragePercentage}% of your credit card payments are matched to connected cards.`
          : `${matchingResults.uncoveredCount} credit card payments couldn't be matched. Consider connecting additional credit card providers.`
      };

      logger.info(`Coverage analysis completed for user ${userId}: ${matchingResults.coveragePercentage}% coverage across ${connectedCreditCards.length} cards`);
      return coverageAnalysis;
      
    } catch (error) {
      logger.error(`Error analyzing credit card coverage for user ${userId}:`, error);
      throw new Error(`Failed to analyze coverage: ${error.message}`);
    }
  }

  /**
   * Get monthly spending totals for each connected credit card
   * Uses processedDate to group credit card spending for accurate payment matching
   * @param {Array} connectedCreditCards - Array of connected credit card objects
   * @param {Date} startDate - Start date for analysis
   * @returns {Promise<Array>} Monthly totals per credit card
   */
  async getCreditCardMonthlyTotals(connectedCreditCards, startDate) {
    try {
      const monthlyTotals = [];

      for (const creditCard of connectedCreditCards) {
        // Get transactions for this specific credit card using processedDate for grouping
        const cardTransactions = await Transaction.aggregate([
          {
            $match: {
              creditCardId: creditCard._id,
              processedDate: { $gte: startDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$processedDate' },
                month: { $month: '$processedDate' },
                creditCardId: '$creditCardId'
              },
              totalSpent: { $sum: { $abs: '$amount' } },
              transactionCount: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': -1, '_id.month': -1 }
          }
        ]);

        // Add credit card info to each monthly total
        const cardMonthlyData = cardTransactions.map(monthData => ({
          creditCard,
          year: monthData._id.year,
          month: monthData._id.month,
          monthString: `${monthData._id.year}-${String(monthData._id.month).padStart(2, '0')}`,
          totalSpent: monthData.totalSpent,
          transactionCount: monthData.transactionCount
        }));
        logger.debug(`Monthly data for card ${creditCard.displayName}:`, cardMonthlyData);

        monthlyTotals.push(...cardMonthlyData);
      }

      return monthlyTotals;
    } catch (error) {
      logger.error('Error getting credit card monthly totals:', error);
      return [];
    }
  }

  /**
   * Match credit card payments to credit card monthly spending totals
   * @param {Array} creditCardPayments - "Credit Card" categorized transactions (payments)
   * @param {Array} creditCardMonthlyTotals - Monthly spending totals per credit card
   * @returns {Promise<Object>} Matching results
   */
  async matchPaymentsToCards(creditCardPayments, creditCardMonthlyTotals) {
    try {
      const matchedPayments = [];
      const uncoveredPayments = [];
      const tolerance = 0.05; // 5% tolerance for amount matching

      for (const payment of creditCardPayments) {
        const paymentAmount = Math.abs(payment.amount);
        const paymentDate = new Date(payment.date);
        const paymentMonth = paymentDate.getMonth() + 1;
        const paymentYear = paymentDate.getFullYear();

        // Look for credit card monthly totals that match this payment
        // Check current month, previous month, and next month (billing cycles can vary)
        const matchingCandidates = creditCardMonthlyTotals.filter(monthlyTotal => {
          const monthDiff = Math.abs((monthlyTotal.year * 12 + monthlyTotal.month) - (paymentYear * 12 + paymentMonth));
          return monthDiff <= 1; // Within 1 month
        });

        // Find best amount match within candidates
        let bestMatch = null;
        let bestMatchScore = Infinity;

        for (const candidate of matchingCandidates) {
          const amountDiff = Math.abs(paymentAmount - candidate.totalSpent);
          const amountDiffPercentage = amountDiff / paymentAmount;
          
          if (amountDiffPercentage <= tolerance && amountDiff < bestMatchScore) {
            bestMatch = candidate;
            bestMatchScore = amountDiff;
          }
        }

        if (bestMatch) {
          matchedPayments.push({
            payment: {
              id: payment._id,
              date: payment.date,
              description: payment.description,
              amount: Math.abs(payment.amount),
              originalAmount: payment.amount
            },
            matchedCreditCard: {
              id: bestMatch.creditCard._id.toString(),
              displayName: bestMatch.creditCard.displayName,
              cardNumber: bestMatch.creditCard.cardNumber,
              lastFourDigits: bestMatch.creditCard.lastFourDigits,
              provider: bestMatch.creditCard.bankAccountId?.bankId || 'unknown'
            },
            matchedMonth: bestMatch.monthString,
            matchedAmount: bestMatch.totalSpent,
            paymentAmount,
            amountDifference: Math.abs(paymentAmount - bestMatch.totalSpent),
            matchType: 'amount_date_match',
            matchConfidence: Math.max(0, 100 - Math.round((Math.abs(paymentAmount - bestMatch.totalSpent) / paymentAmount) * 100))
          });
        } else {
          uncoveredPayments.push(payment);
        }
      }

      const coveredCount = matchedPayments.length;
      const uncoveredCount = uncoveredPayments.length;
      const coveragePercentage = creditCardPayments.length > 0 
        ? Math.round((coveredCount / creditCardPayments.length) * 100) 
        : 100;

      return {
        coveredCount,
        uncoveredCount,
        coveragePercentage,
        matchedPayments,
        uncoveredPayments
      };

    } catch (error) {
      logger.error('Error matching payments to cards:', error);
      return {
        coveredCount: 0,
        uncoveredCount: creditCardPayments.length,
        coveragePercentage: 0,
        matchedPayments: [],
        uncoveredPayments: creditCardPayments
      };
    }
  }

  /**
   * Analyze coverage matching between checking account payments and credit card activity
   * Simple heuristic: if we have credit card accounts connected, assume higher coverage
   * @param {Array} checkingTransactions - Credit card payment transactions from checking
   * @param {Array} creditCardTransactions - Transactions from connected credit cards  
   * @param {Array} connectedCards - Connected credit card accounts
   * @returns {Object} Coverage analysis
   */
  analyzeCoverageMatching(checkingTransactions, creditCardTransactions, connectedCards) {
    const totalTransactions = checkingTransactions.length;
    
    if (totalTransactions === 0) {
      return {
        coveredCount: 0,
        uncoveredCount: 0,
        coveragePercentage: 100,
        uncoveredTransactions: []
      };
    }

    // Simple heuristic: if we have connected credit cards with recent activity, 
    // assume they cover most of the checking account payments
    const hasActiveCreditCards = connectedCards.length > 0 && creditCardTransactions.length > 0;
    
    let coveredCount, uncoveredCount;
    
    if (hasActiveCreditCards) {
      // Assume 80% coverage if we have active credit card accounts
      // This is a simplified approach - in reality we'd do date/amount matching
      coveredCount = Math.floor(totalTransactions * 0.8);
      uncoveredCount = totalTransactions - coveredCount;
    } else {
      // No credit cards connected - nothing is covered
      coveredCount = 0;
      uncoveredCount = totalTransactions;
    }

    const coveragePercentage = totalTransactions > 0 
      ? Math.round((coveredCount / totalTransactions) * 100) 
      : 100;

    return {
      coveredCount,
      uncoveredCount,
      coveragePercentage,
      uncoveredTransactions: uncoveredCount > 0 
        ? checkingTransactions.slice(0, uncoveredCount) 
        : []
    };
  }
}

module.exports = new CreditCardDetectionService();
