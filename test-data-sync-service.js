// Test script to verify dataSyncService export and function
const path = require('path');

console.log('Testing dataSyncService import and export...');

try {
    // Try to import the dataSyncService directly
    const dataSyncService = require('./backend/src/banking/services/dataSyncService');
    
    console.log('✅ dataSyncService imported successfully');
    console.log('Type:', typeof dataSyncService);
    console.log('Constructor:', dataSyncService.constructor.name);
    
    // Check if syncBankAccountData function exists
    if (typeof dataSyncService.syncBankAccountData === 'function') {
        console.log('✅ syncBankAccountData function exists');
        console.log('Function length (params):', dataSyncService.syncBankAccountData.length);
    } else {
        console.log('❌ syncBankAccountData function does NOT exist');
        console.log('Available methods:', Object.getOwnPropertyNames(dataSyncService));
    }
    
    // List all available methods
    console.log('\nAvailable methods on dataSyncService:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(dataSyncService))
        .filter(name => typeof dataSyncService[name] === 'function' && name !== 'constructor');
    methods.forEach(method => {
        console.log(`  - ${method}()`);
    });
    
} catch (error) {
    console.error('❌ Error importing dataSyncService:', error.message);
    console.error('Stack:', error.stack);
}
