const { decrypt } = require('../../shared/utils/encryption');
const { parseStringPromise } = require('xml2js');
const logger = require('../../shared/utils/logger');

const FLEX_REQUEST_URL = 'https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest';
const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 2000;

/**
 * Client for the IBKR Flex Web Service.
 * Requests and retrieves Flex Query reports via token-based authentication.
 */
class IBKRFlexClient {
  constructor(encryptedFlexToken, queryId) {
    this.flexToken = decrypt(encryptedFlexToken);
    this.queryId = queryId;
  }

  /**
   * Request a Flex report and poll until it's ready.
   * Returns parsed report sections.
   */
  async fetchReport() {
    const referenceInfo = await this.requestReport();
    const xml = await this.pollForReport(referenceInfo.referenceCode, referenceInfo.baseUrl);
    return this.parseReport(xml);
  }

  /**
   * Step 1: Send report generation request
   */
  async requestReport() {
    const url = `${FLEX_REQUEST_URL}?t=${this.flexToken}&q=${this.queryId}&v=3`;
    const response = await fetch(url);
    const text = await response.text();
    const parsed = await parseStringPromise(text, { explicitArray: false });

    const root = parsed.FlexStatementResponse || parsed;
    if (root.Status !== 'Success') {
      const code = root.ErrorCode || 'Unknown';
      const msg = root.ErrorMessage || 'Failed to request Flex report';
      throw new Error(`IBKR Flex request failed (${code}): ${msg}`);
    }

    return {
      referenceCode: root.ReferenceCode,
      baseUrl: root.Url
    };
  }

  /**
   * Step 2: Poll for report completion
   */
  async pollForReport(referenceCode, baseUrl) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await this.sleep(POLL_INTERVAL_MS);

      const url = `${baseUrl}?q=${referenceCode}&t=${this.flexToken}&v=3`;
      const response = await fetch(url);
      const text = await response.text();

      // Check if the response is an error/progress message (short XML with <code> element)
      if (text.includes('<code>') && text.includes('Statement generation in progress')) {
        logger.info(`IBKR Flex report still generating (attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS})...`);
        continue;
      }

      // Check for error responses
      if (text.includes('<code>') && !text.includes('<FlexQueryResponse')) {
        const parsed = await parseStringPromise(text, { explicitArray: false });
        const errorMsg = parsed?.FlexStatementResponse?.code || parsed?.code || text;
        throw new Error(`IBKR Flex report error: ${errorMsg}`);
      }

      return text;
    }

    throw new Error('IBKR Flex report generation timed out');
  }

  /**
   * Step 3: Parse the XML report into structured sections
   */
  async parseReport(xml) {
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true
    });

    const response = parsed.FlexQueryResponse || parsed;
    const statement = response.FlexStatements?.FlexStatement || {};

    return {
      accountInfo: this.extractSection(statement.AccountInformation),
      openPositions: this.extractArray(statement.OpenPositions?.OpenPosition),
      trades: this.extractArray(statement.Trades?.Trade),
      cashTransactions: this.extractArray(statement.CashTransactions?.CashTransaction),
      equitySummary: this.extractSection(statement.EquitySummaryInDefault?.EquitySummaryByReportDateInBase)
    };
  }

  /**
   * Ensure a section is always an array
   */
  extractArray(section) {
    if (!section) return [];
    return Array.isArray(section) ? section : [section];
  }

  /**
   * Extract a single section (first element if array)
   */
  extractSection(section) {
    if (!section) return null;
    return Array.isArray(section) ? section[0] : section;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = IBKRFlexClient;
