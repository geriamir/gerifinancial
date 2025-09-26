// This script demonstrates how MongoDB connection would work in production
// Run with: MONGO_ROOT_USERNAME=your_user MONGO_ROOT_PASSWORD=your_pass node test-production-config.js

const { MongoClient } = require('mongodb');

async function testProductionConfig() {
    // Check if environment variables are set
    const requiredVars = ['MONGO_ROOT_USERNAME', 'MONGO_ROOT_PASSWORD'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log('❌ Missing required environment variables:');
        missingVars.forEach(varName => {
            console.log(`   - ${varName}`);
        });
        console.log('\n💡 Example usage:');
        console.log('MONGO_ROOT_USERNAME=your_user MONGO_ROOT_PASSWORD=your_pass node test-production-config.js');
        process.exit(1);
    }

    const username = process.env.MONGO_ROOT_USERNAME;
    const password = process.env.MONGO_ROOT_PASSWORD;
    const port = process.env.MONGO_PORT || '27017';
    const database = process.env.MONGO_DATABASE || 'gerifinancial';
    
    const uri = `mongodb://${username}:${password}@localhost:${port}/${database}?authSource=admin`;
    
    console.log('🔧 Production Configuration Test');
    console.log(`   Port: ${port}`);
    console.log(`   Database: ${database}`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${'*'.repeat(password.length)}`);
    console.log('');

    const client = new MongoClient(uri);

    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        
        console.log('✅ Production configuration connection successful!');
        
        const db = client.db(database);
        const result = await db.admin().ping();
        console.log('✅ Database ping successful:', result);
        
    } catch (error) {
        console.error('❌ Production configuration failed:', error.message);
    } finally {
        await client.close();
        console.log('Connection closed');
    }
}

testProductionConfig();
