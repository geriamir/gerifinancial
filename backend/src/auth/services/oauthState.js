const { createHmac, randomBytes, timingSafeEqual } = require('crypto');

// A login left unfinished for longer than this has to start again. Long enough
// to survive a slow GitHub authorisation, short enough that a captured state
// parameter is not replayable later.
const STATE_MAX_AGE_MS = 30 * 60 * 1000;

// Tolerance for state issued fractionally in the future by a skewed clock.
const CLOCK_SKEW_MS = 60 * 1000;

const MAX_STATE_LENGTH = 2048;

function hmac(secret, value) {
  return createHmac('sha256', secret).update(value).digest();
}

/**
 * Signs the OAuth `state` parameter.
 *
 * State has to survive a round trip through github.com, so it cannot be kept
 * server side without a session store. Instead it carries where the user should
 * land and when it was issued, authenticated by an HMAC so neither can be
 * tampered with, plus a nonce so two logins never produce the same string.
 */
function signOAuthState({ returnTo, now = Date.now() }, secret) {
  if (!secret) throw new Error('signOAuthState requires a secret');
  const payload = {
    n: randomBytes(16).toString('base64url'),
    t: now,
    r: returnTo
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${payloadB64}.${hmac(secret, payloadB64).toString('base64url')}`;
}

/**
 * Verifies a state parameter, returning its payload or null.
 *
 * Every failure returns null rather than throwing: a bad state is an ordinary
 * event on a public callback endpoint, not an exceptional one.
 */
function verifyOAuthState(state, secret, { maxAgeMs = STATE_MAX_AGE_MS, now = Date.now() } = {}) {
  if (typeof state !== 'string' || state.length === 0 || state.length > MAX_STATE_LENGTH) {
    return null;
  }
  const dot = state.indexOf('.');
  if (dot <= 0 || dot === state.length - 1) return null;

  const payloadB64 = state.slice(0, dot);
  const expectedSig = hmac(secret, payloadB64);
  const providedSig = Buffer.from(state.slice(dot + 1), 'base64url');
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (error) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.n !== 'string' || typeof payload.t !== 'number' || typeof payload.r !== 'string') {
    return null;
  }

  const age = now - payload.t;
  if (!Number.isFinite(age) || age < -CLOCK_SKEW_MS || age > maxAgeMs) return null;

  return { returnTo: payload.r, nonce: payload.n, issuedAt: payload.t };
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch (error) {
    return null;
  }
}

/**
 * Resolves where to send the browser after login, refusing anything not on the
 * allowlist.
 *
 * The callback redirects wherever this returns, so an unchecked value would
 * turn login into an open redirect: an attacker could walk a victim through a
 * genuine GitHub authorisation and have them land on a page of their choosing,
 * carrying the trust of having just signed in. Only origins already trusted for
 * CORS are accepted.
 */
function safeReturnTo(input, { allowedOrigins = [], fallback }) {
  if (!fallback) throw new Error('safeReturnTo requires a fallback');
  if (!input || typeof input !== 'string') return fallback;

  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_STATE_LENGTH) return fallback;

  // A relative path resolves against the fallback's origin so the browser
  // returns to the web app rather than the API host it is currently on.
  // "//evil.com" is protocol-relative rather than a path, so it is excluded.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    try {
      return new URL(trimmed, fallback).toString();
    } catch (error) {
      return fallback;
    }
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch (error) {
    return fallback;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;

  const permitted = new Set([...allowedOrigins.map(originOf), originOf(fallback)].filter(Boolean));
  if (!permitted.has(url.origin)) return fallback;

  return url.toString();
}

module.exports = {
  signOAuthState,
  verifyOAuthState,
  safeReturnTo,
  STATE_MAX_AGE_MS
};
