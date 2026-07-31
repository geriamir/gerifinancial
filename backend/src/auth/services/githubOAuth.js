const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

// Only identity is needed. No repository or organisation access is requested.
const DEFAULT_SCOPE = 'read:user user:email';

const REQUEST_TIMEOUT_MS = 10000;

class GitHubOAuthError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'GitHubOAuthError';
    this.code = code;
    this.status = status;
  }
}

class GitHubOAuthClient {
  constructor({ clientId, clientSecret, redirectUri, scope = DEFAULT_SCOPE, fetchImpl = fetch }) {
    if (!clientId || !clientSecret) {
      throw new Error('GitHubOAuthClient requires clientId and clientSecret');
    }
    if (!redirectUri) {
      throw new Error('GitHubOAuthClient requires redirectUri');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.scope = scope;
    this.fetchImpl = fetchImpl;
  }

  authorizeUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      state
    });
    return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(code) {
    const response = await this.fetchImpl(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'gerifinancial'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new GitHubOAuthError('token_exchange_failed', `GitHub responded ${response.status}`, response.status);
    }

    // GitHub reports a rejected code as HTTP 200 with an error body, so the
    // status alone does not tell us the exchange succeeded.
    const body = await response.json();
    if (body.error || !body.access_token) {
      throw new GitHubOAuthError(
        body.error || 'no_access_token',
        body.error_description || 'GitHub did not return an access token'
      );
    }
    return body.access_token;
  }

  async getUser(accessToken) {
    const headers = {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'gerifinancial',
      'x-github-api-version': '2022-11-28'
    };

    const response = await this.fetchImpl(`${GITHUB_API_URL}/user`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      throw new GitHubOAuthError('user_fetch_failed', `GitHub /user responded ${response.status}`, response.status);
    }

    const profile = await response.json();
    if (typeof profile.id !== 'number' || typeof profile.login !== 'string') {
      throw new GitHubOAuthError('invalid_user_payload', 'GitHub /user response is missing id or login');
    }

    return {
      id: profile.id,
      login: profile.login,
      email: profile.email || (await this.getPrimaryEmail(headers)),
      name: profile.name || null,
      avatarUrl: profile.avatar_url || null
    };
  }

  /**
   * Fetches a verified email when the profile withholds one, which is the
   * default for accounts that keep their address private. Best effort: an
   * account with no usable email still signs in, it just has none on file.
   */
  async getPrimaryEmail(headers) {
    try {
      const response = await this.fetchImpl(`${GITHUB_API_URL}/user/emails`, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!response.ok) return null;

      const emails = await response.json();
      if (!Array.isArray(emails)) return null;

      const verified = emails.filter((entry) => entry && entry.verified && entry.email);
      const primary = verified.find((entry) => entry.primary) || verified[0];
      return primary ? primary.email : null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = { GitHubOAuthClient, GitHubOAuthError, DEFAULT_SCOPE };
