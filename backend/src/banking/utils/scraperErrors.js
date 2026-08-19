const SCRAPER_ERROR_MESSAGES = {
  TWO_FACTOR_RETRIEVER_MISSING: 'Two-factor authentication is required for this account',
  INVALID_PASSWORD: 'Invalid bank credentials',
  CHANGE_PASSWORD: 'The bank requires a password change. Sign in to the bank website, change the password, then update the saved credentials',
  TIMEOUT: 'The bank website took too long to respond',
  ACCOUNT_BLOCKED: 'The bank account is blocked. Contact the bank before retrying',
  GENERIC: 'The bank scraper encountered an unexpected error',
  GENERAL_ERROR: 'The bank website returned an unexpected login error'
};

function getScraperErrorMessage(scrapingResult) {
  const errorMessage = typeof scrapingResult?.errorMessage === 'string'
    ? scrapingResult.errorMessage.trim()
    : '';

  if (errorMessage) {
    return errorMessage;
  }

  const errorType = typeof scrapingResult?.errorType === 'string'
    ? scrapingResult.errorType.trim()
    : '';

  if (Object.prototype.hasOwnProperty.call(SCRAPER_ERROR_MESSAGES, errorType)) {
    return SCRAPER_ERROR_MESSAGES[errorType];
  }

  return errorType
    ? `Scraper failed with error type ${errorType}`
    : 'Scraper failed without error details';
}

module.exports = {
  getScraperErrorMessage
};
