const { Category, SubCategory } = require('../../banking');

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
  {
    name: "Internal Transfers - Miscellaneous",
    type: "Transfer",
    keywords: ["internal", "transfer", "misc", "העברה פנימית", "העברה", "פנימי"]
  },
  // Expense categories (unchanged - keep category → subcategory structure)
  {
    name: "Household",
    type: "Expense",
    subCategories: [
      { name: "Mortgage", keywords: ["mortgage", "משכנתא"] },
      { name: "Property Tax", keywords: ["property tax", "arnona", "ארנונה"] },
      { name: "Communication", keywords: ["communication", "phone", "internet", "טלפון", "אינטרנט"] },
      { name: "Maintenance and Repairs", keywords: ["maintenance", "repairs", "תיקונים", "אחזקה"] },
      { name: "Utilities", keywords: ["utilities", "electricity", "water", "gas", "חשמל", "מים", "גז"] },
      { name: "Home Insurance", keywords: ["home insurance", "ביטוח דירה"] },
      { name: "Cleaning and Laundry", keywords: ["cleaning", "laundry", "כביסה", "ניקיון"] },
      { name: "Gardening", keywords: ["gardening", "גינון"] }
    ]
  },
  {
    name: "Shopping",
    type: "Expense",
    subCategories: [
      { name: "Groceries", keywords: ["groceries", "supermarket", "מכולת", "סופר", "מזון"] },
      { name: "Furniture and Decorations", keywords: ["furniture", "decorations", "רהיטים"] },
      { name: "Appliances and Electronics", keywords: ["appliances", "electronics", "מוצרי חשמל"] },
      { name: "Apparel and Accessories", keywords: ["apparel", "clothing", "accessories", "בגדים", "אביזרים", "אופנה"] }
    ]
  },
  {
    name: "Family",
    type: "Expense",
    subCategories: [
      { name: "Daycare, Kids Activities and Summer Camps", keywords: ["daycare", "kids", "summer camps", "פעילויות ילדים", "קייטנה"] },
      { name: "School", keywords: ["school", "education", "בית ספר", "חינוך"] },
      { name: "Private Tutors", keywords: [] },
      { name: "Pets", keywords: ["pets", "vet", "חיות מחמד", "וטרינר"] },
      { name: "Toys", keywords: ["toys", "צעצועים"] },
      { name: "Babysitting", keywords: ["babysitting", "בייביסיטר"] },
      { name: "Family Miscellaneous", keywords: ["family", "משפחה"] }
    ]
  },
  {
    name: "Health",
    type: "Expense",
    subCategories: [
      { name: "Health Services", keywords: ["health services", "doctor", "רופא"] },
      { name: "Pharmacy", keywords: ["pharmacy", "pharm", "בית מרקחת"] },
      { name: "Health Insurance", keywords: ["health insurance", "ביטוח בריאות"] },
      { name: "Fitness", keywords: ["fitness", "gym", "כושר"] },
      { name: "Grooming", keywords: ["grooming", "hairdresser", "מספרה"] },
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
      { name: "Fuel", keywords: ["fuel", "gas", "דלק", "סונול"] },
      { name: "Public Transportation", keywords: ["public transportation", "bus", "train", "תחבורה ציבורית"] },
      { name: "Toll Roads", keywords: ["toll roads", "כביש אגרה"] },
      { name: "Parking", keywords: ["parking", "חניה", "חניון"] },
      { name: "Car Insurance", keywords: ["car insurance", "ביטוח רכב"] },
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
      { name: "Gifts, Weddings and Celebrations", keywords: ["gifts", "weddings", "celebrations", "מתנות", "חתונה", "מתנה"] },
      { name: "Entertainment - Miscellaneous", keywords: ["entertainment", "בילוי"] }
    ]
  },
  {
    name: "Travel",
    type: "Expense",
    subCategories: [
      { name: "Flights", keywords: ["flights", "airline", "טיסות", "airlines"] },
      { name: "Hotels", keywords: ["hotels", "accommodation", "בתי מלון"] },
      { name: "Recreation", keywords: ["recreation", "tourist", "תיירות"] },
      { name: "Travel Transportation", keywords: ["travel transportation", "taxi", "rental car", "תחבורה בנסיעות"] },
      { name: "Travel Insurance", keywords: ["travel insurance", "ביטוח נסיעות"] },
      { name: "Travel - Miscellaneous", keywords: ["travel", "vacation", "נסיעות"] }
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
    name: "Miscellaneous",
    type: "Expense",
    subCategories: [
      {
        name: "Taxes and Government",
        keywords: ["מס", "מיסים", 'מע"מ', "ביטוח לאומי", "מס הכנסה"]
      }
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
  initializeUserCategories,
  defaultCategories
};
