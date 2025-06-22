const express = require('express');
const router = express.Router();
const testDb = require('../test/testDb');

// Only enable in test environment
if (process.env.NODE_ENV === 'test') {
  router.post('/clear-data', async (req, res) => {
    try {
      await testDb.clearDatabase();
      res.json({ message: 'Test data cleared successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = router;
