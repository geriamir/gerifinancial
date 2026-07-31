const DEFAULT_LOOKBACK_MONTHS = 6;

/**
 * Resolves the date a scrape should start from. Incremental when the account
 * has been scraped before, otherwise a fixed look-back window.
 *
 * Kept as a plain function rather than a model method because credential
 * validation runs against a throwaway account object that is never persisted.
 */
function resolveStartDate(lastScraped) {
  if (lastScraped) {
    return lastScraped;
  }
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - DEFAULT_LOOKBACK_MONTHS);
  return startDate;
}

module.exports = { resolveStartDate, DEFAULT_LOOKBACK_MONTHS };
