const express = require('express');
const router = express.Router();
const testDb = require('../test/testDb');

// Only enable in test and e2e environments
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e') {
  router.post('/clear-data', async (req, res) => {
    console.log('Clearing test data...');
    try {
      await testDb.clearDatabase();
      res.json({ message: 'Test data cleared successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = router;
