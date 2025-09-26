const { MongoClient } = require('mongodb');

async function testConnection() {
    // Use environment variables for connection, with fallbacks for local development
    const username = process.env.MONGO_ROOT_USERNAME || 'admin';
    const password = process.env.MONGO_ROOT_PASSWORD || 'password123';
    const port = process.env.MONGO_PORT || '27777';
    const database = process.env.MONGO_DATABASE || 'gerifinancial';
    
    const uri = `mongodb://${username}:${password}@localhost:${port}/${database}?authSource=admin`;
    const client = new MongoClient(uri);

    try {
        console.log(`Connecting to MongoDB on port ${port}...`);
        await client.connect();
        
        console.log('✅ Successfully connected to MongoDB!');
        console.log(`✅ Using database: ${database}`);
        
        // Test database operations
        const db = client.db(database);
        const testCollection = db.collection('test');
        
        // Insert a test document
        const result = await testCollection.insertOne({ 
            message: 'Hello from MongoDB!', 
            timestamp: new Date(),
            environment: process.env.NODE_ENV || 'development'
        });
        console.log('✅ Test document inserted:', result.insertedId);
        
        // Read the test document
        const doc = await testCollection.findOne({ _id: result.insertedId });
        console.log('✅ Test document retrieved:', doc);
        
        // Clean up
        await testCollection.deleteOne({ _id: result.insertedId });
        console.log('✅ Test document cleaned up');
        
    } catch (error) {
        console.error('❌ Connection failed:', error);
        console.error('💡 Make sure MongoDB is running and credentials are correct');
        console.error('💡 For local development, ensure docker-compose.override.yml exists');
    } finally {
        await client.close();
        console.log('Connection closed');
    }
}

testConnection();
