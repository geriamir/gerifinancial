/**
 * Backfill CategoryBudget entries for all expense subcategories
 * that are missing one. Uses findOrCreate so it's safe to run multiple times.
 */
const mongoose = require('mongoose');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Category = require('../src/banking/models/Category');
const CategoryBudget = require('../src/monthly-budgets/models/CategoryBudget');

async function backfill() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI or MONGO_URI found in environment');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const categories = await Category.find({ type: 'Expense' }).populate('subCategories');
  let created = 0;
  let existing = 0;

  for (const category of categories) {
    for (const sub of category.subCategories || []) {
      const userId = sub.userId || category.userId;
      if (!userId) continue;

      const exists = await CategoryBudget.findOne({
        userId,
        categoryId: category._id,
        subCategoryId: sub._id,
      });

      if (exists) {
        existing++;
      } else {
        await CategoryBudget.findOrCreate(userId, category._id, sub._id);
        created++;
        console.log(`  Created: ${category.name} > ${sub.name} (user: ${userId})`);
      }
    }
  }

  console.log(`\nDone. Created: ${created}, Already existed: ${existing}`);
  await mongoose.disconnect();
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
