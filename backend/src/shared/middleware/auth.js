const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../../auth/models/User');

/**
 * Reads the session token.
 *
 * The browser authenticates with an httpOnly cookie, which JavaScript cannot
 * read and so cannot be lifted by an XSS payload. The Authorization header
 * stays supported for non-browser callers and for tests that mint a token
 * directly.
 */
function extractToken(req) {
  const cookieToken = req.cookies && req.cookies[config.session.cookieName];
  if (cookieToken) return cookieToken;

  const header = req.header('Authorization');
  if (header && header.startsWith('Bearer ')) return header.slice('Bearer '.length);

  return null;
}

const auth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new Error('No session token');
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

module.exports = auth;
module.exports.extractToken = extractToken;
