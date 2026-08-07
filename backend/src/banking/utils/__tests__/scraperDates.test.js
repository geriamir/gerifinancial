const { resolveStartDate, DEFAULT_LOOKBACK_MONTHS } = require('../scraperDates');

describe('scraperDates', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('defaults first-time scraping to 12 months ago', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-07T12:00:00.000Z'));

    expect(DEFAULT_LOOKBACK_MONTHS).toBe(12);
    expect(resolveStartDate(null)).toEqual(new Date('2025-08-07T12:00:00.000Z'));
  });

  it('preserves the last scrape date for incremental imports', () => {
    const lastScraped = new Date('2026-08-01T12:00:00.000Z');

    expect(resolveStartDate(lastScraped)).toBe(lastScraped);
  });
});
