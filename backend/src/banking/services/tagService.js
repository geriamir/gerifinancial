const { Transaction, Tag } = require('../models');

/**
 * Tag Service - Handles all tag-related business logic
 */
class TagService {
  /**
   * Helper function to find all transactions that should be affected by a tag operation
   * For regular transactions, returns just the single transaction
   * For installment transactions, returns all related installments
   */
  async getTransactionsForTagOperation(transaction) {
    const isInstallment = transaction.rawData?.type === 'installments';
    
    if (!isInstallment) {
      return [transaction];
    }

    // Find all related installments using common criteria
    const relatedInstallments = await Transaction.find({
      userId: transaction.userId,
      identifier: transaction.identifier,
      'rawData.type': 'installments',
      'rawData.originalAmount': transaction.rawData.originalAmount,
      'rawData.installments.total': transaction.rawData.installments?.total
    });

    console.log(`Found ${relatedInstallments.length} related installments for transaction ${transaction._id}`);
    return relatedInstallments;
  }

  /**
   * Get all tags for a user
   */
  async getUserTags(userId) {
    return await Tag.find({ userId })
      .sort({ lastUsed: -1 })
      .lean();
  }

  /**
   * Create or get existing tag
   */
  async createOrGetTag(userId, name, color = '#1976d2') {
    if (!name || !name.trim()) {
      throw new Error('Tag name is required');
    }

    return await Tag.findOrCreate({
      name: name.trim(),
      userId,
      color,
      type: 'custom'
    });
  }

  /**
   * Add tags to a transaction (and related installments if applicable)
   */
  async addTagsToTransaction(userId, transactionId, tagNames) {
    if (!Array.isArray(tagNames) || tagNames.length === 0) {
      throw new Error('Tag names array is required');
    }

    // Find the transaction
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Create or find tags
    const tagIds = [];
    for (const tagName of tagNames) {
      const tag = await this.createOrGetTag(userId, tagName);
      tagIds.push(tag._id);
    }

    // Get all transactions to be tagged (single or all related installments)
    const transactionsToTag = await this.getTransactionsForTagOperation(transaction);
    const isInstallment = transactionsToTag.length > 1;
    let taggedTransactions = [];

    // Add tags to all transactions
    for (const transactionToTag of transactionsToTag) {
      await transactionToTag.addTags(tagIds);
      taggedTransactions.push(transactionToTag._id);
    }

    // Return updated transaction with populated data
    const updatedTransaction = await Transaction.findById(transaction._id)
      .populate('category')
      .populate('subCategory')
      .populate('tags');

    return {
      transaction: updatedTransaction,
      installmentInfo: isInstallment ? {
        isInstallment: true,
        taggedCount: taggedTransactions.length,
        taggedTransactionIds: taggedTransactions
      } : null
    };
  }

  /**
   * Remove tags from a transaction (and related installments if applicable)
   */
  async removeTagsFromTransaction(userId, transactionId, tagIds) {
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      throw new Error('Tag IDs array is required');
    }

    // Find the transaction
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Get all transactions to be untagged (single or all related installments)
    const transactionsToUntag = await this.getTransactionsForTagOperation(transaction);
    const isInstallment = transactionsToUntag.length > 1;
    let untaggedTransactions = [];

    // Remove tags from all transactions
    for (const transactionToUntag of transactionsToUntag) {
      await transactionToUntag.removeTags(tagIds);
      untaggedTransactions.push(transactionToUntag._id);
    }

    // Return updated transaction with populated data
    const updatedTransaction = await Transaction.findById(transaction._id)
      .populate('category')
      .populate('subCategory')
      .populate('tags');

    return {
      transaction: updatedTransaction,
      installmentInfo: isInstallment ? {
        isInstallment: true,
        untaggedCount: untaggedTransactions.length,
        untaggedTransactionIds: untaggedTransactions
      } : null
    };
  }
}

module.exports = new TagService();
