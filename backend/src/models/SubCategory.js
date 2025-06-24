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
  }
}, {
  timestamps: true,
});

// Ensure subcategory names are unique within their parent category
subCategorySchema.index({ name: 1, parentCategory: 1 }, { unique: true });

// Add method to find matching subcategories based on description
subCategorySchema.statics.findMatchingSubCategories = async function(description) {
  const normalizedDescription = description.toLowerCase();
  
  return this.find({
    keywords: {
      $in: [new RegExp(normalizedDescription, 'i')]
    }
  }).populate('parentCategory');
};

// Add method to find or create a subcategory
subCategorySchema.statics.findOrCreate = async function(subCategoryData) {
  let subCategory = await this.findOne({
    name: subCategoryData.name,
    parentCategory: subCategoryData.parentCategory
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
