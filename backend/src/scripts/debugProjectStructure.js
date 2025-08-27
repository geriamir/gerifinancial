const mongoose = require('mongoose');
const { ProjectBudget } = require('../models');
const config = require('../config');

async function debugProjectStructure() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodbUri);
    console.log(`Connected to MongoDB at ${config.mongodbUri}`);

    // Find the problematic project
    const project = await ProjectBudget.findOne({
      'categoryBudgets.actualAmount': { $exists: true }
    });

    if (project) {
      console.log('\n=== PROJECT STRUCTURE ===');
      console.log('Project ID:', project._id);
      console.log('Project Name:', project.name);
      console.log('\n=== CATEGORY BUDGETS ===');
      
      project.categoryBudgets.forEach((budget, index) => {
        console.log(`\nCategory Budget ${index}:`);
        console.log('  categoryId:', budget.categoryId);
        console.log('  subCategoryId:', budget.subCategoryId);
        console.log('  budgetAmount:', budget.budgetAmount);
        console.log('  actualAmount:', budget.actualAmount);
        console.log('  allocatedTransactions:', budget.allocatedTransactions?.length || 0);
        console.log('  Full budget object keys:', Object.keys(budget.toObject ? budget.toObject() : budget));
      });

      // Try manual removal
      console.log('\n=== MANUAL REMOVAL ATTEMPT ===');
      
      const updatedCategoryBudgets = project.categoryBudgets.map(budget => {
        const budgetObj = budget.toObject ? budget.toObject() : budget;
        console.log('Before removal keys:', Object.keys(budgetObj));
        delete budgetObj.actualAmount;
        console.log('After removal keys:', Object.keys(budgetObj));
        return budgetObj;
      });

      const updateResult = await ProjectBudget.updateOne(
        { _id: project._id },
        { $set: { categoryBudgets: updatedCategoryBudgets } }
      );

      console.log('Update result:', updateResult);

      // Verify removal
      const updatedProject = await ProjectBudget.findById(project._id);
      const hasActualAmount = updatedProject.categoryBudgets.some(budget => 
        budget.actualAmount !== undefined
      );
      console.log('Still has actualAmount after manual removal:', hasActualAmount);

    } else {
      console.log('No projects found with actualAmount fields');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugProjectStructure();
