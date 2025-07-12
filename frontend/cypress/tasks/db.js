const { MongoClient, ObjectId } = require('mongodb');

const DESCRIPTIONS = [
  'Internet Bill - Partner',
  'Electricity Bill - IEC',
  'Supermarket - Shufersal',
  'Restaurant - Japanika',
  'Public Transport - Rav Kav',
  'Monthly Salary',
  'Rent Payment',
  'Transfer to Savings'
];

const TYPES = ['Expense', 'Income', 'Transfer'];

const convertToObjectId = (id) => {
  try {
    return typeof id === 'string' ? new ObjectId(id) : id;
  } catch (error) {
    console.error('Invalid ObjectId:', id, error);
    throw new Error('Invalid ID format');
  }
};

const generateTransaction = (baseDate, index, userId, accountId) => {
  // Generate dates within test window with consistent UTC timing
  // Generate dates within 15-day window centered on baseDate
  const date = new Date(baseDate);
  const daysOffset = Math.floor(Math.random() * 31) - 15; // -15 to +15 days from base date
  date.setDate(date.getDate() + daysOffset);
  date.setUTCHours(12, 0, 0, 0); // Use noon UTC to avoid timezone boundary issues
  
  // Debug logging
  // console.log('Generated date:', {
  //   baseDate: new Date(baseDate).toISOString(),
  //   offset: daysOffset,
  //   resultDate: date.toISOString()
  // });
  
  // Ensure a mix of transaction types - for each group of 3 transactions, use all types
  const type = TYPES[index % TYPES.length];
  
  // Select appropriate description and amount based on type
  let description, amount;
  if (type === 'Expense') {
    description = DESCRIPTIONS.slice(0, 5)[Math.floor(Math.random() * 5)]; // First 5 are expenses
    amount = -(Math.floor(Math.random() * 1000) + 100);
  } else if (type === 'Income') {
    description = 'Monthly Salary';
    amount = Math.floor(Math.random() * 5000) + 5000;
  } else { // Transfer
    description = 'Transfer to Savings';
    amount = Math.floor(Math.random() * 1000) + 1000;
  }

  // console.log('Generated transaction:', { type, description, amount, date });

  return {
    _id: new ObjectId(),
    userId: convertToObjectId(userId),
    accountId: convertToObjectId(accountId || new ObjectId()), // Use provided accountId or generate new one
    identifier: `TEST-${Date.now()}-${index}`, // Add unique identifier
    amount,
    currency: 'ILS',
    date: date, // Store as Date object instead of string
    description,
    type,
    status: 'verified',
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

const getMongoClient = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27777/gerifinancial-e2e';
  console.log('Connecting to MongoDB:', uri);
  return await MongoClient.connect(uri);
};

module.exports = {
  clearTestData: async () => {
    try {
      const client = await getMongoClient();
      const db = client.db();
      
      // Clear all test collections
      const results = await Promise.all([
        db.collection('transactions').deleteMany({}),
        db.collection('users').deleteMany({}),
        db.collection('categories').deleteMany({})
      ]);
      
      await client.close();
      console.log('Test data cleared');
      
      return {
        success: true,
        deletedCounts: {
          transactions: results[0].deletedCount,
          users: results[1].deletedCount,
          categories: results[2].deletedCount
        }
      };
    } catch (error) {
      console.error('Failed to clear test data:', error);
      throw error;
    }
  },
  
  addTransactions: async ({ count = 30, baseDate, userId, accountId }) => {
    try {
      console.log('Adding transactions with params:', { count, baseDate, userId, accountId });
      
      const client = await getMongoClient();
      const db = client.db();
      
      const transactions = Array.from({ length: count }, (_, i) => 
        generateTransaction(baseDate, i, userId, accountId)
      );

      // Log transaction types distribution
      const typeCount = transactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {});
      
      // console.log('Generated transactions:', {
      //   sample: transactions.slice(0, 2).map(t => ({
      //     _id: t._id.toString(),
      //     userId: t.userId.toString(),
      //     description: t.description,
      //     amount: t.amount,
      //     type: t.type
      //   })),
      //   typeDistribution: typeCount
      // });
      
      const result = await db.collection('transactions').insertMany(transactions);
      await client.close();
      
      // console.log('Transactions inserted:', {
      //   requested: count,
      //   inserted: result.insertedCount,
      //   success: result.insertedCount === count
      // });
      
      return {
        success: true,
        insertedCount: result.insertedCount,
        transactions
      };
    } catch (error) {
      console.error('Failed to add transactions:', error);
      throw error;
    }
  }
};
