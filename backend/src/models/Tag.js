const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['project', 'custom'],
    default: 'custom'
  },
  // For project tags, store additional project metadata
  projectMetadata: {
    description: String,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['planning', 'active', 'completed', 'cancelled'],
      default: 'planning'
    }
  },
  // Track usage statistics
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  // Color for UI display
  color: {
    type: String,
    default: '#1976d2'
  }
}, {
  timestamps: true
});

// Ensure tag names are unique per user
tagSchema.index({ name: 1, userId: 1 }, { unique: true });

// Index for type-based queries
tagSchema.index({ userId: 1, type: 1 });

// Static method to find or create a tag
tagSchema.statics.findOrCreate = async function(tagData) {
  let tag = await this.findOne({
    name: tagData.name,
    userId: tagData.userId
  });

  if (!tag) {
    tag = new this(tagData);
    await tag.save();
  }

  return tag;
};

// Static method to get user's tags with usage statistics
tagSchema.statics.getUserTagsWithStats = async function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'transactions',
        localField: '_id',
        foreignField: 'tags',
        as: 'transactions'
      }
    },
    {
      $addFields: {
        transactionCount: { $size: '$transactions' },
        totalAmount: { $sum: '$transactions.amount' }
      }
    },
    {
      $project: {
        transactions: 0 // Don't return the full transaction data
      }
    },
    { $sort: { lastUsed: -1 } }
  ]);
};

// Method to increment usage count
tagSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  await this.save();
  return this;
};

const Tag = mongoose.model('Tag', tagSchema);

module.exports = Tag;
