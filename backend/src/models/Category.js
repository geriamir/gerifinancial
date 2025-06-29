const mongoose = require('mongoose');

// Require SubCategory schema (not model) to avoid circular dependencies
require('./SubCategory');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['Expense', 'Income', 'Transfer'],
  },
  subCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory'
  }],
}, {
  timestamps: true,
});

// Ensure category names are unique per type
categorySchema.index({ name: 1, type: 1 }, { unique: true });

// Add method to get all categories with populated subcategories
categorySchema.statics.getAllWithSubCategories = async function() {
  return this.find({})
    .populate({
      path: 'subCategories',
      select: 'name keywords isDefault'
    })
    .lean()
    .exec();
};

// Add method to find or create a category
categorySchema.statics.findOrCreate = async function(categoryData) {
  let category = await this.findOne({
    name: categoryData.name,
    type: categoryData.type
  });

  if (!category) {
    category = new this(categoryData);
    await category.save();
  }

  return category;
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
