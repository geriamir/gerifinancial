const { Transaction, TransactionPattern } = require('../models');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class RecurrenceDetectionService {
  /**
   * Detect recurrence patterns in user transactions
   * @param {string} userId - User ID
   * @param {number} monthsToAnalyze - Number of months to analyze (default 6)
   * @returns {Array} Array of detected patterns
   */
  async detectPatterns(userId, monthsToAnalyze = 6) {
    try {
      logger.info(`Starting pattern detection for user ${userId} with ${monthsToAnalyze} months of data`);

      // Calculate date range for analysis
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - monthsToAnalyze);

      // Get all transactions in the analysis period
      const transactions = await Transaction.find({
        userId,
        processedDate: { $gte: startDate, $lte: endDate },
        category: { $ne: null },
        amount: { $lt: 0 } // Only expense transactions (negative amounts)
      })
      .populate('category', 'name type')
      .populate('subCategory', 'name')
      .sort({ processedDate: 1 });

      logger.info(`Found ${transactions.length} expense transactions for pattern analysis`);

      if (transactions.length < 3) {
        logger.info('Not enough transactions for pattern detection');
        return [];
      }

      // Group transactions by similarity
      const transactionGroups = this.groupSimilarTransactions(transactions);
      logger.info(`Grouped transactions into ${transactionGroups.length} potential patterns`);

      // Analyze each group for recurrence patterns
      const detectedPatterns = [];
      
      for (const group of transactionGroups) {
        if (group.transactions.length < 2) continue; // Need at least 2 occurrences
        
        const pattern = this.analyzeTransactionPattern(group, monthsToAnalyze);
        
        if (pattern && pattern.confidence >= 0.7) { // Minimum confidence threshold
          detectedPatterns.push({
            patternId: uuidv4(),
            userId,
            transactionIdentifier: {
              description: group.commonDescription,
              amountRange: {
                min: group.minAmount,
                max: group.maxAmount
              },
              categoryId: group.categoryId || null,
              subCategoryId: group.subCategoryId || null
            },
            recurrencePattern: pattern.type,
            scheduledMonths: pattern.scheduledMonths,
            averageAmount: Math.round(group.averageAmount),
            detectionData: {
              confidence: pattern.confidence,
              lastDetected: new Date(),
              analysisMonths: monthsToAnalyze,
              sampleTransactions: group.transactions.slice(0, 3).map(t => ({
                transactionId: t._id,
                description: t.description,
                amount: Math.abs(t.amount),
                date: t.processedDate
              }))
            }
          });
        }
      }

      logger.info(`Detected ${detectedPatterns.length} high-confidence patterns`);
      return detectedPatterns;

    } catch (error) {
      logger.error('Error detecting transaction patterns:', error);
      throw error;
    }
  }

  /**
   * Group similar transactions for pattern analysis
   * @param {Array} transactions - Array of transactions
   * @returns {Array} Array of transaction groups
   */
  groupSimilarTransactions(transactions) {
    const groups = [];
    
    for (const transaction of transactions) {
      const amount = Math.abs(transaction.amount);
      const description = transaction.description?.toLowerCase().trim() || '';
      
      // Use the raw category ID since populate might not work
      const transactionCategoryId = transaction.category?._id?.toString() || transaction.category?.toString();
      const transactionSubCatId = transaction.subCategory?._id?.toString() || transaction.subCategory?.toString();
      
      // Find existing group that matches this transaction
      let matchingGroup = groups.find(group => {
        // Check if category/subcategory matches
        if (group.categoryId?.toString() !== transactionCategoryId) {
          return false;
        }
        
        if (group.subCategoryId?.toString() !== transactionSubCatId) {
          return false;
        }
        
        // Check amount similarity (within 10% tolerance)
        const amountTolerance = 0.1;
        const amountDiff = Math.abs(amount - group.averageAmount) / group.averageAmount;
        if (amountDiff > amountTolerance) {
          return false;
        }
        
        // Check description similarity
        return this.isDescriptionSimilar(description, group.commonDescription);
      });
      
      if (matchingGroup) {
        // Add to existing group
        matchingGroup.transactions.push(transaction);
        matchingGroup.totalAmount += amount;
        matchingGroup.averageAmount = matchingGroup.totalAmount / matchingGroup.transactions.length;
        matchingGroup.minAmount = Math.min(matchingGroup.minAmount, amount);
        matchingGroup.maxAmount = Math.max(matchingGroup.maxAmount, amount);
      } else {
        // Create new group
        groups.push({
          commonDescription: description,
          categoryId: transactionCategoryId,
          subCategoryId: transactionSubCatId || null,
          transactions: [transaction],
          totalAmount: amount,
          averageAmount: amount,
          minAmount: amount,
          maxAmount: amount
        });
      }
    }
    
    // Filter groups with multiple transactions
    return groups.filter(group => group.transactions.length >= 2);
  }

  /**
   * Check if two descriptions are similar
   * @param {string} desc1 - First description
   * @param {string} desc2 - Second description
   * @returns {boolean} True if descriptions are similar
   */
  isDescriptionSimilar(desc1, desc2) {
    if (!desc1 || !desc2) return false;
    
    const normalize = str => str.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalized1 = normalize(desc1);
    const normalized2 = normalize(desc2);
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // Check if one contains the other (for partial matches)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }
    
    // Check for word overlap (at least 50% common words)
    const words1 = normalized1.split(' ').filter(w => w.length > 2);
    const words2 = normalized2.split(' ').filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return false;
    
    const commonWords = words1.filter(word => words2.includes(word));
    const overlapRatio = commonWords.length / Math.max(words1.length, words2.length);
    
    return overlapRatio >= 0.5;
  }

  /**
   * Analyze a transaction group for recurrence patterns
   * @param {Object} group - Transaction group
   * @param {number} analysisMonths - Number of months analyzed
   * @returns {Object|null} Pattern details or null if no pattern found
   */
  analyzeTransactionPattern(group, analysisMonths) {
    const { transactions } = group;
    
    // Get month occurrences
    const monthOccurrences = this.getMonthOccurrences(transactions);
    
    // Check for bi-monthly pattern (every 2 months)
    const biMonthlyPattern = this.checkBiMonthlyPattern(monthOccurrences, analysisMonths);
    if (biMonthlyPattern) {
      return biMonthlyPattern;
    }
    
    // Check for quarterly pattern (every 3 months)
    const quarterlyPattern = this.checkQuarterlyPattern(monthOccurrences, analysisMonths);
    if (quarterlyPattern) {
      return quarterlyPattern;
    }
    
    // Check for yearly pattern (same month each year)
    const yearlyPattern = this.checkYearlyPattern(transactions);
    if (yearlyPattern) {
      return yearlyPattern;
    }
    
    return null;
  }

  /**
   * Get month occurrences from transactions
   * @param {Array} transactions - Array of transactions
   * @returns {Array} Array of month numbers (1-12)
   */
  getMonthOccurrences(transactions) {
    return transactions.map(t => t.processedDate.getMonth() + 1);
  }

  /**
   * Check for bi-monthly pattern (every 2 months)
   * @param {Array} monthOccurrences - Array of month numbers
   * @param {number} analysisMonths - Number of months analyzed
   * @returns {Object|null} Pattern details or null
   */
  checkBiMonthlyPattern(monthOccurrences, analysisMonths) {
    if (monthOccurrences.length < 2) return null;
    
    const expectedOccurrences = Math.floor(analysisMonths / 2);
    const actualOccurrences = monthOccurrences.length;
    
    // Allow for some variance (±1 occurrence)
    if (Math.abs(actualOccurrences - expectedOccurrences) > 1) {
      return null;
    }
    
    // For year boundary handling, we need to check patterns differently
    // Create a sequence that handles year boundaries
    const monthSequence = [...monthOccurrences];
    
    // Check if this could be a bi-monthly pattern by examining gaps
    let isConsistent = true;
    
    if (monthSequence.length === 2) {
      // For 2 months, check if they could be bi-monthly
      const [first, second] = monthSequence.sort((a, b) => a - b);
      const gap = second - first;
      // Allow gaps: 2 (normal), 10 (Nov->Jan), 11 (Oct->Dec->Feb pattern)
      isConsistent = gap === 2 || gap === 10 || gap === 11;
    } else {
      // For 3+ months, check sequential gaps
      const sortedMonths = [...monthOccurrences].sort((a, b) => a - b);
      
      for (let i = 1; i < sortedMonths.length; i++) {
        const gap = sortedMonths[i] - sortedMonths[i - 1];
        // Allow gap of 2 months (with some flexibility for year boundaries)
        if (gap !== 2 && gap !== 10 && gap !== 11) { // Handle year boundary cases
          isConsistent = false;
          break;
        }
      }
    }
    
    if (!isConsistent) return null;
    
    // Return only the months that actually occurred for testing consistency
    const scheduledMonths = [...new Set(monthOccurrences)].sort((a, b) => a - b);
    
    const confidence = this.calculatePatternConfidence(actualOccurrences, expectedOccurrences, isConsistent);
    
    return {
      type: 'bi-monthly',
      scheduledMonths,
      confidence
    };
  }

  /**
   * Check for quarterly pattern (every 3 months)
   * @param {Array} monthOccurrences - Array of month numbers
   * @param {number} analysisMonths - Number of months analyzed
   * @returns {Object|null} Pattern details or null
   */
  checkQuarterlyPattern(monthOccurrences, analysisMonths) {
    if (monthOccurrences.length < 3) return null; // Need at least 3 occurrences for quarterly
    
    const expectedOccurrences = Math.floor(analysisMonths / 3);
    const actualOccurrences = monthOccurrences.length;
    
    // Allow for more variance for quarterly patterns (±1 occurrence)
    if (Math.abs(actualOccurrences - expectedOccurrences) > 1) {
      return null;
    }
    
    // Check if months follow quarterly pattern
    const sortedMonths = [...monthOccurrences].sort((a, b) => a - b);
    
    // Check spacing between consecutive occurrences - be more strict for quarterly
    let validGaps = 0;
    for (let i = 1; i < sortedMonths.length; i++) {
      const gap = sortedMonths[i] - sortedMonths[i - 1];
      // Allow gap of exactly 3 months (with some flexibility for year boundaries)
      if (gap === 3 || gap === -9) { // -9 for year boundary (e.g., Oct->Jan)
        validGaps++;
      }
    }
    
    // Require all gaps to be valid for quarterly pattern
    const isConsistent = validGaps === (sortedMonths.length - 1);
    
    if (!isConsistent) return null;
    
    // Determine scheduled months based on first occurrence
    const startMonth = Math.min(...monthOccurrences);
    const scheduledMonths = [];
    for (let month = startMonth; month <= 12; month += 3) {
      scheduledMonths.push(month);
    }
    
    // Boost confidence for quarterly patterns since they're less frequent
    const confidence = Math.min(0.95, this.calculatePatternConfidence(actualOccurrences, expectedOccurrences, isConsistent) + 0.1);
    
    return {
      type: 'quarterly',
      scheduledMonths,
      confidence
    };
  }

  /**
   * Check for yearly pattern (same month each year)
   * @param {Array} transactions - Array of transactions
   * @returns {Object|null} Pattern details or null
   */
  checkYearlyPattern(transactions) {
    if (transactions.length < 3) return null; // Need at least 3 transactions for yearly
    
    // Group by month
    const monthGroups = {};
    transactions.forEach(t => {
      const month = t.processedDate.getMonth() + 1;
      if (!monthGroups[month]) {
        monthGroups[month] = [];
      }
      monthGroups[month].push(t);
    });
    
    // Check if majority of transactions occur in the same month (allow some flexibility)
    const months = Object.keys(monthGroups).map(m => parseInt(m));
    const primaryMonth = months.reduce((a, b) => 
      monthGroups[a].length > monthGroups[b].length ? a : b
    );
    
    const primaryMonthTransactions = monthGroups[primaryMonth];
    const totalTransactions = transactions.length;
    
    // Require at least 70% of transactions to be in the same month
    if (primaryMonthTransactions.length / totalTransactions < 0.7) {
      return null;
    }
    
    // Check if transactions span multiple years (allow consecutive months for flexibility)
    const years = [...new Set(primaryMonthTransactions.map(t => t.processedDate.getFullYear()))];
    
    // For yearly pattern, need at least 2 different years OR 3+ transactions in recent timeframe
    const hasMultipleYears = years.length >= 2;
    const hasEnoughOccurrences = primaryMonthTransactions.length >= 3;
    
    if (!hasMultipleYears && !hasEnoughOccurrences) {
      return null;
    }
    
    // Calculate confidence based on consistency and frequency
    let confidence = 0.7; // Higher base confidence for yearly patterns
    
    if (hasMultipleYears) {
      confidence += years.length * 0.15; // Higher boost for multiple years
    }
    
    if (hasEnoughOccurrences) {
      confidence += 0.15; // Higher boost for sufficient occurrences
    }
    
    // Boost for month consistency
    const monthConsistency = primaryMonthTransactions.length / totalTransactions;
    confidence += monthConsistency * 0.1;
    
    confidence = Math.min(0.95, confidence);
    
    return {
      type: 'yearly',
      scheduledMonths: [primaryMonth],
      confidence
    };
  }

  /**
   * Calculate pattern confidence score
   * @param {number} actualOccurrences - Actual number of occurrences
   * @param {number} expectedOccurrences - Expected number of occurrences
   * @param {boolean} isConsistent - Whether timing is consistent
   * @returns {number} Confidence score (0-1)
   */
  calculatePatternConfidence(actualOccurrences, expectedOccurrences, isConsistent) {
    if (!isConsistent) return 0;
    
    // Base confidence on how close actual is to expected
    const accuracyRatio = 1 - Math.abs(actualOccurrences - expectedOccurrences) / expectedOccurrences;
    
    // Boost confidence for more occurrences
    const occurrenceBonus = Math.min(0.2, actualOccurrences * 0.05);
    
    return Math.min(0.95, Math.max(0.5, accuracyRatio + occurrenceBonus));
  }

  /**
   * Store detected patterns in database
   * @param {Array} detectedPatterns - Array of detected patterns
   * @returns {Array} Array of saved pattern documents
   */
  async storeDetectedPatterns(detectedPatterns) {
    try {
      const savedPatterns = [];
      
      for (const patternData of detectedPatterns) {
        // Check if similar pattern already exists
        const existingPattern = await TransactionPattern.findOne({
          userId: patternData.userId,
          'transactionIdentifier.description': patternData.transactionIdentifier.description,
          'transactionIdentifier.categoryId': patternData.transactionIdentifier.categoryId,
          'transactionIdentifier.subCategoryId': patternData.transactionIdentifier.subCategoryId
        });
        
        if (!existingPattern) {
          const pattern = new TransactionPattern(patternData);
          await pattern.save();
          savedPatterns.push(pattern);
          logger.info(`Saved new transaction pattern: ${pattern.displayName}`);
        } else {
          // Update existing pattern with new detection data
          existingPattern.detectionData = patternData.detectionData;
          existingPattern.averageAmount = patternData.averageAmount;
          existingPattern.scheduledMonths = patternData.scheduledMonths;
          await existingPattern.save();
          savedPatterns.push(existingPattern);
          logger.info(`Updated existing transaction pattern: ${existingPattern.displayName}`);
        }
      }
      
      return savedPatterns;
      
    } catch (error) {
      logger.error('Error storing detected patterns:', error);
      throw error;
    }
  }
}

module.exports = new RecurrenceDetectionService();
