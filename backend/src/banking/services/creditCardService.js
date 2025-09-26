const { CreditCard, Transaction } = require('../models');
const logger = require('../../shared/utils/logger');
const { ObjectId } = require('mongodb');

const convertToObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch (error) {
    logger.error('Invalid ObjectId:', id, error);
    throw new Error(`Invalid ObjectId: ${id}`);
  }
};

/**
 * Credit Card Service
 * Handles credit card data retrieval and transaction analytics
 * Uses processedDate for monthly allocation (aligned with monthly budgets)
 */
class CreditCardService {
  /**
   * Get all credit cards for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of credit cards with basic info
   */
  async getUserCreditCards(userId) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      logger.info(`Getting credit cards for user ${userId}`);

      const creditCards = await CreditCard.find({
        userId: convertToObjectId(userId),
        isActive: true
      })
      .populate('bankAccountId', 'name bankId')
      .sort({ displayName: 1 })
      .lean();

      // Add recent transaction count and 6-month spending for each card
      const cardsWithStats = await Promise.all(creditCards.map(async (card) => {
        const recentTransactionCount = await Transaction.countDocuments({
          creditCardId: card._id,
          userId: convertToObjectId(userId),
          processedDate: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        });

        // Get 6-month spending total
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const spendingStats = await Transaction.aggregate([
          {
            $match: {
              creditCardId: card._id,
              userId: convertToObjectId(userId),
              processedDate: { $gte: sixMonthsAgo }
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
              _id: null,
              totalSpent: { $sum: { $abs: '$amount' } }
            }
          }
        ]);

        const totalSpentLast6Months = spendingStats.length > 0 ? spendingStats[0].totalSpent : 0;

        return {
          _id: card._id,
          name: card.displayName,
          identifier: card.cardNumber,
          recentTransactionCount,
          totalSpentLast6Months
        };
      }));

