const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

const defaultCategories = [
  {
    name: "Household",
    type: "Expense",
    subCategories: [
      "Mortgage",
      "Maintenance and Repairs",
      "Property Tax",
      "Cleaning and Laundry",
      "Communication",
      "Home Insurance",
      "Utilities",
      "Gardening"
    ]
  },
  {
    name: "Shopping",
    type: "Expense",
    subCategories: [
      "Furniture and Decorations",
      "Appliances and Electronics",
      "Groceries",
      "Apparel and Accessories"
    ]
  },
  {
    name: "Family",
    type: "Expense",
    subCategories: [
      "Activities",
      "Pets",
      "School",
      "Toys",
      "Family Miscellaneous"
    ]
  },
  {
    name: "Health",
    type: "Expense",
    subCategories: [
      "Pharm",
      "Fitness",
      "Health Insurance",
      "Grooming",
      "Health Services",
      "Dental",
      "Optometry",
      "Health Miscellaneous"
    ]
  },
  {
    name: "Cars and Transportation",
    type: "Expense",
    subCategories: [
      "Car Services",
      "Public Transportation",
      "Fuel",
      "Toll Roads",
      "Parking",
      "Cars Miscellaneous"
    ]
  },
  {
    name: "Eating Out",
    type: "Expense",
    subCategories: [
      "Coffee shops, Restaurant and Pubs",
      "Take Away",
      "Eating Out - Miscellaneous"
    ]
  },
  {
    name: "Entertainment",
    type: "Expense",
    subCategories: [
      "Movies and Shows",
      "Music and Reading",
      "Entertainment - Miscellaneous"
    ]
  },
  {
    name: "Miscellaneous",
    type: "Expense",
    subCategories: [
      "Taxes and Government"
    ]
  },
  {
    name: "Financial Services",
    type: "Expense",
    subCategories: [
      "Fees"
    ]
  },
  {
    name: "Travel",
    type: "Expense",
    subCategories: [
      "Flights",
      "Hotels",
      "Recreation",
      "Travel Transportation",
      "Travel - Miscellaneous"
    ]
  }
];

async function initializeUserCategories(userId) {
  try {
    const userCategories = [];

    for (const categoryData of defaultCategories) {
      // Create category for the user
      const category = new Category({
        name: categoryData.name,
        type: categoryData.type,
        userId: userId // Associate category with user
      });
      await category.save();
      userCategories.push(category);

      // Create subcategories for this category
      for (const subCategoryName of categoryData.subCategories) {
        const subCategory = new SubCategory({
          name: subCategoryName,
          parentCategory: category._id,
          isDefault: true,
          keywords: [subCategoryName.toLowerCase()],
          userId: userId // Associate subcategory with user
        });
        await subCategory.save();

        // Add subcategory reference to category
        category.subCategories.push(subCategory._id);
      }

      // Save category with subcategory references
      await category.save();
    }

    return userCategories;
  } catch (error) {
    console.error('Error initializing user categories:', error);
    throw error;
  }
}

module.exports = {
  initializeUserCategories
};
