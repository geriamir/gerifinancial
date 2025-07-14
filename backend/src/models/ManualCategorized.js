const mongoose = require('mongoose');

const manualCategorizedSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  memo: {
    type: String,
    trim: true,
    default: null
  },
  rawCategory: {
    type: String,
    trim: true,
    default: null
  },
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'he'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: false // Make optional for Income/Transfer categories
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  matchCount: {
    type: Number,
    default: 1
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  confidence: {
    type: Number,
    default: 1.0
  }
}, {
  timestamps: true
});

// Ensure description+memo combinations are unique per user
manualCategorizedSchema.index({ description: 1, memo: 1, userId: 1 }, { unique: true });

// Create indexes for common queries
manualCategorizedSchema.index({ userId: 1, description: 1 });
manualCategorizedSchema.index({ userId: 1, category: 1 });
manualCategorizedSchema.index({ userId: 1, subCategory: 1 });

// Static method to save manual categorization
manualCategorizedSchema.statics.saveManualCategorization = async function(data) {
  const { description, memo, rawCategory, userId, subCategory, category, language = 'he' } = data;

  const existingMapping = await this.findOne({
    description,
    memo: memo || null,
    userId
  });

  if (existingMapping) {
    existingMapping.matchCount += 1;
    existingMapping.lastUsed = new Date();
    existingMapping.subCategory = subCategory; // Can be null for Income/Transfer
    existingMapping.category = category;
    existingMapping.rawCategory = rawCategory || null;
    existingMapping.confidence = 1.0; // Reset confidence on manual update
    return existingMapping.save();
  }

  const newMapping = new this({
    description,
    memo: memo || null,
    rawCategory: rawCategory || null,
    userId,
    subCategory,
    category,
    language
  });

  return newMapping.save();
};

// Static method to find matching categorizations
manualCategorizedSchema.statics.findMatches = async function(description, userId, memo = null) {
  const normalizedDescription = description.toLowerCase().trim();
  const normalizedMemo = memo ? memo.toLowerCase().trim() : null;
  
  // Try exact match with memo if provided
  if (normalizedMemo) {
    const exactMatches = await this.find({
      userId,
      description: normalizedDescription,
      memo: normalizedMemo
    })
    .sort({ matchCount: -1, lastUsed: -1 })
    .populate('category subCategory');

    if (exactMatches.length > 0) {
      return exactMatches;
    }
  }

  // Try exact match without memo
  const matches = await this.find({
    userId,
    description: normalizedDescription,
    memo: null
  })
  .sort({ matchCount: -1, lastUsed: -1 })
  .populate('category subCategory');

  if (matches.length > 0) {
    return matches;
  }

  // Fallback to partial description match only for high confidence matches
  return this.find({
    userId,
    description: new RegExp(normalizedDescription, 'i'),
    confidence: { $gte: 0.5 }
  })
  .sort({ matchCount: -1, lastUsed: -1 })
  .limit(1)
  .populate('category subCategory');
};

// Static method to suggest categorization based on similar descriptions
manualCategorizedSchema.statics.suggestCategorization = async function(description, userId, memo = null) {
  const normalizedDescription = description.toLowerCase().trim();
  
  // Find similar descriptions using partial matching
  const similarMappings = await this.find({
    userId,
    description: new RegExp(normalizedDescription.slice(0, Math.max(3, normalizedDescription.length/2)), 'i')
  })
  .sort({ matchCount: -1 })
  .limit(5)
  .populate('category subCategory');

  if (!similarMappings.length) {
    return null;
  }

  // Return the most frequently used similar mapping
  return similarMappings[0];
};

const ManualCategorized = mongoose.model('ManualCategorized', manualCategorizedSchema);

module.exports = ManualCategorized;
