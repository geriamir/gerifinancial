const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const sseService = require('../services/sseService');
const logger = require('../utils/logger');

/**
 * Custom middleware to handle auth for SSE (supports query param token)
 * SSE connections can't set custom headers, so we allow token in query string
 */
const sseAuth = (req, res, next) => {
  // Try to get token from query parameter first (for SSE EventSource)
  const queryToken = req.query.token;
  
  if (queryToken) {
    // Set it in the header so the auth middleware can pick it up
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  
  // Now call the regular auth middleware
  auth(req, res, next);
};

/**
 * SSE endpoint for real-time event streaming
 * GET /api/events
 * 
 * Establishes a Server-Sent Events connection for the authenticated user
 * Events are pushed from the server as they occur
 */
router.get('/', sseAuth, (req, res) => {
  try {
    // Auth middleware sets req.user to the full User document
    const userId = req.user._id || req.user.userId;
    
    if (!userId) {
      logger.error('[SSE] No userId found in request.user:', req.user);
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const userIdStr = userId.toString();
    logger.info(`[SSE] ✅ New connection request from user ${userIdStr}`);

    // Add client to SSE service
    sseService.addClient(userIdStr, res);

    // Send initial status
    sseService.emit(userIdStr, 'connection:established', {
      userId: userIdStr,
      timestamp: new Date().toISOString(),
      message: 'Event stream established successfully'
    });
    
    logger.info(`[SSE] Client registered with userId: ${userIdStr}`);
  } catch (error) {
    logger.error('[SSE] Error establishing connection:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish SSE connection', message: error.message });
    }
  }
});

/**
 * Get SSE service statistics (admin endpoint)
 * GET /api/events/stats
 */
router.get('/stats', auth, (req, res) => {
  const stats = sseService.getStats();
  res.json({
    success: true,
    data: stats
  });
});

module.exports = router;
