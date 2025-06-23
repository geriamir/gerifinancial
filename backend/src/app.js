const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config');

// Import routes
const authRoutes = require('./routes/auth');
const bankAccountRoutes = require('./routes/bankAccounts');
const testRoutes = require('./routes/test');

// Create Express app
const app = express();

// Connect to MongoDB (skip in test environment as it's handled by test setup)
if (config.env !== 'test') {
  mongoose.connect(config.mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);

// Test routes (only in test environment)
if (process.env.NODE_ENV === 'test') {
  app.use('/api/test', testRoutes);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
