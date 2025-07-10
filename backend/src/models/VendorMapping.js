const mongoose = require('mongoose');

const vendorMappingSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    required: true,
    trim: true
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
    required: true
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

// Ensure vendor names are unique per user
vendorMappingSchema.index({ vendorName: 1, userId: 1 }, { unique: true });

// Create indexes for common queries
vendorMappingSchema.index({ userId: 1, vendorName: 1 });
vendorMappingSchema.index({ userId: 1, category: 1 });
vendorMappingSchema.index({ userId: 1, subCategory: 1 });

// Static method to find or update vendor mapping
vendorMappingSchema.statics.findOrCreate = async function(vendorData) {
  const { vendorName, userId, subCategory, category, language = 'he' } = vendorData;

  const existingMapping = await this.findOne({
    vendorName,
    userId
  });

  if (existingMapping) {
    existingMapping.matchCount += 1;
    existingMapping.lastUsed = new Date();
    if (subCategory) {
      existingMapping.subCategory = subCategory;
      existingMapping.category = category;
      existingMapping.confidence = 1.0; // Reset confidence on manual update
    }
    return existingMapping.save();
  }

  const newMapping = new this({
    vendorName,
    userId,
    subCategory,
    category,
    language
  });

  return newMapping.save();
};

// Static method to find matching vendors
vendorMappingSchema.statics.findMatches = async function(description, userId) {
  const normalizedDescription = description.toLowerCase().trim();
  
  // First try exact match
  let matches = await this.find({
    userId,
    vendorName: normalizedDescription
  })
  .sort({ matchCount: -1, lastUsed: -1 })
  .populate('category subCategory');

  if (matches.length > 0) {
    return matches;
  }

  // Then try partial match
  matches = await this.find({
    userId,
    vendorName: new RegExp(normalizedDescription, 'i'),
    confidence: { $gte: 0.5 }
  })
  .sort({ matchCount: -1, lastUsed: -1 })
  .limit(1)
  .populate('category subCategory');

  return matches;
};

// Static method to suggest new vendor mappings based on similar vendors
vendorMappingSchema.statics.suggestMapping = async function(description, userId) {
  const normalizedDescription = description.toLowerCase().trim();
  
  // Find similar vendor names using partial matching
  const similarVendors = await this.find({
    userId,
    vendorName: new RegExp(normalizedDescription.slice(0, Math.max(3, normalizedDescription.length/2)), 'i')
  })
  .sort({ matchCount: -1 })
  .limit(5)
  .populate('category subCategory');

  if (!similarVendors.length) {
    return null;
  }

  // Return the most frequently used similar vendor
  return similarVendors[0];
};

const VendorMapping = mongoose.model('VendorMapping', vendorMappingSchema);

module.exports = VendorMapping;
