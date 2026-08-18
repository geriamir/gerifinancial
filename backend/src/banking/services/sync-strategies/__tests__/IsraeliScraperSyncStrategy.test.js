jest.mock('../../bankScraperService', () => ({
  createScraper: jest.fn(),
  updateScrapingStatus: jest.fn()
}));

const bankScraperService = require('../../bankScraperService');
const IsraeliScraperSyncStrategy = require('../IsraeliScraperSyncStrategy');

class TestSyncStrategy extends IsraeliScraperSyncStrategy {
  constructor() {
    super({
      name: 'checking-accounts',
      displayName: 'Checking Accounts',
      icon: 'test',
      scrapingMethod: 'scrape',
      statusUpdates: {
        error: error => ({ message: error })
      }
    });
  }

  isSupported() {
    return true;
  }

  getEmptyResult() {
    return {};
  }

  async processScrapedData() {
    return {};
  }
}

describe('IsraeliScraperSyncStrategy', () => {
  let strategy;
  let bankAccount;

  beforeEach(() => {
    strategy = new TestSyncStrategy();
    bankAccount = {
      _id: 'account-1',
      bankId: 'visaCal',
      getScraperOptionsForStrategy: jest.fn().mockResolvedValue({
        credentials: { username: 'user', password: 'password' },
        startDate: new Date('2026-01-01T00:00:00.000Z')
      })
    };
  });

  it('reports a required password change instead of an unknown error', async () => {
    bankScraperService.createScraper.mockReturnValue({
      scrape: jest.fn().mockResolvedValue({
        success: false,
        errorType: 'CHANGE_PASSWORD'
      })
    });

    await expect(strategy.executeSync(bankAccount, {}, {})).rejects.toThrow(
      'Checking Accounts scraping failed: The bank requires a password change. Sign in to the bank website, change the password, then update the saved credentials'
    );
  });

  it('preserves a detailed error message returned by the scraper', async () => {
    bankScraperService.createScraper.mockReturnValue({
      scrape: jest.fn().mockResolvedValue({
        success: false,
        errorType: 'GENERAL_ERROR',
        errorMessage: 'CAL login is temporarily unavailable'
      })
    });

    await expect(strategy.executeSync(bankAccount, {}, {})).rejects.toThrow(
      'Checking Accounts scraping failed: CAL login is temporarily unavailable'
    );
  });

  it('includes an unmapped scraper error type in the failure', async () => {
    bankScraperService.createScraper.mockReturnValue({
      scrape: jest.fn().mockResolvedValue({
        success: false,
        errorType: 'NEW_SCRAPER_ERROR'
      })
    });

    await expect(strategy.executeSync(bankAccount, {}, {})).rejects.toThrow(
      'Checking Accounts scraping failed: Scraper failed with error type NEW_SCRAPER_ERROR'
    );
  });

  it('does not read inherited properties as scraper error messages', async () => {
    bankScraperService.createScraper.mockReturnValue({
      scrape: jest.fn().mockResolvedValue({
        success: false,
        errorType: '__proto__'
      })
    });

    await expect(strategy.executeSync(bankAccount, {}, {})).rejects.toThrow(
      'Checking Accounts scraping failed: Scraper failed with error type __proto__'
    );
  });

  it.each([
    ['a null result', null],
    ['a non-string error type', { success: false, errorType: { code: 'CHANGE_PASSWORD' } }]
  ])('handles %s without throwing a type error', async (_description, scrapingResult) => {
    bankScraperService.createScraper.mockReturnValue({
      scrape: jest.fn().mockResolvedValue(scrapingResult)
    });

    await expect(strategy.executeSync(bankAccount, {}, {})).rejects.toThrow(
      'Checking Accounts scraping failed: Scraper failed without error details'
    );
  });
});
