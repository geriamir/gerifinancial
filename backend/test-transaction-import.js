// Test script to validate Transaction model import
console.log('Testing Transaction model import...');

try {
  const { Transaction } = require('./src/banking');
  console.log('Transaction imported successfully:', !!Transaction);
  console.log('Transaction.find method exists:', typeof Transaction.find);
  console.log('Transaction.findOne method exists:', typeof Transaction.findOne);
  
  if (Transaction) {
    console.log('Transaction model name:', Transaction.modelName);
    console.log('Transaction collection name:', Transaction.collection.name);
  }
} catch (error) {
  console.error('Error importing Transaction:', error.message);
  console.error('Stack trace:', error.stack);
}

console.log('\nTesting direct Transaction model import...');
try {
  const Transaction = require('./src/banking/models/Transaction');
  console.log('Direct Transaction import successful:', !!Transaction);
  console.log('Direct Transaction.find method exists:', typeof Transaction.find);
} catch (error) {
  console.error('Error importing Transaction directly:', error.message);
  console.error('Stack trace:', error.stack);
}
