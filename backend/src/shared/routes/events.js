const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const sseService = require('../services/sseService');
const logger = require('../utils/logger');

/**
 * SSE endpoint for real-time event streaming
 * GET /api/events
 * 
 * Establishes a Server-Sent Events connection for the authenticated user
 * Events are pushed from the server as they occur
 *
 * EventSource cannot set an Authorization header, which previously forced the
 * token into the query string where it leaks into access logs and Referer
 * headers. The session is now an httpOnly cookie that the browser attaches by
 * itself once the client opts in with withCredentials, so the ordinary auth
 * middleware is sufficient.
 */
router.get('/', auth, (req, res) => {
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
