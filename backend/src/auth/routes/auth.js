const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../../shared/config/index');
const auth = require('../../shared/middleware/auth');
const logger = require('../../shared/utils/logger');
const { GitHubOAuthClient } = require('../services/githubOAuth');
const { signOAuthState, verifyOAuthState, safeReturnTo } = require('../services/oauthState');
const { initializeUserCategories } = require('../../monthly-budgets/services/userCategoryService');

const router = express.Router();

const CALLBACK_PATH = '/api/auth/github/callback';

// Origins the browser may be returned to after login. Reusing the CORS
// allowlist keeps one list of trusted frontends rather than two that can drift.
function allowedOrigins() {
  return (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

let cachedClient;

/**
 * Builds the OAuth client lazily so the app still starts, and every other route
 * still works, when GitHub credentials are absent. Only the login routes fail,
 * and they say why.
 */
function getOAuthClient() {
  // An injected client wins, so tests can drive the flow without reaching
  // github.com and without needing real credentials configured.
  if (cachedClient) return cachedClient;
  if (!config.github.clientId || !config.github.clientSecret) return null;

  cachedClient = new GitHubOAuthClient({
    clientId: config.github.clientId,
    clientSecret: config.github.clientSecret,
    redirectUri: `${config.github.publicApiUrl}${CALLBACK_PATH}`
  });
  return cachedClient;
}

// Test seam: lets a suite install a stub client instead of reaching github.com.
function setOAuthClient(client) {
  cachedClient = client;
}

function issueSession(res, user) {
  // The token and the cookie carrying it must expire together. Deriving maxAge
  // from the signed exp claim rather than from a second config value means the
  // two cannot drift apart: a cookie that outlives its token would leave the
  // browser looking signed in while every request came back 401.
  const token = jwt.sign({ userId: user._id }, config.jwtSecret, {
    expiresIn: config.github.sessionTtlSeconds
  });
  const { exp } = jwt.decode(token);

  res.cookie(config.session.cookieName, token, {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: config.session.crossSite ? 'none' : 'lax',
    maxAge: exp * 1000 - Date.now(),
    path: '/'
  });

  return token;
}

/**
 * Finds or creates the account behind a GitHub profile.
 *
 * Matching is on the numeric GitHub id rather than the login or email, because
 * both of those can be changed by their owner and later claimed by somebody
 * else, whereas the id is permanent.
 */
async function upsertGitHubUser(profile) {
  const existing = await User.findOne({ githubId: profile.id });

  if (existing) {
    existing.githubLogin = profile.login;
    existing.name = profile.name || profile.login;
    existing.avatarUrl = profile.avatarUrl;
    if (profile.email) existing.email = profile.email;
    await existing.save();
    return { user: existing, created: false };
  }

  const user = new User({
    githubId: profile.id,
    githubLogin: profile.login,
    name: profile.name || profile.login,
    email: profile.email || null,
    avatarUrl: profile.avatarUrl
  });
  await user.save();

  // A user without their default categories cannot budget anything, so a
  // half-provisioned account is worse than none: roll it back and let them
  // retry rather than leaving them permanently broken.
  try {
    await initializeUserCategories(user._id);
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }

  return { user, created: true };
}

// Starts the OAuth flow. The browser is sent to GitHub carrying signed state
// that remembers where to return to.
router.get('/github/login', (req, res) => {
  const client = getOAuthClient();
  if (!client) {
    return res.status(503).json({ error: 'GitHub sign-in is not configured' });
  }

  const returnTo = safeReturnTo(req.query.return_to, {
    allowedOrigins: allowedOrigins(),
    fallback: config.github.defaultReturnTo
  });
  const state = signOAuthState({ returnTo }, config.jwtSecret);

  return res.redirect(client.authorizeUrl(state));
});

// GitHub redirects here with an authorization code. Everything before the
// exchange is validation of what the browser handed us.
router.get('/github/callback', async (req, res) => {
  const client = getOAuthClient();
  if (!client) {
    return res.status(503).json({ error: 'GitHub sign-in is not configured' });
  }

  const verified = verifyOAuthState(req.query.state, config.jwtSecret);
  // Checking state before anything else matters: without it this request
  // cannot be shown to have started from our own login route.
  if (!verified) {
    logger.warn('GitHub callback rejected: invalid state');
    return res.status(400).json({ error: 'invalid_state' });
  }

  const returnTo = safeReturnTo(verified.returnTo, {
    allowedOrigins: allowedOrigins(),
    fallback: config.github.defaultReturnTo
  });

  if (req.query.error) {
    // The user declined authorisation. That is a normal outcome, so send them
    // back to the app rather than showing them a JSON error.
    logger.info(`GitHub callback returned an error: ${req.query.error}`);
    // Built through URL rather than concatenated: returnTo may already carry a
    // query string or a fragment, and appending after a fragment would produce
    // a parameter the browser never parses.
    const target = new URL(returnTo);
    target.searchParams.set('auth_error', 'access_denied');
    return res.redirect(target.toString());
  }

  if (!req.query.code) {
    return res.status(400).json({ error: 'missing_code' });
  }

  try {
    const accessToken = await client.exchangeCode(req.query.code);
    const profile = await client.getUser(accessToken);
    const { user, created } = await upsertGitHubUser(profile);

    issueSession(res, user);
    logger.info(`GitHub sign-in ${created ? 'created' : 'resumed'} account for ${profile.login}`);

    return res.redirect(returnTo);
  } catch (error) {
    logger.error(`GitHub sign-in failed: ${error.message}`);
    return res.status(502).json({ error: 'github_sign_in_failed' });
  }
});

router.post('/logout', (req, res) => {
  // The options must match those used to set the cookie or the browser keeps it.
  res.clearCookie(config.session.cookieName, {
    httpOnly: true,
    secure: config.session.secure,
    sameSite: config.session.crossSite ? 'none' : 'lax',
    path: '/'
  });
  return res.json({ success: true });
});

router.get('/profile', auth, async (req, res) => {
  return res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      githubLogin: req.user.githubLogin,
      avatarUrl: req.user.avatarUrl,
      displayCurrency: req.user.displayCurrency || 'ILS'
    }
  });
});

module.exports = router;
module.exports.upsertGitHubUser = upsertGitHubUser;
module.exports.setOAuthClient = setOAuthClient;
module.exports.issueSession = issueSession;
