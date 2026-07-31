const { GitHubOAuthClient, GitHubOAuthError } = require('../githubOAuth');

const OPTIONS = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://api.example.com/api/auth/github/callback'
};

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body
});

describe('GitHubOAuthClient', () => {
  describe('construction', () => {
    it('requires credentials', () => {
      expect(() => new GitHubOAuthClient({ ...OPTIONS, clientId: '' })).toThrow();
      expect(() => new GitHubOAuthClient({ ...OPTIONS, clientSecret: '' })).toThrow();
      expect(() => new GitHubOAuthClient({ ...OPTIONS, redirectUri: '' })).toThrow();
    });
  });

  describe('authorizeUrl', () => {
    it('sends the state and redirect back to GitHub', () => {
      const client = new GitHubOAuthClient(OPTIONS);
      const url = new URL(client.authorizeUrl('state-value'));

      expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe('client-id');
      expect(url.searchParams.get('state')).toBe('state-value');
      expect(url.searchParams.get('redirect_uri')).toBe(OPTIONS.redirectUri);
    });

    it('asks only for identity scopes', () => {
      const client = new GitHubOAuthClient(OPTIONS);
      const scope = new URL(client.authorizeUrl('s')).searchParams.get('scope');

      expect(scope).toBe('read:user user:email');
      expect(scope).not.toMatch(/repo|admin|write/);
    });
  });

  describe('exchangeCode', () => {
    it('returns the access token', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ access_token: 'gho_token' }));
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      await expect(client.exchangeCode('code-value')).resolves.toBe('gho_token');

      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe('https://github.com/login/oauth/access_token');
      expect(JSON.parse(init.body).code).toBe('code-value');
    });

    it('treats an error body as a failure even though the status is 200', async () => {
      // GitHub reports a reused or expired code this way, so trusting the
      // status alone would let a failed exchange through.
      const fetchImpl = jest.fn().mockResolvedValue(
        jsonResponse({ error: 'bad_verification_code', error_description: 'expired' })
      );
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      await expect(client.exchangeCode('code')).rejects.toThrow(GitHubOAuthError);
    });

    it('fails when the response carries no token', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}));
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      await expect(client.exchangeCode('code')).rejects.toThrow(GitHubOAuthError);
    });

    it('fails on a non-2xx response', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, false, 500));
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      await expect(client.exchangeCode('code')).rejects.toThrow(/500/);
    });
  });

  describe('getUser', () => {
    it('maps the GitHub profile', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(
        jsonResponse({
          id: 4242,
          login: 'octocat',
          email: 'octocat@example.com',
          name: 'The Octocat',
          avatar_url: 'https://avatars.example.com/octocat'
        })
      );
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      await expect(client.getUser('token')).resolves.toEqual({
        id: 4242,
        login: 'octocat',
        email: 'octocat@example.com',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.example.com/octocat'
      });
    });

    it('looks up a verified email when the profile withholds one', async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: 1, login: 'private', email: null, name: null }))
        .mockResolvedValueOnce(
          jsonResponse([
            { email: 'unverified@example.com', primary: false, verified: false },
            { email: 'primary@example.com', primary: true, verified: true }
          ])
        );
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      const user = await client.getUser('token');

      expect(user.email).toBe('primary@example.com');
      expect(fetchImpl.mock.calls[1][0]).toBe('https://api.github.com/user/emails');
    });

    it('never returns an unverified email', async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: 1, login: 'private', email: null }))
        .mockResolvedValueOnce(
          jsonResponse([{ email: 'unverified@example.com', primary: true, verified: false }])
        );
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      await expect(client.getUser('token')).resolves.toMatchObject({ email: null });
    });

    it('still signs the user in when no email can be found', async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse({ id: 7, login: 'noemail', email: null }))
        .mockRejectedValueOnce(new Error('network down'));
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      await expect(client.getUser('token')).resolves.toMatchObject({ id: 7, email: null });
    });

    it('rejects a payload missing the fields identity depends on', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ login: 'octocat' }));
      const client = new GitHubOAuthClient({ ...OPTIONS, fetchImpl });

      await expect(client.getUser('token')).rejects.toThrow(/id or login/);
    });
  });
});
