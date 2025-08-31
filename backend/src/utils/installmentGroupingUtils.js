const currencyExchangeService = require('../services/currencyExchangeService');

/**
 * Utility for grouping installment transactions consistently across the application
 */
class InstallmentGroupingUtils {
  
  /**
   * Check if a transaction is an installment transaction
   * @param {Object} transaction - Transaction document
   * @returns {boolean} - True if transaction is an installment
   */
  isInstallmentTransaction(transaction) {
    return transaction.rawData?.type === 'installments' && 
           transaction.identifier && 
           transaction.rawData?.originalAmount && 
           (transaction.rawData?.installments?.total || transaction.rawData?.totalInstallments);
  }
  
  /**
   * Find all related installment transactions for a given transaction
   * @param {Object} baseTransaction - The base installment transaction
   * @param {Array<Object>} allTransactions - Array of all transactions to search in
   * @param {Set<string>} excludeIds - Set of transaction IDs to exclude from search
   * @returns {Array<Object>} - Array of related installment transactions
   */
  findRelatedInstallments(baseTransaction, allTransactions, excludeIds = new Set()) {
    if (!this.isInstallmentTransaction(baseTransaction)) {
      return [baseTransaction];
    }
    
    return allTransactions.filter(txn => 
      txn.identifier === baseTransaction.identifier &&
      txn.rawData?.type === 'installments' &&
      txn.rawData?.originalAmount === baseTransaction.rawData.originalAmount &&
      txn.rawData?.installments?.total === baseTransaction.rawData.installments?.total &&
      !excludeIds.has(txn._id.toString())
    );
  }
  
  /**
   * Process installment transactions with currency conversion
   * @param {Array<Object>} installments - Array of installment transactions
   * @param {string} targetCurrency - Target currency for conversion
   * @returns {Object} - Processing result with totals and converted amounts
   */
  async processInstallmentsWithCurrency(installments, targetCurrency) {
    let totalConvertedAmount = 0;
    let totalOriginalAmount = 0;
    const installmentIds = [];
    const processedInstallments = [];
    
    // Sort installments by date to get the earliest one
    const sortedInstallments = installments.sort((a, b) => 
      new Date(a.processedDate).getTime() - new Date(b.processedDate).getTime()
    );
    
    for (const installment of sortedInstallments) {
      let convertedAmount = Math.abs(installment.amount);
      
      // Convert to target currency if needed
      if (installment.currency !== targetCurrency) {
        try {
          const conversionResult = await currencyExchangeService.convertAmount(
            Math.abs(installment.amount),
            installment.currency,
            targetCurrency,
            installment.processedDate,
            true // Allow fallback to nearest rate
          );
          convertedAmount = conversionResult.convertedAmount;
          
          if (conversionResult.fallback) {
            console.log(`Used fallback rate for installment ${installment._id}: ${conversionResult.source} (${conversionResult.daysDifference} days difference)`);
          }
        } catch (error) {
          console.warn(`Currency conversion failed for installment ${installment._id}:`, error.message);
        }
      }
      
      totalConvertedAmount += convertedAmount;
      totalOriginalAmount += Math.abs(installment.amount);
      installmentIds.push(installment._id.toString());
      
      processedInstallments.push({
        ...installment,
        convertedAmount
      });
    }
    
    return {
      sortedInstallments,
      processedInstallments,
      totalConvertedAmount,
      totalOriginalAmount,
      installmentIds,
      earliestInstallment: sortedInstallments[0]
    };
  }
  
  /**
   * Create enhanced transaction object for installment groups
   * @param {Object} earliestInstallment - The earliest installment transaction
   * @param {Array<Object>} allInstallments - All related installment transactions
   * @param {number} totalOriginalAmount - Sum of all original amounts
   * @param {number} totalConvertedAmount - Sum of all converted amounts
   * @param {Array<string>} installmentIds - Array of all installment transaction IDs
   * @returns {Object} - Enhanced transaction object with grouping metadata
   */
  createEnhancedInstallmentTransaction(earliestInstallment, allInstallments, totalOriginalAmount, totalConvertedAmount, installmentIds) {
    // Generate unique group ID (using double dash to separate identifier from amount)
    // Clean the identifier to remove any trailing dashes to ensure consistent format
    const cleanIdentifier = earliestInstallment.identifier.toString().replace(/-+$/, '');
    const groupId = `installment-group-${cleanIdentifier}--${earliestInstallment.rawData.originalAmount}`;
    
    return {
      ...earliestInstallment.toObject(),
      _id: groupId, // Use group ID as the transaction ID
      description: earliestInstallment.description || earliestInstallment.chargedAccount,
      amount: totalOriginalAmount, // Use total amount
      isInstallmentGroup: true,
      installmentCount: allInstallments.length,
      installmentIds: installmentIds,
      groupedTransactions: allInstallments.map(inst => ({
        id: inst._id.toString(),
        amount: inst.amount,
        date: inst.processedDate,
        description: inst.description || inst.chargedAccount,
        currency: inst.currency
      })),
      // Preserve original installment metadata
      rawData: {
        ...earliestInstallment.rawData,
        isGroup: true,
        totalAmount: totalOriginalAmount,
        convertedAmount: totalConvertedAmount
      }
    };
  }
  
