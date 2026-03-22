const logger = require('../../shared/utils/logger');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const CLAL_LOGIN_URL = 'https://www.clalbit.co.il/';
const PORTFOLIO_DATA_URL = 'GetPortfolioHomeData';

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

      // Click "לחשבון שלך" button to open login form
      const loginClicked = await page.evaluate(() => {
        for (const el of document.querySelectorAll('a, button, span, div')) {
          if (el.textContent?.trim().includes('לחשבון שלך')) {
            el.click();
            return true;
          }
        }
        return false;
      });
      if (!loginClicked) throw new Error('Could not find "לחשבון שלך" button');
      logger.info('Clal login: clicked login button');

      // Wait for login form to appear
      await page.waitForFunction(() => {
        const inputs = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"]');
        return inputs.length >= 2;
      }, { timeout: 15000 });

      // Fill ID number — look for ID field (ת.ז.)
      const idFilled = await page.evaluate((id) => {
        for (const input of document.querySelectorAll('input')) {
          const placeholder = (input.placeholder || '').toLowerCase();
          const label = input.closest('label')?.textContent || '';
          const ariaLabel = input.getAttribute('aria-label') || '';
          if (placeholder.includes('ת.ז') || placeholder.includes('תעודת זהות') ||
              label.includes('ת.ז') || ariaLabel.includes('ת.ז') ||
              placeholder.includes('מספר זהות') || input.id?.includes('id')) {
            input.value = '';
            input.focus();
            return true;
          }
        }
        // Fallback: first visible text/tel input
        const inputs = document.querySelectorAll('input:not([type="hidden"])');
        if (inputs.length > 0) { inputs[0].focus(); return true; }
        return false;
      }, idNumber);

      if (!idFilled) throw new Error('Could not find ID input field');
      await page.keyboard.type(idNumber, { delay: 30 });

      // Fill phone number
      const phoneFilled = await page.evaluate((phone) => {
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
        // Look for phone field
        for (const input of inputs) {
          const placeholder = (input.placeholder || '');
          const ariaLabel = input.getAttribute('aria-label') || '';
          if (placeholder.includes('טלפון') || placeholder.includes('נייד') ||
              ariaLabel.includes('טלפון') || input.type === 'tel') {
            input.focus();
            return true;
          }
        }
        // Fallback: second visible input
        if (inputs.length > 1) { inputs[1].focus(); return true; }
        return false;
      }, phoneOrEmail);

      if (!phoneFilled) throw new Error('Could not find phone input field');
      await page.keyboard.type(phoneOrEmail, { delay: 30 });

      logger.info('Clal login: filled ID + phone, triggering OTP');

      // Click send OTP button
      const otpTriggered = await page.evaluate(() => {
        for (const btn of document.querySelectorAll('button, input[type="submit"], a')) {
          const text = (btn.textContent || btn.value || '').trim();
          if (text.includes('שלחו') || text.includes('שליחת קוד') || text.includes('כניסה') ||
              text.includes('המשך') || text.includes('שלח')) {
            btn.click();
            return text;
          }
        }
        return null;
      });

      if (!otpTriggered) {
        logger.info('Clal login: no send button found, pressing Enter');
        await page.keyboard.press('Enter');
      } else {
        logger.info(`Clal login: clicked OTP button: "${otpTriggered}"`);
      }

      // Wait for OTP input screen
      await page.waitForFunction(() => {
        for (const input of document.querySelectorAll('input')) {
          if (input.placeholder?.includes('קוד') || input.type === 'tel' ||
              input.type === 'number' || input.inputMode === 'numeric' ||
              input.autocomplete === 'one-time-code') return true;
        }
        return document.body.innerText?.includes('הזינו את הקוד') ||
               document.body.innerText?.includes('קוד אימות') ||
               document.body.innerText?.includes('קוד חד פעמי');
      }, { timeout: 30000 });

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
      // Set up response interceptor BEFORE submitting OTP
      const portfolioPromise = page.waitForResponse(
        res => res.url().includes(PORTFOLIO_DATA_URL) && res.ok(),
        { timeout: 120000 }
      );

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

      // Submit OTP
      const clicked = await page.evaluate(() => {
        for (const btn of document.querySelectorAll('button, input[type="submit"]')) {
          const text = (btn.textContent || btn.value || '').trim();
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
        logger.info(`Clal: clicked OTP button: "${clicked}"`);
      } else {
        logger.info('Clal: no matching button found, pressing Enter');
        await page.keyboard.press('Enter');
      }

      logger.info('Clal: OTP submitted, waiting for portfolio data...');

      // Wait for portfolio data XHR
      let portfolioData;
      try {
        const portfolioResponse = await portfolioPromise;
        portfolioData = await portfolioResponse.json();
        logger.info(`Clal: captured GetPortfolioHomeData (status ${portfolioResponse.status()})`);
      } catch (err) {
        // If we didn't intercept it, try navigating to portfolio page
        logger.info('Clal: XHR not intercepted during login, navigating to portfolio page');
        await page.goto('https://www.clalbit.co.il/portfolio/', {
          waitUntil: 'networkidle2',
          timeout: 45000
        });

        const retryPromise = page.waitForResponse(
          res => res.url().includes(PORTFOLIO_DATA_URL) && res.ok(),
          { timeout: 30000 }
        );
        const retryResponse = await retryPromise;
        portfolioData = await retryResponse.json();
        logger.info('Clal: captured portfolio data on retry');
      }

      if (!portfolioData?.IsSuccess) {
        throw new Error(portfolioData?.ErrorMessage || 'Clal API returned unsuccessful response');
      }

      return { portfolioData, ownerName: null };
    } finally {
      pendingSessions.delete(sessionId);
      await browser.close().catch(() => {});
      logger.info('Clal: browser closed');
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
