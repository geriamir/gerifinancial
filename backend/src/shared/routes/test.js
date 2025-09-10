const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Test endpoint to check if API is running
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Test endpoint to check database connection
router.get('/db-status', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.json({
    status: 'ok',
    database: {
      state: states[dbState] || 'unknown',
      readyState: dbState
    },
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to clear test data (for integration tests)
router.delete('/clear-data', async (req, res) => {
  try {
    // Only allow in test environments
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'e2e') {
      return res.status(403).json({ error: 'Not allowed in this environment' });
    }

    // Get collection names to clear
    const collections = await mongoose.connection.db.listCollections().toArray();
    const clearPromises = collections.map(collection => 
      mongoose.connection.db.collection(collection.name).deleteMany({})
    );

    await Promise.all(clearPromises);

    res.json({
      status: 'ok',
      message: 'Test data cleared',
      collectionsCleared: collections.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear test data',
      message: error.message
    });
  }
});

// Test endpoint for creating test users
router.post('/create-test-user', async (req, res) => {
  try {
    // Only allow in test environments
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'e2e') {
      return res.status(403).json({ error: 'Not allowed in this environment' });
    }

    const User = require('../../auth/models/User');
    const userData = {
      email: req.body.email || `test-${Date.now()}@example.com`,
      name: req.body.name || 'Test User',
      password: req.body.password || 'testpassword123'
    };

    const user = new User(userData);
    await user.save();

    res.json({
      status: 'ok',
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create test user',
      message: error.message
    });
  }
});

module.exports = router;
