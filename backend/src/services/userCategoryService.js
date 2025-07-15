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
      { name: "Mortgage", keywords: ["mortgage", "משכנתא"] },
      { name: "Maintenance and Repairs", keywords: ["maintenance", "repairs", "תיקונים", "אחזקה"] },
      { name: "Property Tax", keywords: ["property tax", "arnona", "ארנונה"] },
      { name: "Cleaning and Laundry", keywords: ["cleaning", "laundry", "כביסה", "ניקיון"] },
      { name: "Communication", keywords: ["communication", "phone", "internet", "טלפון", "אינטרנט"] },
      { name: "Home Insurance", keywords: ["home insurance", "ביטוח דירה"] },
      { name: "Utilities", keywords: ["utilities", "electricity", "water", "gas", "חשמל", "מים", "גז"] },
      { name: "Gardening", keywords: ["gardening", "גינון"] }
    ]
  },
  {
    name: "Shopping",
    type: "Expense",
    subCategories: [
      { name: "Furniture and Decorations", keywords: ["furniture", "decorations", "רהיטים", "עיצוב"] },
      { name: "Appliances and Electronics", keywords: ["appliances", "electronics", "מוצרי חשמל"] },
      { name: "Groceries", keywords: ["groceries", "supermarket", "מכולת", "סופר"] },
      { name: "Apparel and Accessories", keywords: ["apparel", "clothing", "accessories", "בגדים", "אביזרים"] }
    ]
  },
  {
    name: "Family",
    type: "Expense",
    subCategories: [
      { name: "Daycare, Kids Activities and Summer Camps", keywords: ["daycare", "kids", "summer camps", "פעילויות ילדים", "קייטנה"] },
      { name: "Pets", keywords: ["pets", "vet", "חיות מחמד", "וטרינר"] },
      { name: "School", keywords: ["school", "education", "בית ספר", "חינוך"] },
      { name: "Toys", keywords: ["toys", "צעצועים"] },
      { name: "Babysitting", keywords: ["babysitting", "בייביסיטר"] },
      { name: "Family Miscellaneous", keywords: ["family", "משפחה"] }
    ]
  },
  {
    name: "Health",
    type: "Expense",
    subCategories: [
      { name: "Pharmacy", keywords: ["pharmacy", "pharm", "בית מרקחת"] },
      { name: "Fitness", keywords: ["fitness", "gym", "כושר"] },
      { name: "Health Insurance", keywords: ["health insurance", "ביטוח בריאות"] },
      { name: "Grooming", keywords: ["grooming", "hairdresser", "מספרה"] },
      { name: "Health Services", keywords: ["health services", "doctor", "רופא"] },
      { name: "Dental", keywords: ["dental", "dentist", "שיניים"] },
      { name: "Optometry", keywords: ["optometry", "glasses", "משקפיים"] },
      { name: "Health Miscellaneous", keywords: ["health", "בריאות"] }
    ]
  },
  {
    name: "Cars and Transportation",
    type: "Expense",
    subCategories: [
      { name: "Car Services", keywords: ["car services", "mechanic", "מוסך"] },
      { name: "Public Transportation", keywords: ["public transportation", "bus", "train", "תחבורה ציבורית"] },
      { name: "Fuel", keywords: ["fuel", "gas", "דלק"] },
      { name: "Toll Roads", keywords: ["toll roads", "כביש אגרה"] },
      { name: "Parking", keywords: ["parking", "חניה"] },
      { name: "Cars Miscellaneous", keywords: ["cars", "רכב"] }
    ]
  },
  {
    name: "Eating Out",
    type: "Expense",
    subCategories: [
      { name: "Coffee shops, Restaurant and Pubs", keywords: ["restaurant", "coffee", "pub", "מסעדה", "בית קפה"] },
      { name: "Take Away", keywords: ["take away", "delivery", "משלוח"] },
      { name: "Eating Out - Miscellaneous", keywords: ["eating out", "אוכל בחוץ"] }
    ]
  },
  {
    name: "Entertainment",
    type: "Expense",
    subCategories: [
      { name: "Movies and Shows", keywords: ["movies", "shows", "cinema", "קולנוע"] },
      { name: "Music and Reading", keywords: ["music", "reading", "books", "מוזיקה", "ספרים"] },
      { name: "Entertainment - Miscellaneous", keywords: ["entertainment", "בילוי"] }
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
        name: "Bank Fees",
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
      }
    ]
  },
  {
    name: "Travel",
    type: "Expense",
    subCategories: [
      { name: "Flights", keywords: ["flights", "airline", "טיסות"] },
      { name: "Hotels", keywords: ["hotels", "accommodation", "בתי מלון"] },
      { name: "Recreation", keywords: ["recreation", "tourist", "תיירות"] },
      { name: "Travel Transportation", keywords: ["travel transportation", "taxi", "rental car", "תחבורה בנסיעות"] },
      { name: "Travel - Miscellaneous", keywords: ["travel", "vacation", "נסיעות"] }
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
          // All subcategories now use consistent object format
          const subCategory = new SubCategory({
            name: subCatData.name,
            parentCategory: category._id,
            isDefault: true,
            keywords: subCatData.keywords || [],
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
