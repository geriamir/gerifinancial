const mongoose = require('mongoose');

async function checkMongoConnection() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27777/gerifinancial-test';
    console.log('Trying to connect to MongoDB at:', uri);
    
    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connection successful');
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}

checkMongoConnection();
