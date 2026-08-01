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

// Test endpoint for creating test users.
//
// Sign-in normally goes through GitHub, which end-to-end tests cannot drive.
// This mints the same session the OAuth callback would, so tests exercise the
// real authenticated app without depending on github.com. Restricted to the
// test and e2e environments below.
let syntheticGitHubIdCounter = 0;
const nextSyntheticGitHubId = () =>
  (Date.now() % 100000000) * 100 + (syntheticGitHubIdCounter++ % 100);

router.post('/create-test-user', async (req, res) => {
  try {
    // Only allow in test environments
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'e2e') {
      return res.status(403).json({ error: 'Not allowed in this environment' });
    }

    const User = require('../../auth/models/User');
    const { issueSession } = require('../../auth/routes/auth');
    const { initializeUserCategories } = require('../../monthly-budgets/services/userCategoryService');

    const email = req.body.email || `test-${Date.now()}@example.com`;

    // Seeding is idempotent: asking for a session for someone who already
    // exists signs them in rather than colliding on the unique email index.
    let user = await User.findOne({ email });

    if (!user) {
      // A GitHub id is required, so synthesise a unique one rather than making
      // callers invent it. A plain timestamp collides when two users are
      // seeded in the same millisecond, so mix in a counter.
      const githubId = req.body.githubId || nextSyntheticGitHubId();
      user = new User({
        email,
        name: req.body.name || 'Test User',
        githubId,
        githubLogin: req.body.githubLogin || `testuser${githubId}`
      });
      await user.save();
      await initializeUserCategories(user._id);
    }

    const token = issueSession(res, user);

    res.json({
      status: 'ok',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        githubLogin: user.githubLogin
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