  /**
   * Group transactions by installment relationships
   * @param {Array<Object>} transactions - Array of transactions to group
   * @param {string} targetCurrency - Target currency for conversions
   * @param {Function} processRegularTransactionFn - Function to process non-installment transactions
   * @returns {Object} - Grouped transactions and processing results
   */
  async groupTransactionsByInstallments(transactions, targetCurrency, processRegularTransactionFn = null) {
    const groupedTransactions = [];
    const processedTransactionIds = new Set();
    let totalAmount = 0;
    
    for (const transaction of transactions) {
      // Skip if already processed as part of an installment group
      if (processedTransactionIds.has(transaction._id.toString())) {
        continue;
      }
      
      if (this.isInstallmentTransaction(transaction)) {
        // Find all related installments
        const relatedInstallments = this.findRelatedInstallments(
          transaction, 
          transactions, 
          processedTransactionIds
        );
        
        if (relatedInstallments.length > 1) {
          // This is a multi-installment expense - group them
          const processingResult = await this.processInstallmentsWithCurrency(
            relatedInstallments, 
            targetCurrency
          );
          
          // Create enhanced transaction object
          const enhancedTransaction = this.createEnhancedInstallmentTransaction(
            processingResult.earliestInstallment,
            processingResult.sortedInstallments,
            processingResult.totalOriginalAmount,
            processingResult.totalConvertedAmount,
            processingResult.installmentIds
          );
          
          groupedTransactions.push({
            transaction: enhancedTransaction,
            convertedAmount: processingResult.totalConvertedAmount,
            isGroup: true,
            installmentCount: relatedInstallments.length
          });
          
          totalAmount += processingResult.totalConvertedAmount;
          
          // Mark all installments as processed
          relatedInstallments.forEach(inst => {
            processedTransactionIds.add(inst._id.toString());
          });
          
        } else {
          // Single installment or no related installments found - treat as regular
          if (processRegularTransactionFn) {
            const result = await processRegularTransactionFn(transaction);
            if (result) {
              groupedTransactions.push({
                transaction: result.transaction || transaction,
                convertedAmount: result.convertedAmount || Math.abs(transaction.amount),
                isGroup: false,
                installmentCount: 1
              });
              totalAmount += result.convertedAmount || Math.abs(transaction.amount);
            }
          } else {
            groupedTransactions.push({
              transaction,
              convertedAmount: Math.abs(transaction.amount),
              isGroup: false,
              installmentCount: 1
            });
            totalAmount += Math.abs(transaction.amount);
          }
          
          processedTransactionIds.add(transaction._id.toString());
        }
        
      } else {
        // Not an installment transaction - treat as regular
        if (processRegularTransactionFn) {
          const result = await processRegularTransactionFn(transaction);
          if (result) {
            groupedTransactions.push({
              transaction: result.transaction || transaction,
              convertedAmount: result.convertedAmount || Math.abs(transaction.amount),
              isGroup: false,
              installmentCount: 1
            });
            totalAmount += result.convertedAmount || Math.abs(transaction.amount);
          }
        } else {
          groupedTransactions.push({
            transaction,
            convertedAmount: Math.abs(transaction.amount),
            isGroup: false,
            installmentCount: 1
          });
          totalAmount += Math.abs(transaction.amount);
        }
        
        processedTransactionIds.add(transaction._id.toString());
      }
    }
    
    return {
      groupedTransactions,
      totalAmount,
      processedCount: processedTransactionIds.size
    };
  }
  
  /**
   * Extract installment group information from a transaction
   * @param {Object} transaction - Transaction that may be part of an installment group
   * @returns {Object} - Installment group information
   */
  getInstallmentGroupInfo(transaction) {
    if (!transaction.isInstallmentGroup) {
      return {
        isGroup: false,
        installmentCount: 1,
        groupId: null,
        originalTransactionIds: [transaction._id]
      };
    }
    
    return {
      isGroup: true,
      installmentCount: transaction.installmentCount || 1,
      groupId: transaction._id,
      originalTransactionIds: transaction.installmentIds || [],
      groupedTransactions: transaction.groupedTransactions || []
    };
  }
}

module.exports = new InstallmentGroupingUtils();
