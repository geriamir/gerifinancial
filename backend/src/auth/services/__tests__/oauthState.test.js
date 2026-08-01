const {
  signOAuthState,
  verifyOAuthState,
  safeReturnTo,
  STATE_MAX_AGE_MS
} = require('../oauthState');

const SECRET = 'test-oauth-state-secret-value';

describe('oauthState', () => {
  describe('sign and verify', () => {
    it('round trips the return destination', () => {
      const state = signOAuthState({ returnTo: 'https://app.example.com/budgets' }, SECRET);
      const verified = verifyOAuthState(state, SECRET);

      expect(verified).not.toBeNull();
      expect(verified.returnTo).toBe('https://app.example.com/budgets');
    });

    it('gives every login a distinct state', () => {
      const first = signOAuthState({ returnTo: 'https://app.example.com/' }, SECRET);
      const second = signOAuthState({ returnTo: 'https://app.example.com/' }, SECRET);

      expect(first).not.toBe(second);
    });

    it('rejects state signed with a different secret', () => {
      const state = signOAuthState({ returnTo: 'https://app.example.com/' }, 'another-secret');

      expect(verifyOAuthState(state, SECRET)).toBeNull();
    });

    it('rejects a tampered return destination', () => {
      const state = signOAuthState({ returnTo: 'https://app.example.com/' }, SECRET);
      const forgedPayload = Buffer.from(
        JSON.stringify({ n: 'x', t: Date.now(), r: 'https://evil.example.com/' }),
        'utf8'
      ).toString('base64url');
      const tampered = `${forgedPayload}.${state.slice(state.indexOf('.') + 1)}`;

      expect(verifyOAuthState(tampered, SECRET)).toBeNull();
    });

    it('rejects state that has expired', () => {
      const issuedAt = Date.now() - (STATE_MAX_AGE_MS + 1000);
      const state = signOAuthState({ returnTo: 'https://app.example.com/', now: issuedAt }, SECRET);

      expect(verifyOAuthState(state, SECRET)).toBeNull();
    });

    it('accepts state that is still within its lifetime', () => {
      const issuedAt = Date.now() - (STATE_MAX_AGE_MS - 5000);
      const state = signOAuthState({ returnTo: 'https://app.example.com/', now: issuedAt }, SECRET);

      expect(verifyOAuthState(state, SECRET)).not.toBeNull();
    });

    it('rejects malformed input without throwing', () => {
      expect(verifyOAuthState('', SECRET)).toBeNull();
      expect(verifyOAuthState('no-separator', SECRET)).toBeNull();
      expect(verifyOAuthState('.leading', SECRET)).toBeNull();
      expect(verifyOAuthState('trailing.', SECRET)).toBeNull();
      expect(verifyOAuthState(null, SECRET)).toBeNull();
      expect(verifyOAuthState(undefined, SECRET)).toBeNull();
      expect(verifyOAuthState('a'.repeat(5000), SECRET)).toBeNull();
    });
  });

  describe('safeReturnTo', () => {
    const fallback = 'https://app.example.com';
    const allowedOrigins = ['https://app.example.com', 'https://staging.example.com'];

    it('falls back when nothing was requested', () => {
      expect(safeReturnTo(undefined, { allowedOrigins, fallback })).toBe(fallback);
      expect(safeReturnTo('', { allowedOrigins, fallback })).toBe(fallback);
      expect(safeReturnTo('   ', { allowedOrigins, fallback })).toBe(fallback);
    });

    it('resolves a relative path against the frontend origin', () => {
      expect(safeReturnTo('/budgets', { allowedOrigins, fallback })).toBe(
        'https://app.example.com/budgets'
      );
    });

    it('keeps an absolute URL on an allowed origin', () => {
      expect(safeReturnTo('https://staging.example.com/rsus', { allowedOrigins, fallback })).toBe(
        'https://staging.example.com/rsus'
      );
    });

    it('refuses to redirect to an origin that is not allowed', () => {
      // The whole point of the allowlist: an attacker who can choose the
      // redirect turns login into a way to land victims on their own page.
      expect(safeReturnTo('https://evil.example.com/', { allowedOrigins, fallback })).toBe(fallback);
      expect(safeReturnTo('http://app.example.com.evil.com/', { allowedOrigins, fallback })).toBe(
        fallback
      );
    });

    it('refuses a protocol-relative URL disguised as a path', () => {
      expect(safeReturnTo('//evil.example.com/', { allowedOrigins, fallback })).toBe(fallback);
    });

    it('refuses non-http schemes', () => {
      expect(safeReturnTo('javascript:alert(1)', { allowedOrigins, fallback })).toBe(fallback);
      expect(safeReturnTo('data:text/html,<script></script>', { allowedOrigins, fallback })).toBe(
        fallback
      );
      expect(safeReturnTo('file:///etc/passwd', { allowedOrigins, fallback })).toBe(fallback);
    });

    it('allows the fallback origin even when the allowlist is empty', () => {
      expect(safeReturnTo('https://app.example.com/banks', { allowedOrigins: [], fallback })).toBe(
        'https://app.example.com/banks'
      );
    });
  });
});