      logger.info(`Found ${cardsWithStats.length} credit cards for user ${userId}`);
      return cardsWithStats;

    } catch (error) {
      logger.error(`Error getting credit cards for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get specific credit card details
   * @param {string} cardId - Credit card ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Credit card details
   */
  async getCreditCardDetails(cardId, userId) {
    try {
      if (!cardId || !userId) {
        return null;
      }

      const cardObjectId = convertToObjectId(cardId);
      const userObjectId = convertToObjectId(userId);

      logger.info(`Getting credit card details for card ${cardId}, user ${userId}`);

      const creditCard = await CreditCard.findOne({
        _id: cardObjectId,
        userId: userObjectId,
        isActive: true
      })
      .populate('bankAccountId', 'name bankId')
      .lean();

      if (!creditCard) {
        return null;
      }

      // Get transaction statistics for the card
      const stats = await this.getCreditCardBasicStats(cardId, userId);

      return {
        ...creditCard,
        ...stats
      };

    } catch (error) {
      logger.error(`Error getting credit card details for card ${cardId}:`, error);
      return null;
    }
  }

  /**
   * Get basic statistics for a credit card
   * @param {string} cardId - Credit card ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Basic stats
   */
  async getCreditCardBasicStats(cardId, userId) {
    try {
      const cardObjectId = convertToObjectId(cardId);
      const userObjectId = convertToObjectId(userId);

      // Check if credit card exists
      const creditCard = await CreditCard.findOne({
        _id: cardObjectId,
        userId: userObjectId,
        isActive: true
      });

      if (!creditCard) {
        return null;
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const stats = await Transaction.aggregate([
        {
          $match: {
            creditCardId: cardObjectId,
            userId: userObjectId,
            processedDate: { $gte: sixMonthsAgo }
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
            _id: null,
            totalTransactions: { $sum: 1 },
            last6MonthsTotal: { $sum: { $abs: '$amount' } }, // Absolute value for spending
            averageTransaction: { $avg: { $abs: '$amount' } }
          }
        }
      ]);

      const result = stats.length > 0 ? stats[0] : {
        totalTransactions: 0,
        last6MonthsTotal: 0,
        averageTransaction: 0
      };

      // Get all-time stats for additional context
      const allTimeStats = await Transaction.aggregate([
        {
          $match: {
            creditCardId: cardObjectId,
            userId: userObjectId
          }
        },
        {
          $group: {
            _id: null,
            totalSpentAllTime: { $sum: { $abs: '$amount' } },
            totalTransactions: { $sum: 1 }
          }
        }
      ]);

      const allTime = allTimeStats.length > 0 ? allTimeStats[0] : {
        totalSpentAllTime: 0,
        totalTransactions: 0
      };

      // Calculate actual months with data instead of fixed 6
      const actualMonthsWithData = await Transaction.aggregate([
        {
          $match: {
            creditCardId: cardObjectId,
            userId: userObjectId,
            processedDate: { $gte: sixMonthsAgo }
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
              year: { $year: '$processedDate' },
              month: { $month: '$processedDate' }
            }
          }
        },
        {
          $count: "monthsWithData"
        }
      ]);

      const monthsWithData = actualMonthsWithData.length > 0 ? actualMonthsWithData[0].monthsWithData : 0;
      
      // Calculate average monthly spending with proper zero handling
      let avgMonthlySpending = 0;
      if (result.last6MonthsTotal > 0 && monthsWithData > 0) {
        avgMonthlySpending = Math.round(result.last6MonthsTotal / monthsWithData);
      }

      return {
        cardId: cardId.toString(),
        last6MonthsTotal: result.last6MonthsTotal,
        avgMonthlySpending: avgMonthlySpending,
        totalTransactions: result.totalTransactions,
        periodStart: sixMonthsAgo.toISOString(),
        periodEnd: new Date().toISOString(),
        monthsWithData: monthsWithData, // Add this for transparency
        // Additional fields for detailed view
        totalSpentAllTime: allTime.totalSpentAllTime,
        name: creditCard.displayName
      };

    } catch (error) {
      logger.error(`Error getting basic stats for card ${cardId}:`, error);
      return null;
    }
  }

  /**
   * Get monthly statistics for a credit card
   * Uses processedDate for monthly allocation (aligned with budget system)
   * @param {string} cardId - Credit card ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Monthly statistics
   */
  async getCreditCardMonthlyStats(cardId, year, month, userId) {
    try {
      if (!cardId || !year || !month || !userId) {
        return null;
      }

      const cardObjectId = convertToObjectId(cardId);
      const userObjectId = convertToObjectId(userId);

      // Check if credit card exists
      const creditCard = await CreditCard.findOne({
        _id: cardObjectId,
        userId: userObjectId,
        isActive: true
      });

      if (!creditCard) {
        return null;
      }

      logger.info(`Getting monthly stats for card ${cardId}, ${month}/${year}, user ${userId}`);

      // Create date range for the specific month
      const startDate = new Date(year, month - 1, 1); // Month is 0-indexed
      const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month

      // Get monthly totals by category
      const categoryStats = await Transaction.aggregate([
        {
          $match: {
            creditCardId: cardObjectId,
            userId: userObjectId,
            processedDate: { $gte: startDate, $lte: endDate },
            category: { $ne: null } // Only categorized transactions
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
          $lookup: {
            from: 'subcategories',
            localField: 'subCategory',
            foreignField: '_id',
            as: 'subCategoryDetails'
          }
        },
        {
          $match: {
            'categoryDetails.type': { $ne: 'Transfer' } // Exclude Transfer transactions
          }
        },
        {
          $group: {
            _id: {
              categoryId: '$category',
              categoryName: { $arrayElemAt: ['$categoryDetails.name', 0] },
              subCategoryId: '$subCategory',
              subCategoryName: { $arrayElemAt: ['$subCategoryDetails.name', 0] }
            },
            totalAmount: { $sum: { $abs: '$amount' } },
            transactionCount: { $sum: 1 },
            averageAmount: { $avg: { $abs: '$amount' } }
          }
        },
        {
          $sort: { totalAmount: -1 } // Sort by highest spending
        }
      ]);

      // Get overall monthly summary
      const monthlyTotal = await Transaction.aggregate([
        {
          $match: {
            creditCardId: cardObjectId,
            userId: userObjectId,
            processedDate: { $gte: startDate, $lte: endDate }
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
            _id: null,
            totalAmount: { $sum: { $abs: '$amount' } },
            totalTransactions: { $sum: 1 },
            averageTransaction: { $avg: { $abs: '$amount' } }
          }
        }
      ]);

      // Get uncategorized transactions count
      const uncategorizedCount = await Transaction.countDocuments({
        creditCardId: cardObjectId,
        userId: userObjectId,
        processedDate: { $gte: startDate, $lte: endDate },
        category: null
      });

      const summary = monthlyTotal.length > 0 ? monthlyTotal[0] : {
        totalAmount: 0,
        totalTransactions: 0,
        averageTransaction: 0
      };

      return {
        cardId: cardId.toString(),
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalAmount: summary.totalAmount,
        transactionCount: summary.totalTransactions,
        categoryBreakdown: categoryStats.map(stat => ({
          categoryId: stat._id.categoryId,
          categoryName: stat._id.categoryName || 'Unknown',
          subCategoryId: stat._id.subCategoryId,
          subCategoryName: stat._id.subCategoryName,
          totalAmount: stat.totalAmount,
          transactionCount: stat.transactionCount,
          averageAmount: Math.round(stat.averageAmount),
          percentage: summary.totalAmount > 0 ? 
            Math.round((stat.totalAmount / summary.totalAmount) * 100) : 0
        }))
      };

    } catch (error) {
      logger.error(`Error getting monthly stats for card ${cardId}:`, error);
      return null;
    }
  }

  /**
   * Get transactions for a credit card with filtering
   * @param {string} cardId - Credit card ID
   * @param {Object} filters - Filter options
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Transactions and pagination info
   */
  async getCreditCardTransactions(cardId, filters = {}, userId) {
    try {
      if (!cardId || !userId) {
        return null;
      }

      const cardObjectId = convertToObjectId(cardId);
      const userObjectId = convertToObjectId(userId);

      // Check if credit card exists and belongs to user
      const creditCard = await CreditCard.findOne({
        _id: cardObjectId,
        userId: userObjectId,
        isActive: true
      });

      if (!creditCard) {
        return null;
      }

      const {
        year,
        month,
        category,
        subCategory,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
        search,
        page = 1
      } = filters;

      logger.info(`Getting transactions for card ${cardId} with filters:`, filters);

      // Calculate skip from page if provided
      const actualSkip = page > 1 ? (page - 1) * limit : skip;

      // Build query
      const query = {
        creditCardId: cardObjectId,
        userId: userObjectId
      };

      // Date filtering - prefer specific month, then date range
      if (year && month) {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        query.processedDate = { $gte: monthStart, $lte: monthEnd };
      } else if (startDate || endDate) {
        query.processedDate = {};
        if (startDate) query.processedDate.$gte = new Date(startDate);
        if (endDate) query.processedDate.$lte = new Date(endDate);
      }

      // Category filtering
      if (category) {
        try {
          const categoryObjectId = convertToObjectId(category);
          query.category = categoryObjectId;
        } catch (error) {
          // If category is not a valid ObjectId, skip the filter
          logger.warn(`Invalid category ObjectId: ${category}, skipping filter`);
        }
      }
      if (subCategory) {
        try {
          const subCategoryObjectId = convertToObjectId(subCategory);
          query.subCategory = subCategoryObjectId;
        } catch (error) {
          // If subCategory is not a valid ObjectId, skip the filter
          logger.warn(`Invalid subCategory ObjectId: ${subCategory}, skipping filter`);
        }
      }

      // Search filtering
      if (search) {
        query.description = { $regex: search, $options: 'i' };
      }

      // Get transactions with pagination, excluding Transfer transactions
      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .populate('category', 'name type')
          .populate('subCategory', 'name')
          .populate('tags', 'name color')
          .sort({ processedDate: -1 })
          .skip(actualSkip)
          .limit(limit)
          .lean()
          .then(results => results.filter(tx => 
            !tx.category || tx.category.type !== 'Transfer'
          )),
        Transaction.aggregate([
          { $match: query },
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
          { $count: "total" }
        ]).then(result => result.length > 0 ? result[0].total : 0)
      ]);

      const currentPage = Math.floor(actualSkip / limit) + 1;
      const totalPages = Math.ceil(total / limit);
      const hasNext = currentPage < totalPages;
      const hasPrev = currentPage > 1;

      return {
        transactions,
        totalCount: total,
        currentPage,
        totalPages,
        hasNext,
        hasPrev,
        pagination: {
          total,
          limit,
          skip: actualSkip,
          hasMore: hasNext,
          currentPage,
          totalPages
        }
      };

    } catch (error) {
      logger.error(`Error getting transactions for card ${cardId}:`, error);
      return null;
    }
  }

  /**
   * Get 6-month trend data for a credit card
   * @param {string} cardId - Credit card ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of monthly totals for last 6 months
   */
  async getCreditCardTrend(cardId, userId) {
    try {
      if (!cardId || !userId) {
        return null;
      }

      const cardObjectId = convertToObjectId(cardId);
      const userObjectId = convertToObjectId(userId);
      
      if (!cardObjectId || !userObjectId) {
        return null;
      }

      // Check if credit card exists
      const creditCard = await CreditCard.findOne({
        _id: cardObjectId,
        userId: userObjectId,
        isActive: true
      });

      if (!creditCard) {
        return null;
      }

      logger.info(`Getting 6-month trend for card ${cardId}, user ${userId}`);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1); // Start from beginning of month

      const trendData = await Transaction.aggregate([
        {
          $match: {
            creditCardId: cardObjectId,
            userId: userObjectId,
            processedDate: { $gte: sixMonthsAgo }
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
              year: { $year: '$processedDate' },
              month: { $month: '$processedDate' }
            },
            totalAmount: { $sum: { $abs: '$amount' } },
            transactionCount: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Fill in missing months with zero values
      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        const dataPoint = trendData.find(d => d._id.year === year && d._id.month === month);
        
        months.push({
          year,
          month,
          monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalAmount: dataPoint ? dataPoint.totalAmount : 0,
          transactionCount: dataPoint ? dataPoint.transactionCount : 0
        });
      }

      const totalPeriodAmount = months.reduce((sum, month) => sum + month.totalAmount, 0);
      
      // Calculate average based on months with actual data, not fixed 6
      const monthsWithData = months.filter(month => month.totalAmount > 0).length;
      const avgMonthlyAmount = monthsWithData > 0 ? Math.round(totalPeriodAmount / monthsWithData) : 0;

      return {
        cardId: cardId.toString(),
        months,
        totalPeriodAmount,
        avgMonthlyAmount,
        monthsWithData // Add this for transparency
      };

    } catch (error) {
      logger.error(`Error getting trend data for card ${cardId}:`, error);
      return null;
    }
  }
}

module.exports = new CreditCardService();
