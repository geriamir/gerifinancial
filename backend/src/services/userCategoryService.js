const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

const defaultCategories = [
  // Income categories (flattened - no subcategories)
  {
    name: "Salary",
    type: "Income",
    keywords: ["salary", "משכורת", "שכר"]
  },
  {
    name: "Allowance",
    type: "Income",
    keywords: ["קצבה", "מענק", "פיצויים", "פיצוי", "קצבת"]
  },
  {
    name: "Dividends and Profits",
    type: "Income",
    keywords: ["דיבידנד", "רווחים", "רבית"]
  },
  {
    name: "Refunds",
    type: "Income",
    keywords: ["החזר", "זיכוי"]
  },
  {
    name: "Income Miscellaneous",
    type: "Income",
    keywords: ["פייבוקס", "ביט"]
  },
  // Transfer categories (flattened - no subcategories)
  {
    name: "Credit Card",
    type: "Transfer",
    keywords: ["דיינרס", "אשראי", "ישראכרט", "ויזה", "מאסטרקארד", "כרטיס אשראי"]
  },
  {
    name: "Savings",
    type: "Transfer",
    keywords: ["אלטשולר"]
  },
  {
    name: "Investments",
    type: "Transfer",
    keywords: ["נייר ערך"]
  },
  {
    name: "Cash Withdrawal",
    type: "Transfer",
    keywords: ["מזומן", "משיכה", "כספומט"]
  },
  // Expense categories (unchanged - keep category → subcategory structure)
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
      "Daycare, Kids Activities and Sunmer Camps",
      "Pets",
      "School",
      "Toys",
      "Babysitting",
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
      {
        name: "Taxes and Government",
        keywords: ["מס", "מיסים", 'מע"מ', "ביטוח לאומי", "מס הכנסה"]
      }
    ]
  },
  {
    name: "Financial Services",
    type: "Expense",
    subCategories: [
      {
        name:"Bank Fees",
        keywords: ["עמ.", "עמלת", "עמל"]
      },
      {
        name: "Loan Payments",
        keywords: []
      },
      {
        name: "Interest Payments",
        keywords: []
      },
      {
        name: "Financial Services - Miscellaneous",
        keywords: []
      },
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
        keywords: categoryData.keywords || [], // Add keywords for Income/Transfer categories
        userId: userId // Associate category with user
      });
      await category.save();
      userCategories.push(category);

      // Create subcategories only for Expense categories
      if (categoryData.subCategories && categoryData.subCategories.length > 0) {
        for (const subCatData of categoryData.subCategories) {
          // Handle both string and object subcategory definitions
          const subCategoryName = typeof subCatData === 'string' ? subCatData : subCatData.name;
          const keywords = typeof subCatData === 'string' ? [subCategoryName.toLowerCase()] : subCatData.keywords;
          
          const subCategory = new SubCategory({
            name: subCategoryName,
            parentCategory: category._id,
            isDefault: true,
            keywords: keywords,
            userId: userId // Associate subcategory with user
          });
          await subCategory.save();

          // Add subcategory reference to category
          category.subCategories.push(subCategory._id);
        }

        // Save category with subcategory references
        await category.save();
      }
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
