const request = require('supertest');
const { createTestUser } = require('../../../test/testUtils');
const app = require('../../../app');
const { User } = require('../../models');
const config = require('../../../shared/config');
const { setOAuthClient } = require('../auth');
const { signOAuthState } = require('../../services/oauthState');

const SESSION_COOKIE = config.session.cookieName;

// Stands in for github.com so the flow can be driven end to end without
// leaving the test process.
class StubOAuthClient {
  constructor(profile) {
    this.profile = profile;
    this.exchanged = [];
  }

  authorizeUrl(state) {
    return `https://github.com/login/oauth/authorize?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(code) {
    this.exchanged.push(code);
    if (code === 'bad-code') throw new Error('bad_verification_code');
    return 'access-token';
  }

  async getUser() {
    return this.profile;
  }
}

const defaultProfile = {
  id: 12345,
  login: 'octocat',
  email: 'octocat@example.com',
  name: 'The Octocat',
  avatarUrl: 'https://avatars.example.com/octocat'
};

const sessionCookieFrom = (response) => {
  const cookies = response.headers['set-cookie'] || [];
  return cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
};

describe('Auth Routes', () => {
  let stub;

  beforeEach(() => {
    stub = new StubOAuthClient({ ...defaultProfile });
    setOAuthClient(stub);
    process.env.CORS_ORIGIN = 'http://localhost:3000';
  });

  afterEach(() => {
    setOAuthClient(null);
    delete process.env.CORS_ORIGIN;
  });

  describe('GET /api/auth/github/login', () => {
    it('redirects the browser to GitHub with signed state', async () => {
      const response = await request(app).get('/api/auth/github/login');

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.origin).toBe('https://github.com');
      expect(location.searchParams.get('state')).toBeTruthy();
    });

    it('remembers where the user came from', async () => {
      const response = await request(app)
        .get('/api/auth/github/login')
        .query({ return_to: 'http://localhost:3000/budgets' });

      const state = new URL(response.headers.location).searchParams.get('state');
      const payload = JSON.parse(
        Buffer.from(state.slice(0, state.indexOf('.')), 'base64url').toString('utf8')
      );

      expect(payload.r).toBe('http://localhost:3000/budgets');
    });

    it('ignores a return destination that is not allowed', async () => {
      const response = await request(app)
        .get('/api/auth/github/login')
        .query({ return_to: 'https://evil.example.com/steal' });

      const state = new URL(response.headers.location).searchParams.get('state');
      const payload = JSON.parse(
        Buffer.from(state.slice(0, state.indexOf('.')), 'base64url').toString('utf8')
      );

      expect(payload.r).not.toContain('evil.example.com');
    });
  });

  describe('GET /api/auth/github/callback', () => {
    const validState = (returnTo = config.github.defaultReturnTo) =>
      signOAuthState({ returnTo }, config.jwtSecret);

    it('creates the account on first sign-in and starts a session', async () => {
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({ code: 'good-code', state: validState() });

      expect(response.status).toBe(302);

      const user = await User.findOne({ githubId: defaultProfile.id });
      expect(user).toBeTruthy();
      expect(user.githubLogin).toBe('octocat');
      expect(user.email).toBe('octocat@example.com');
      expect(user.name).toBe('The Octocat');

      const cookie = sessionCookieFrom(response);
      expect(cookie).toBeTruthy();
      expect(cookie).toContain('HttpOnly');
    });

    it('reuses the existing account on a later sign-in', async () => {
      await request(app)
        .get('/api/auth/github/callback')
        .query({ code: 'first', state: validState() });

      stub.profile.login = 'octocat-renamed';
      stub.profile.name = 'Renamed Octocat';

      await request(app)
        .get('/api/auth/github/callback')
        .query({ code: 'second', state: validState() });

      const users = await User.find({ githubId: defaultProfile.id });
      expect(users).toHaveLength(1);
      // Identity follows the immutable GitHub id, so a renamed account is the
      // same user with an updated login rather than a second one.
      expect(users[0].githubLogin).toBe('octocat-renamed');
    });

    it('rejects a callback with no state', async () => {
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({ code: 'good-code' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_state');
    });

    it('rejects state this server did not sign', async () => {
      const forged = signOAuthState({ returnTo: 'http://localhost:3000' }, 'not-our-secret');
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({ code: 'good-code', state: forged });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_state');
      expect(await User.countDocuments()).toBe(0);
    });

    it('rejects a callback with no code', async () => {
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({ state: validState() });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('missing_code');
    });

    it('sends the user back to the app when they decline', async () => {
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({ error: 'access_denied', state: validState() });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('auth_error=access_denied');
      expect(sessionCookieFrom(response)).toBeUndefined();
    });

    it('reports a failed exchange without creating an account', async () => {
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({ code: 'bad-code', state: validState() });

      expect(response.status).toBe(502);
      expect(await User.countDocuments()).toBe(0);
    });

    it('never redirects somewhere the state was not allowed to name', async () => {
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({ code: 'good-code', state: validState('https://evil.example.com/') });

      expect(response.headers.location).not.toContain('evil.example.com');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the session cookie', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      const cookie = sessionCookieFrom(response);
      expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    });
  });

  describe('session cookie attributes', () => {
    // A browser silently discards a SameSite=None cookie that is not also
    // Secure. Getting this wrong drops the session on every plain-http
    // deployment, and the symptom is an app that simply never logs in.
    it('never pairs SameSite=None with an insecure cookie', () => {
      if (config.session.crossSite) {
        expect(config.session.secure).toBe(true);
      }
    });

    it('issues a cookie the browser will keep', async () => {
      const state = signOAuthState({ returnTo: 'http://localhost:3000/' }, config.jwtSecret);
      const response = await request(app)
        .get('/api/auth/github/callback')
        .query({ code: 'good-code', state });

      const cookie = sessionCookieFrom(response);
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      if (cookie.includes('SameSite=None')) {
        expect(cookie).toContain('Secure');
      }
    });
  });

  describe('GET /api/auth/profile', () => {
    let user;
    let token;

    beforeEach(async () => {
      const testData = await createTestUser(User);
      user = testData.user;
      token = testData.token;
    });

    it('returns the profile for a bearer token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('email', user.email);
      expect(response.body.user).toHaveProperty('githubLogin', user.githubLogin);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('returns the profile for a session cookie', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', `${SESSION_COOKIE}=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('email', user.email);
    });

    it('never exposes the wrapped encryption key', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.user).not.toHaveProperty('credentialKey');
    });

    it('refuses a request with no session', async () => {
      const response = await request(app).get('/api/auth/profile');

      expect(response.status).toBe(401);
    });

    it('refuses an invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer not-a-real-token');

      expect(response.status).toBe(401);
    });

    it('refuses an invalid session cookie', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', `${SESSION_COOKIE}=not-a-real-token`);

      expect(response.status).toBe(401);
    });
  });
});
