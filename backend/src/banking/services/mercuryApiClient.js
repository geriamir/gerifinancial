const logger = require('../../shared/utils/logger');
const { decrypt } = require('../../shared/utils/encryption');

const MERCURY_BASE_URL = 'https://api.mercury.com/api/v1';

/**
 * HTTP client for the Mercury Bank API.
 * Handles authentication, pagination, and response mapping.
 */
class MercuryApiClient {
  constructor(encryptedApiToken) {
    this.apiToken = decrypt(encryptedApiToken);
  }

  /**
   * Make an authenticated request to the Mercury API
   */
  async request(path, params = {}) {
    const url = new URL(`${MERCURY_BASE_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mercury API error ${response.status}: ${body}`);
    }

    return response.json();
  }

  /**
   * List all Mercury accounts
   * GET /api/v1/accounts
   */
  async getAccounts() {
    const data = await this.request('/accounts');
    return data.accounts || [];
  }

  /**
   * Get a single Mercury account
   * GET /api/v1/account/{accountId}
   */
  async getAccount(accountId) {
    return this.request(`/account/${accountId}`);
  }

  /**
   * Get transactions for an account with pagination
   * GET /api/v1/account/{accountId}/transactions
   */
  async getTransactions(accountId, options = {}) {
    const { startDate, endDate, limit = 500, offset = 0, status } = options;

    const params = { limit, offset };
    if (startDate) params.start = this.formatDate(startDate);
    if (endDate) params.end = this.formatDate(endDate);
    if (status) params.status = status;

    const data = await this.request(`/account/${accountId}/transactions`, params);
    const transactions = data.transactions || [];
    const total = data.total || transactions.length;

    // Auto-paginate if there are more results
    if (transactions.length > 0 && offset + transactions.length < total) {
      const remaining = await this.getTransactions(accountId, {
        ...options,
        offset: offset + transactions.length
      });
      return [...transactions, ...remaining];
    }

    return transactions;
  }

  formatDate(date) {
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
  }
}

module.exports = MercuryApiClient;
