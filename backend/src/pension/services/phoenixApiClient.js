const logger = require('../../shared/utils/logger');

const PHOENIX_API_BASE = 'https://my.fnx.co.il/api/v1';
const AUTH0_DOMAIN = 'fnx-prod.eu.auth0.com';
const AUTH0_CLIENT_ID = 'LGH5VD3Cad42mdU7TZLLSnqNhOaGiLwb';

/**
 * HTTP client for the Phoenix Insurance (הפניקס) REST API.
 * Authentication is via Auth0 passwordless OTP — requires user interaction.
 *
 * Usage flow:
 *   1. initiateOtp(idNumber, channel) — sends OTP via SMS or email
 *   2. verifyOtp(otp) — exchanges OTP for JWT
 *   3. getAllProducts() / getAccountDetail(savingNum) — fetch data
 */
class PhoenixApiClient {
  constructor() {
    this.accessToken = null;
    this.idNumber = null;
  }

  /**
   * Step 1: Initiate passwordless OTP login.
   * Phoenix uses Auth0 passwordless — this sends the OTP code to the user.
   * @param {string} idNumber - Israeli ID number (תעודת זהות)
   * @param {string} connection - 'sms' or 'email'
   * @param {string} destination - Phone number or email address
   */
  async initiateOtp(idNumber, connection, destination) {
    this.idNumber = idNumber;

    const body = {
      client_id: AUTH0_CLIENT_ID,
      connection,
      send: 'code'
    };

    if (connection === 'sms') {
      body.phone_number = destination;
    } else {
      body.email = destination;
    }

    const res = await fetch(`https://${AUTH0_DOMAIN}/passwordless/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OTP initiation failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    logger.info('Phoenix OTP initiated successfully');
    return data;
  }

  /**
   * Step 2: Verify OTP and get JWT access token.
   * @param {string} otp - The OTP code the user received
   * @param {string} connection - 'sms' or 'email' (must match step 1)
   * @param {string} destination - Phone number or email (must match step 1)
   */
  async verifyOtp(otp, connection, destination) {
    const body = {
      client_id: AUTH0_CLIENT_ID,
      grant_type: 'http://auth0.com/oauth/grant-type/passwordless/otp',
      realm: connection,
      otp,
      scope: 'openid profile email'
    };

    if (connection === 'sms') {
      body.username = destination;
    } else {
      body.username = destination;
    }

    const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OTP verification failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token || data.id_token;
    logger.info('Phoenix authentication successful');
    return data;
  }

  /**
   * Set a pre-existing JWT token (e.g., from stored session).
   */
  setToken(token) {
    this.accessToken = token;
  }

  /**
   * Make an authenticated request to the Phoenix API.
   */
  async request(method, path, body = null) {
    if (!this.accessToken) {
      throw new Error('Not authenticated — call verifyOtp() first');
    }

    const url = `${PHOENIX_API_BASE}${path}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Phoenix API error ${res.status} (${path}): ${errText}`);
    }

    return res.json();
  }

  /**
   * Get all user products (all accounts across all categories).
   * Returns { response: { gemel: [...], hishtalmut: [...], pension: [...], ... } }
   */
  async getAllProducts() {
    const data = await this.request('GET', '/info/policy/allUserProducts');
    return data.response || data;
  }

  /**
   * Get detailed info for a specific savings product.
   * Includes: accountTransactions, deposits, investmentRoutes, managementFee, expectedPayments
   * @param {string} savingNum - The policy/saving number (e.g. "001-274-294188 (6333041)")
   */
  async getAccountDetail(savingNum) {
    const data = await this.request('POST', '/info/policy/findExcellenceSavingById', {
      savingNum
    });
    return data.response || data;
  }
}

module.exports = PhoenixApiClient;
