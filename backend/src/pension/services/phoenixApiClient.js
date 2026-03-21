const logger = require('../../shared/utils/logger');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const PHOENIX_LOGIN_URL = 'https://my.fnx.co.il';
const ALL_PRODUCTS_URL = 'allUserProducts';
const DETAIL_URL = 'findExcellenceSavingById';

// In-memory store for browser sessions awaiting OTP
const pendingSessions = new Map();

/**
 * Phoenix Insurance (הפניקס) scraper client.
 * Uses Puppeteer + stealth to log in via OTP, then intercepts XHR responses
 * from the Angular app — following the israeli-bank-scrapers pattern
 * (see Leumi's page.waitForResponse).
 *
 * Flow:
 *   1. startLogin(id, phone, sessionId) — opens browser, fills form, triggers SMS
 *   2. completeLoginAndSync(sessionId, otp) — enters OTP, intercepts allUserProducts
 *      response, then navigates to detail pages to capture account details
 */
class PhoenixApiClient {
  constructor() {
    this.sessionId = null;
  }

  /**
   * Step 1: Launch browser, fill login form, trigger OTP SMS.
   */
  async startLogin(idNumber, phoneOrEmail, sessionId) {
    this.sessionId = sessionId;
    await this.cleanupSession(sessionId);

    logger.info(`Phoenix login: launching browser for session ${sessionId}`);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1024, height: 768 });

      logger.info('Phoenix login: navigating to login page');
      await page.goto(PHOENIX_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 45000 });
      logger.info(`Phoenix login: on page ${page.url()}`);

      await page.waitForSelector('#fnx-id', { timeout: 30000 });

      // Fill ID number
      await page.click('#fnx-id', { clickCount: 3 });
      await page.type('#fnx-id', idNumber, { delay: 30 });

      // Fill phone/email (second text input)
      const phoneInput = await page.evaluateHandle(() => {
        const inputs = document.querySelectorAll('input[type="text"]');
        for (const input of inputs) {
          if (input.id !== 'fnx-id' && input.placeholder?.includes('טלפון')) return input;
        }
        return inputs.length > 1 ? inputs[1] : null;
      });

      if (!phoneInput || !(await phoneInput.asElement())) {
        throw new Error('Could not find phone/email input on login page');
      }
      await phoneInput.asElement().click({ clickCount: 3 });
      await phoneInput.asElement().type(phoneOrEmail, { delay: 30 });

      logger.info('Phoenix login: filled ID + phone, clicking send OTP');

      // Click "שלחו לי קוד כניסה"
      const clicked = await page.evaluate(() => {
        for (const btn of document.querySelectorAll('button')) {
          if (btn.textContent?.includes('שלחו לי קוד כניסה')) { btn.click(); return true; }
        }
        return false;
      });
      if (!clicked) throw new Error('Could not find send OTP button');

      // Wait for OTP input screen
      await page.waitForFunction(() => {
        for (const input of document.querySelectorAll('input')) {
          if (input.placeholder?.includes('קוד') || input.type === 'tel' ||
              input.type === 'number' || input.inputMode === 'numeric' ||
              input.autocomplete === 'one-time-code') return true;
        }
        return document.body.innerText?.includes('הזינו את הקוד') ||
               document.body.innerText?.includes('קוד אימות');
      }, { timeout: 30000 });

      logger.info('Phoenix login: OTP screen appeared — SMS sent');

      pendingSessions.set(sessionId, { browser, page, createdAt: Date.now() });
      return { success: true, message: 'OTP sent via SMS' };
    } catch (error) {
      logger.error(`Phoenix login failed: ${error.message}`);
      await browser.close().catch(() => {});
      throw error;
    }
  }

  /**
   * Step 2: Enter OTP, then intercept XHR responses as the Angular app loads.
   * After login the app automatically fetches allUserProducts — we capture that.
   * Then we navigate to each account's detail page and capture findExcellenceSavingById.
   *
   * @returns {{ allProducts: object, details: Record<string, object> }}
   */
  async completeLoginAndSync(sessionId, otp) {
    const session = pendingSessions.get(sessionId);
    if (!session) throw new Error('No pending login session. Initiate login first.');

    const { browser, page } = session;

    try {
      // Set up response interceptors BEFORE submitting OTP
      const allProductsPromise = page.waitForResponse(
        res => res.url().includes(ALL_PRODUCTS_URL) && res.ok(),
        { timeout: 120000 }
      );

      // Also capture insuredDetails for the owner name
      const insuredDetailsPromise = page.waitForResponse(
        res => res.url().includes('insuredDetails') && res.ok(),
        { timeout: 120000 }
      ).catch(() => null);

      // Enter OTP
      const otpInput = await page.evaluateHandle(() => {
        for (const input of document.querySelectorAll('input')) {
          if (input.type === 'hidden') continue;
          if (input.placeholder?.includes('קוד') || input.type === 'tel' ||
              input.type === 'number' || input.inputMode === 'numeric' ||
              input.autocomplete === 'one-time-code') return input;
        }
        const texts = document.querySelectorAll('input[type="text"]');
        return texts.length > 0 ? texts[texts.length - 1] : null;
      });

      if (!otpInput || !(await otpInput.asElement())) {
        throw new Error('Could not find OTP input field');
      }

      await otpInput.asElement().click({ clickCount: 3 });
      await otpInput.asElement().type(otp, { delay: 50 });

      // Submit OTP — try clicking the right button
      const clicked = await page.evaluate(() => {
        for (const btn of document.querySelectorAll('button')) {
          const text = btn.textContent?.trim() || '';
          if (btn.disabled) continue;
          if (text.includes('אימות') || text.includes('אישור') ||
              text.includes('כניסה') || text.includes('שלח') ||
              text.includes('אמת') || text.includes('המשך')) {
            btn.click();
            return text;
          }
        }
        return null;
      });
      
      if (clicked) {
        logger.info(`Phoenix: clicked OTP button: "${clicked}"`);
      } else {
        logger.info('Phoenix: no matching button found, pressing Enter');
        await page.keyboard.press('Enter');
      }

      logger.info('Phoenix: OTP submitted, waiting for allUserProducts response...');

      // Intercept the allUserProducts response that the Angular app fires after login
      const allProductsResponse = await allProductsPromise;
      const allProductsData = await allProductsResponse.json();
      logger.info(`Phoenix: captured allUserProducts (status ${allProductsResponse.status()})`);

      // Response is { response: { data: [{ id: "gemel", data: [...] }, ...] } }
      const dataArray = allProductsData.response?.data || allProductsData.data || [];
      const allProducts = {};
      for (const item of dataArray) {
        allProducts[item.id] = item.data || [];
      }

      // Extract owner name from insuredDetails
      let ownerName = null;
      const insuredResponse = await insuredDetailsPromise;
      if (insuredResponse) {
        try {
          const insuredData = await insuredResponse.json();
          const details = insuredData.response || insuredData;
          ownerName = details.firstName || details.name || details.fullName || null;
          if (details.lastName && ownerName) ownerName = `${ownerName} ${details.lastName}`;
          logger.info(`Phoenix: owner name from insuredDetails: ${ownerName}`);
        } catch (err) {
          logger.warn(`Phoenix: could not parse insuredDetails: ${err.message}`);
        }
      }
      
      const categoryNames = Object.keys(allProducts);
      logger.info(`Phoenix: product categories: ${categoryNames.join(', ')}`);
      for (const cat of categoryNames) {
        logger.info(`Phoenix: ${cat}: ${allProducts[cat].length} items`);
      }

      // Wait for the app to finish rendering
      await page.waitForSelector('app-savings', { timeout: 15000 }).catch(() => {
        logger.info('Phoenix: app-savings not found, continuing with detail fetch');
      });

      // Fetch details by clicking each account in the UI and intercepting XHR
      const details = {};
      const savingsCategories = ['gemel', 'gemelInvestment', 'hishtalmut', 'lifeSaving', 'pension', 'pizuim'];

      for (const category of savingsCategories) {
        const products = allProducts[category];
        if (!Array.isArray(products)) continue;

        for (const product of products) {
          const policyNum = product.policyNumber || product.policyId;
          if (!policyNum) continue;

          const savingNum = product.savingNum || product.savingNumber || policyNum;
          logger.info(`Phoenix: fetching detail for ${policyNum} (savingNum: ${savingNum}, category: ${category})`);

          try {
            const detailPromise = page.waitForResponse(
              res => res.url().includes(DETAIL_URL) && res.ok(),
              { timeout: 30000 }
            );

            // Navigate to the policy detail page
            // encodeURIComponent doesn't encode () per RFC 3986, but Phoenix needs them encoded
            const encodedPolicy = encodeURIComponent(policyNum).replace(/\(/g, '%28').replace(/\)/g, '%29');
            const detailUrl = `${PHOENIX_LOGIN_URL}/policies/${category}/${encodedPolicy}/info`;
            logger.info(`Phoenix: navigating to ${detailUrl}`);
            await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

            const detailResponse = await detailPromise;
            const detailData = await detailResponse.json();
            details[policyNum] = detailData.response || detailData;
            logger.info(`Phoenix: captured detail for ${policyNum}`);
          } catch (err) {
            logger.warn(`Phoenix: failed to get detail for ${policyNum} (${savingNum}): ${err.message}`);
          }
        }
      }

      return { allProducts, details, ownerName };
    } finally {
      pendingSessions.delete(sessionId);
      await browser.close().catch(() => {});
      logger.info('Phoenix: browser closed');
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

// Cleanup stale sessions every 5 minutes
const cleanupInterval = setInterval(() => {
  const staleThreshold = 5 * 60 * 1000;
  for (const [id, session] of pendingSessions) {
    if (Date.now() - session.createdAt > staleThreshold) {
      logger.warn(`Phoenix: cleaning up stale session ${id}`);
      session.browser.close().catch(() => {});
      pendingSessions.delete(id);
    }
  }
}, 5 * 60 * 1000);
cleanupInterval.unref();

module.exports = PhoenixApiClient;
