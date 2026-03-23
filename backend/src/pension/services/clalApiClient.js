const logger = require('../../shared/utils/logger');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const CLAL_LOGIN_URL = 'https://www.clalbit.co.il/';
const PORTFOLIO_DATA_URL = 'GetPortfolioHomeData';
const PENSION_DETAIL_URL = 'PensionSurface/GetPensionPolicy';
const LIFE_DETAIL_URL = 'LifeInsuranceSurface/GetLifePolicy';

// Maps portfolio category keys to detail page URL paths and XHR endpoints
const DETAIL_CONFIG = {
  PortfolioDataPensionFundation: {
    urlPath: '/portfolio/pensionportfolio/',
    urlParams: (item) => `?txtPolicyId=${encodeURIComponent(item.PolicyIdEncrypted)}&numType=0&txtExpired=false`,
    xhrMatch: PENSION_DETAIL_URL
  },
  PortfolioDataLifeInsList: {
    urlPath: '/portfolio/lifeinsurance/',
    urlParams: (item) => `?txtPolicyId=${encodeURIComponent(item.PolicyIdEncrypted)}&txtFinancialSaving=${item.FinancialSaving || '0'}&txtExpired=false`,
    xhrMatch: LIFE_DETAIL_URL
  }
};

// In-memory store for browser sessions awaiting OTP
const pendingSessions = new Map();

/**
 * Clal Insurance (כלל ביטוח) scraper client.
 * Uses Puppeteer + stealth to log in via OTP, then intercepts XHR responses.
 *
 * Flow:
 *   1. startLogin(id, phone, sessionId) — opens browser, fills form, triggers SMS
 *   2. completeLoginAndSync(sessionId, otp) — enters OTP, intercepts GetPortfolioHomeData
 */
class ClalApiClient {
  constructor() {
    this.sessionId = null;
  }

  async startLogin(idNumber, phoneOrEmail, sessionId) {
    this.sessionId = sessionId;
    await this.cleanupSession(sessionId);

    logger.info(`Clal login: launching browser for session ${sessionId}`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1024, height: 768 });

