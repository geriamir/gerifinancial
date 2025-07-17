const mongoose = require('mongoose');

// Require Category schema (not model) to avoid circular dependencies
require('./Category');

const subCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  keywords: [{
    type: String,
    trim: true,
  }],
  isDefault: {
    type: Boolean,
    default: false,
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
});

// Ensure subcategory names are unique within their parent category and user
subCategorySchema.index({ name: 1, parentCategory: 1, userId: 1 }, { unique: true });

// Add method to find matching subcategories based on search terms
subCategorySchema.statics.findMatchingSubCategories = async function(searchTerms) {
  const normalizedTerms = searchTerms
    .filter(term => term && term.trim()) // Filter out empty terms
    .map(term => term.toLowerCase().trim())
    .flatMap(term => term.split(' '))
    .filter(term => term.length > 0); // Filter out empty strings from split
  
  if (normalizedTerms.length === 0) {
    return []; // Return empty array if no valid terms
  }
  
  // Get all subcategories and filter in-memory to avoid regex issues
  const allSubCategories = await this.find({}).populate('parentCategory');
  
  // Create Set for O(1) lookup performance instead of O(n) array search
  const normalizedTermsSet = new Set(normalizedTerms);
  
  // Filter subcategories that have keywords matching any of the search terms
  const matchingSubCategories = allSubCategories.filter(subCategory => {
    if (!subCategory.keywords || subCategory.keywords.length === 0) {
      return false;
    }
    
    // Check if any keyword matches any search term using efficient Set lookup
    return subCategory.keywords.some(keyword => {
      if (!keyword || !keyword.trim()) {
        return false;
      }
      
      const normalizedKeyword = keyword.toLowerCase().trim();
      
      // Fast Set lookup for exact matches
      if (normalizedTermsSet.has(normalizedKeyword)) {
        return true;
      }
      
      // Only do substring search if no exact match found
      return normalizedTerms.some(term => 
        term.includes(normalizedKeyword) || normalizedKeyword.includes(term)
      );
    });
  });
  
  return matchingSubCategories;
};

// Add method to find or create a subcategory
subCategorySchema.statics.findOrCreate = async function(subCategoryData) {
  let subCategory = await this.findOne({
    name: subCategoryData.name,
    parentCategory: subCategoryData.parentCategory,
    userId: subCategoryData.userId
  });

  if (!subCategory) {
    subCategory = new this(subCategoryData);
    await subCategory.save();

    // Update the parent category's subCategories array
    await mongoose.model('Category').findByIdAndUpdate(
      subCategoryData.parentCategory,
      { $addToSet: { subCategories: subCategory._id } }
    );
  }

  return subCategory;
};

// Add method to get all subcategories for a specific category
subCategorySchema.statics.getAllForCategory = async function(categoryId) {
  return this.find({ parentCategory: categoryId }).exec();
};

// Middleware to remove subcategory reference from parent category when deleted
subCategorySchema.pre('remove', async function(next) {
  await mongoose.model('Category').findByIdAndUpdate(
    this.parentCategory,
    { $pull: { subCategories: this._id } }
  );
  next();
});

const SubCategory = mongoose.model('SubCategory', subCategorySchema);

module.exports = SubCategory;