      logger.info('Clal login: navigating to login page');
      await page.goto(CLAL_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 45000 });
      logger.info(`Clal login: on page ${page.url()}`);

      // Wait for campaign popup to appear (it loads after a short delay)
      try {
        await page.waitForSelector('#ZA_CAMP_CLOSE_BUTTON', { timeout: 3000 });
        await page.click('#ZA_CAMP_CLOSE_BUTTON');
        logger.info('Clal login: dismissed popup');
        await new Promise(r => setTimeout(r, 500));
      } catch (_) {
        // No popup appeared — continue
      }

      // Click "לחשבון שלך" button to open login form — use evaluate to bypass any overlay
      await page.waitForSelector('#macro-login-btn', { visible: true, timeout: 15000 });
      await new Promise(r => setTimeout(r, 1000));
      await page.evaluate(() => document.querySelector('#macro-login-btn').click());
      logger.info('Clal login: clicked login button');

      // Wait for login form to appear
      await page.waitForSelector('input[formcontrolname="tz"]', { timeout: 15000 });

      // Fill ID number (ת.ז.)
      await page.click('input[formcontrolname="tz"]');
      await page.type('input[formcontrolname="tz"]', idNumber, { delay: 30 });

      // Fill phone number (טלפון נייד)
      await page.click('input[formcontrolname="mobile"]');
      await page.type('input[formcontrolname="mobile"]', phoneOrEmail, { delay: 30 });

      logger.info('Clal login: filled ID + phone, triggering OTP');

      // Click submit button (שליחה)
      await page.waitForSelector('app-identification button[type="submit"]', { timeout: 5000 });
      await page.click('app-identification button[type="submit"]');
      logger.info('Clal login: clicked submit button');

      // Wait for OTP input screen (app-otp-login component replaces app-identification)
      await page.waitForSelector('input[formcontrolname="otp"]', { timeout: 30000 });

      logger.info('Clal login: OTP screen appeared — SMS sent');

      pendingSessions.set(sessionId, { browser, page, createdAt: Date.now() });
      return { success: true, message: 'OTP sent via SMS' };
    } catch (error) {
      logger.error(`Clal login failed: ${error.message}`);
      await browser.close().catch(() => {});
      throw error;
    }
  }

  /**
   * Step 2: Enter OTP, then intercept GetPortfolioHomeData XHR response.
   */
  async completeLoginAndSync(sessionId, otp) {
    const session = pendingSessions.get(sessionId);
    if (!session) throw new Error('No pending login session. Initiate login first.');

    const { browser, page } = session;

    try {
      // Collect ALL GetPortfolioHomeData responses — the site fires multiple, only later ones have full data
      const portfolioResponses = [];
      page.on('response', async (res) => {
        if (res.url().includes(PORTFOLIO_DATA_URL) && res.ok()) {
          try {
            const data = await res.json();
            portfolioResponses.push(data);
            const itemCount = ['PortfolioDataPensionFundation', 'PortfolioDataLifeInsList', 'PortfolioDataGemelList']
              .reduce((sum, k) => sum + (Array.isArray(data[k]) ? data[k].length : 0), 0);
            logger.info(`Clal: captured GetPortfolioHomeData response #${portfolioResponses.length} (${itemCount} pension/life/gemel items)`);
          } catch (_) {}
        }
      });

      // Enter OTP — type into field then submit via form
      const otpInput = await page.waitForSelector('input[formcontrolname="otp"]', { timeout: 5000 });
      await otpInput.click({ clickCount: 3 });
      await otpInput.type(otp, { delay: 50 });

      // Trigger Angular change detection and submit form programmatically
      await page.evaluate(() => {
        const input = document.querySelector('input[formcontrolname="otp"]');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        // Submit the form directly
        const form = document.querySelector('app-otp-login form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      logger.info('Clal: OTP submitted, waiting for portfolio data...');

      // Wait for first portfolio response
      await page.waitForResponse(
        res => res.url().includes(PORTFOLIO_DATA_URL) && res.ok(),
        { timeout: 120000 }
      );

      // Navigate to portfolio page to trigger the full data load
      logger.info('Clal: navigating to portfolio page for full data');
      await page.goto('https://www.clalbit.co.il/portfolio/', {
        waitUntil: 'networkidle2',
        timeout: 45000
      });

      // Wait a bit for any remaining XHRs to complete
      await new Promise(r => setTimeout(r, 3000));

      // Pick the response with the most pension/life/gemel items
      let portfolioData = null;
      let bestItemCount = -1;
      for (const data of portfolioResponses) {
        const itemCount = ['PortfolioDataPensionFundation', 'PortfolioDataLifeInsList', 'PortfolioDataGemelList']
          .reduce((sum, k) => sum + (Array.isArray(data[k]) ? data[k].length : 0), 0);
        if (itemCount > bestItemCount) {
          bestItemCount = itemCount;
          portfolioData = data;
        }
      }

      if (!portfolioData) {
        // Fallback: use whatever we got
        portfolioData = portfolioResponses[portfolioResponses.length - 1];
      }

      logger.info(`Clal: using best portfolio response (${bestItemCount} items from ${portfolioResponses.length} total responses)`);

      if (!portfolioData?.IsSuccess) {
        throw new Error(portfolioData?.ErrorMessage || 'Clal API returned unsuccessful response');
      }

      // Keep browser open for detail fetching — caller must call closeBrowser()
      return { portfolioData, ownerName: null, browser, page };
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    } finally {
      pendingSessions.delete(sessionId);
    }
  }

  /**
   * Step 3: Fetch detail data for each account from the portfolio.
   * Navigates to each account's detail page and intercepts the detail XHR.
   */
  async fetchAccountDetails(page, portfolioData) {
    const details = {};

    const categoriesToFetch = Object.keys(DETAIL_CONFIG).filter(
      cat => Array.isArray(portfolioData[cat]) && portfolioData[cat].length > 0
    );
    logger.info(`Clal: fetching details for ${categoriesToFetch.length} categories`);

    for (const [category, config] of Object.entries(DETAIL_CONFIG)) {
      const items = portfolioData[category];
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        const policyId = String(item.PolicyId || item.ItemId);
        if (!item.PolicyIdEncrypted) {
          logger.warn(`Clal: skipping detail for ${policyId} — no PolicyIdEncrypted`);
          continue;
        }

        try {
          const detailUrl = `https://www.clalbit.co.il${config.urlPath}${config.urlParams(item)}`;
          logger.info(`Clal: fetching detail for ${policyId} (${category})`);

          // Small delay between detail page navigations to let previous page settle
          await new Promise(r => setTimeout(r, 1000));

          // Set up XHR interceptor before navigation
          const detailPromise = page.waitForResponse(
            res => res.url().includes(config.xhrMatch) && res.ok(),
            { timeout: 30000 }
          );

          await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });

          const detailResponse = await detailPromise;
          // Use text() + JSON.parse — more reliable than json() when response body may be partially consumed
          const detailText = await detailResponse.text();
          const detailData = JSON.parse(detailText);

          if (detailData?.IsSuccess !== false) {
            details[policyId] = { data: detailData, category };
            logger.info(`Clal: captured detail for ${policyId}`);
          } else {
            logger.warn(`Clal: detail API returned error for ${policyId}: ${detailData?.ErrorMessage}`);
          }
        } catch (err) {
          logger.warn(`Clal: failed to fetch detail for ${policyId}: ${err.message}`);
        }
      }
    }

    return details;
  }

  /**
   * Close the browser session after all detail fetching is complete.
   */
  async closeBrowser(browser) {
    try {
      await browser.close();
      logger.info('Clal: browser closed');
    } catch (err) {
      logger.warn(`Clal: error closing browser: ${err.message}`);
    }
  }

  async cleanupSession(sessionId) {
    const session = pendingSessions.get(sessionId);
    if (session) {
      await session.browser.close().catch(() => {});
      pendingSessions.delete(sessionId);
    }
  }
}

// Periodic cleanup of stale sessions (5 min threshold)
const cleanupInterval = setInterval(() => {
  const threshold = Date.now() - 5 * 60 * 1000;
  for (const [id, session] of pendingSessions) {
    if (session.createdAt < threshold) {
      logger.info(`Clal: cleaning up stale session ${id}`);
      session.browser.close().catch(() => {});
      pendingSessions.delete(id);
    }
  }
}, 60000);
cleanupInterval.unref();

module.exports = ClalApiClient;
