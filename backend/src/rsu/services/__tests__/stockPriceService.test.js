const stockPriceService = require('../stockPriceService');
const { StockPrice } = require('../../../shared/models');
const { RSUGrant } = require('../../models');

// Mock external fetch
global.fetch = jest.fn();

describe('Stock Price Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stockPriceService.updateInProgress.clear();
  });

  describe('API Integration', () => {
    describe('fetchFromYahooFinance', () => {
      it('should fetch stock price from Yahoo Finance API', async () => {
        const mockResponse = {
          chart: {
            result: [{
              meta: {
                regularMarketPrice: 150.75,
                regularMarketChange: 2.25,
                regularMarketChangePercent: 1.52,
                regularMarketVolume: 1000000,
                marketCap: 2500000000,
                regularMarketOpen: 148.50,
                regularMarketDayHigh: 151.00,
                regularMarketDayLow: 147.00,
                longName: 'Microsoft Corporation',
                exchangeName: 'NASDAQ'
              },
              indicators: {
                quote: [{
                  volume: [1000000]
                }]
              }
            }]
          }
        };

        fetch.mockResolvedValue({
          ok: true,
          json: async () => mockResponse
        });

        const result = await stockPriceService.fetchFromYahooFinance('MSFT');

        expect(result.symbol).toBe('MSFT');
        expect(result.price).toBe(150.75);
        expect(result.change).toBe(2.25);
        expect(result.changePercent).toBe(1.52);
        expect(result.companyName).toBe('Microsoft Corporation');
        expect(result.source).toBe('yahoo');
      });

      it('should handle Yahoo Finance API errors', async () => {
        fetch.mockResolvedValue({
          ok: false,
          status: 404
        });

        await expect(stockPriceService.fetchFromYahooFinance('INVALID')).rejects.toThrow('Yahoo Finance API error: 404');
      });

      it('should handle invalid response format', async () => {
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ chart: { result: [] } })
        });

        await expect(stockPriceService.fetchFromYahooFinance('MSFT')).rejects.toThrow('Invalid response from Yahoo Finance');
      });
    });

    describe('fetchFromAlphaVantage', () => {
      it('should fetch stock price from Alpha Vantage API', async () => {
        process.env.ALPHA_VANTAGE_API_KEY = 'test-key';
        
        const mockResponse = {
          'Global Quote': {
            '01. symbol': 'MSFT',
            '05. price': '150.75',
            '02. open': '148.50',
            '03. high': '151.00',
            '04. low': '147.00',
            '06. volume': '1000000',
            '09. change': '2.25',
            '10. change percent': '1.52%'
          }
        };

        fetch.mockResolvedValue({
          ok: true,
          json: async () => mockResponse
        });

        const result = await stockPriceService.fetchFromAlphaVantage('MSFT');

        expect(result.symbol).toBe('MSFT');
        expect(result.price).toBe(150.75);
        expect(result.change).toBe(2.25);
        expect(result.changePercent).toBe(1.52);
        expect(result.source).toBe('alphavantage');
      });

      it('should throw error when API key is missing', async () => {
        delete process.env.ALPHA_VANTAGE_API_KEY;

        await expect(stockPriceService.fetchFromAlphaVantage('MSFT')).rejects.toThrow('Alpha Vantage API key not configured');
      });
    });

    describe('fetchFromFinnhub', () => {
      it('should fetch stock price from Finnhub API', async () => {
        process.env.FINNHUB_API_KEY = 'test-key';
        
        const mockResponse = {
          c: 150.75,  // current price
          d: 2.25,    // change
          dp: 1.52,   // change percent
          o: 148.50,  // open
          h: 151.00,  // high
          l: 147.00   // low
        };

        fetch.mockResolvedValue({
          ok: true,
          json: async () => mockResponse
        });

        const result = await stockPriceService.fetchFromFinnhub('MSFT');

        expect(result.symbol).toBe('MSFT');
        expect(result.price).toBe(150.75);
        expect(result.change).toBe(2.25);
        expect(result.changePercent).toBe(1.52);
        expect(result.source).toBe('finnhub');
      });

      it('should throw error when API key is missing', async () => {
        delete process.env.FINNHUB_API_KEY;

        await expect(stockPriceService.fetchFromFinnhub('MSFT')).rejects.toThrow('Finnhub API key not configured');
      });
    });
  });

  describe('Price Updates', () => {
    describe('updatePrice', () => {
      it('should update price with fallback between APIs', async () => {
        // Mock Yahoo Finance success
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chart: {
              result: [{
                meta: {
                  regularMarketPrice: 150.75,
                  regularMarketChange: 2.25,
                  regularMarketChangePercent: 1.52
                },
                indicators: { quote: [{ volume: [1000000] }] }
              }]
            }
          })
        });

        // Mock StockPrice.upsertPrice
        const mockUpsertPrice = jest.spyOn(StockPrice, 'upsertPrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 150.75,
          date: new Date(),
          source: 'yahoo'
        });

        const result = await stockPriceService.updatePrice('MSFT');

        expect(result.symbol).toBe('MSFT');
        expect(result.price).toBe(150.75);
        expect(mockUpsertPrice).toHaveBeenCalledWith(
          'MSFT',
          expect.any(Date),
          150.75,
          'yahoo',
          expect.any(Object)
        );

        mockUpsertPrice.mockRestore();
      });

      it('should fallback to Alpha Vantage when Yahoo fails', async () => {
        // Set environment variable for Alpha Vantage
        process.env.ALPHA_VANTAGE_API_KEY = 'test-key';
        
        // Mock Yahoo Finance failure (3 retries)
        fetch
          .mockResolvedValueOnce({ ok: false, status: 500 })
          .mockResolvedValueOnce({ ok: false, status: 500 })
          .mockResolvedValueOnce({ ok: false, status: 500 });

        // Mock Alpha Vantage success (3 retries, first attempt succeeds)
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            'Global Quote': {
              '01. symbol': 'MSFT',
              '05. price': '148.25',
              '02. open': '147.00',
              '03. high': '149.00',
              '04. low': '146.50',
              '06. volume': '1000000',
              '09. change': '0.50',
              '10. change percent': '0.34%'
            }
          })
        });

        const mockUpsertPrice = jest.spyOn(StockPrice, 'upsertPrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 148.25,
          source: 'alphavantage'
        });

        const result = await stockPriceService.updatePrice('MSFT');

        expect(result.price).toBe(148.25);
        expect(mockUpsertPrice).toHaveBeenCalledWith(
          'MSFT',
          expect.any(Date),
          148.25,
          'alphavantage',
          expect.any(Object)
        );

        mockUpsertPrice.mockRestore();
      });

      it('should prevent concurrent updates for same symbol', async () => {
        // Add symbol to in-progress set
        stockPriceService.updateInProgress.add('MSFT');

        const result = await stockPriceService.updatePrice('MSFT');

        expect(result).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
      });

      it('should throw error when all APIs fail', async () => {
        // Mock all APIs failing
        fetch.mockRejectedValue(new Error('Network error'));
        
        await expect(stockPriceService.updatePrice('INVALID')).rejects.toThrow('No valid price data found for INVALID');
      });
    });

    describe('getCurrentPrice', () => {
      it('should return existing price if not stale', async () => {
        const mockGetLatestPrice = jest.spyOn(StockPrice, 'getLatestPrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 150.00,
          lastUpdated: new Date(),
          isStale: false
        });

        const result = await stockPriceService.getCurrentPrice('MSFT');

        expect(result.price).toBe(150.00);
        expect(mockGetLatestPrice).toHaveBeenCalledWith('MSFT');

        mockGetLatestPrice.mockRestore();
      });

      it('should update stale price', async () => {
        const mockGetLatestPrice = jest.spyOn(StockPrice, 'getLatestPrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 145.00,
          lastUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          isStale: true
        });

        // Mock successful update
        const updatePriceSpy = jest.spyOn(stockPriceService, 'updatePrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 150.75
        });

        await stockPriceService.getCurrentPrice('MSFT');

        expect(updatePriceSpy).toHaveBeenCalledWith('MSFT');

        mockGetLatestPrice.mockRestore();
        updatePriceSpy.mockRestore();
      });

      it('should create new price record for unknown symbol', async () => {
        const mockGetLatestPrice = jest.spyOn(StockPrice, 'getLatestPrice').mockResolvedValue(null);
        const fetchAndCreateSpy = jest.spyOn(stockPriceService, 'fetchAndCreatePrice').mockResolvedValue({
          symbol: 'NEWSTOCK',
          price: 100.00
        });

        const result = await stockPriceService.getCurrentPrice('NEWSTOCK');

        expect(result.symbol).toBe('NEWSTOCK');
        expect(fetchAndCreateSpy).toHaveBeenCalledWith('NEWSTOCK');

        mockGetLatestPrice.mockRestore();
        fetchAndCreateSpy.mockRestore();
      });
    });
  });

  describe('Historical Prices', () => {
    describe('fetchHistoricalPrices', () => {
      it('should fetch historical data from Yahoo Finance', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const mockResponse = {
          chart: {
            result: [{
              timestamp: [1704067200, 1704153600], // Jan 1 & 2, 2024
              indicators: {
                quote: [{
                  close: [150.00, 152.50],
                  open: [148.00, 150.25],
                  high: [151.00, 153.00],
                  low: [147.50, 150.00],
                  volume: [1000000, 1200000]
                }]
              }
            }]
          }
        };

        fetch.mockResolvedValue({
          ok: true,
          json: async () => mockResponse
        });

        const result = await stockPriceService.fetchHistoricalPrices('MSFT', startDate, endDate);

        expect(result).toHaveLength(2);
        expect(result[0].price).toBe(150.00);
        expect(result[1].price).toBe(152.50);
        expect(result[0].date).toBeInstanceOf(Date);
      });

      it('should fallback to Alpha Vantage for historical data', async () => {
        // Mock Yahoo Finance failure
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500
        });

        // Mock Alpha Vantage success
        process.env.ALPHA_VANTAGE_API_KEY = 'test-key';
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            'Time Series (Daily)': {
              '2024-01-01': {
                '1. open': '148.00',
                '2. high': '151.00',
                '3. low': '147.50',
                '4. close': '150.00',
                '5. volume': '1000000'
              },
              '2024-01-02': {
                '1. open': '150.25',
                '2. high': '153.00',
                '3. low': '150.00',
                '4. close': '152.50',
                '5. volume': '1200000'
              }
            }
          })
        });

        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const result = await stockPriceService.fetchHistoricalPrices('MSFT', startDate, endDate);

        expect(result).toHaveLength(2);
        expect(result[0].price).toBe(150.00);
        expect(result[0].date).toEqual(new Date('2024-01-01'));
        expect(result[1].price).toBe(152.50);
        expect(result[1].date).toEqual(new Date('2024-01-02'));
      });
    });

    describe('getPriceOnDate', () => {
      it('should return exact price for specific date', async () => {
        const targetDate = new Date('2024-01-15');
        
        const mockGetPriceOnDate = jest.spyOn(StockPrice, 'getPriceOnDate').mockResolvedValue({
          symbol: 'MSFT',
          price: 155.00,
          date: targetDate
        });

        const result = await stockPriceService.getPriceOnDate('MSFT', targetDate);

        expect(result).toBe(155.00);
        expect(mockGetPriceOnDate).toHaveBeenCalledWith('MSFT', targetDate);

        mockGetPriceOnDate.mockRestore();
      });

      it('should return current price for future dates', async () => {
        const futureDate = new Date('2030-01-01');
        
        const mockGetPriceOnDate = jest.spyOn(StockPrice, 'getPriceOnDate').mockResolvedValue(null);
        const mockGetLatestPrice = jest.spyOn(StockPrice, 'getLatestPrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 200.00
        });

        const result = await stockPriceService.getPriceOnDate('MSFT', futureDate);

        expect(result).toBe(200.00);

        mockGetPriceOnDate.mockRestore();
        mockGetLatestPrice.mockRestore();
      });

      it('should find last trading day price when exact date not available', async () => {
        const targetDate = new Date('2024-01-15');
        
        const mockGetPriceOnDate = jest.spyOn(StockPrice, 'getPriceOnDate').mockResolvedValue(null);
        const findLastTradingDayPriceSpy = jest.spyOn(stockPriceService, 'findLastTradingDayPrice').mockResolvedValue({
          price: 153.00,
          date: new Date('2024-01-12') // Friday before weekend
        });

        const result = await stockPriceService.getPriceOnDate('MSFT', targetDate);

        expect(result).toBe(153.00);

        mockGetPriceOnDate.mockRestore();
        findLastTradingDayPriceSpy.mockRestore();
      });
    });
  });

  describe('Grant Integration', () => {
    describe('handleNewGrant', () => {
      it('should create new stock price for new symbol', async () => {
        const mockGetLatestPrice = jest.spyOn(StockPrice, 'getLatestPrice').mockResolvedValue(null);
        const fetchAndCreatePriceSpy = jest.spyOn(stockPriceService, 'fetchAndCreatePrice').mockResolvedValue({
          symbol: 'NEWSTOCK',
          price: 100.00
        });

        const result = await stockPriceService.handleNewGrant('NEWSTOCK', 95.00);

        expect(result.symbol).toBe('NEWSTOCK');
        expect(fetchAndCreatePriceSpy).toHaveBeenCalledWith('NEWSTOCK', 95.00);

        mockGetLatestPrice.mockRestore();
        fetchAndCreatePriceSpy.mockRestore();
      });

      it('should update stale price for existing symbol', async () => {
        const mockGetLatestPrice = jest.spyOn(StockPrice, 'getLatestPrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 145.00,
          isStale: true
        });

        const updatePriceSpy = jest.spyOn(stockPriceService, 'updatePrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 150.00
        });

        await stockPriceService.handleNewGrant('MSFT', 140.00);

        expect(updatePriceSpy).toHaveBeenCalledWith('MSFT');

        mockGetLatestPrice.mockRestore();
        updatePriceSpy.mockRestore();
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('updateAllActivePrices', () => {
      it('should update prices for all active symbols', async () => {
        const mockGetActiveSymbols = jest.spyOn(StockPrice, 'getActiveSymbols').mockResolvedValue([
          { symbol: 'MSFT' },
          { symbol: 'AAPL' },
          { symbol: 'GOOGL' }
        ]);

        const updatePriceSpy = jest.spyOn(stockPriceService, 'updatePrice')
          .mockResolvedValueOnce({ symbol: 'MSFT' })
          .mockResolvedValueOnce({ symbol: 'AAPL' })
          .mockRejectedValueOnce(new Error('API error'));

        const result = await stockPriceService.updateAllActivePrices();

        expect(result.total).toBe(3);
        expect(result.updated).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].symbol).toBe('GOOGL');

        mockGetActiveSymbols.mockRestore();
        updatePriceSpy.mockRestore();
      });
    });

    describe('checkAndUpdateTodaysPrices', () => {
      it('should identify and update stocks missing today\'s prices', async () => {
        const mockGetActiveSymbols = jest.spyOn(StockPrice, 'getActiveSymbols').mockResolvedValue([
          { symbol: 'MSFT' },
          { symbol: 'AAPL' }
        ]);

        const mockAggregate = jest.spyOn(RSUGrant, 'aggregate').mockResolvedValue([
          { symbol: 'GOOGL' }
        ]);

        const mockGetPriceOnDate = jest.spyOn(StockPrice, 'getPriceOnDate')
          .mockResolvedValueOnce(null) // MSFT missing today's price
          .mockResolvedValueOnce({ price: 180.00 }) // AAPL has today's price
          .mockResolvedValueOnce(null); // GOOGL missing today's price

        const updatePriceSpy = jest.spyOn(stockPriceService, 'updatePrice')
          .mockResolvedValueOnce({ symbol: 'MSFT' })
          .mockResolvedValueOnce({ symbol: 'GOOGL' });

        const result = await stockPriceService.checkAndUpdateTodaysPrices();

        expect(result.total).toBe(3);
        expect(result.needingUpdate).toBe(2);
        expect(result.updated).toBe(2);
        expect(result.skipped).toBe(1);

        mockGetActiveSymbols.mockRestore();
        mockAggregate.mockRestore();
        mockGetPriceOnDate.mockRestore();
        updatePriceSpy.mockRestore();
      });
    });
  });

  describe('Manual Price Updates', () => {
    describe('setManualPrice', () => {
      it('should set manual price for symbol', async () => {
        const mockUpsertPrice = jest.spyOn(StockPrice, 'upsertPrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 160.00,
          source: 'manual',
          date: new Date()
        });

        const result = await stockPriceService.setManualPrice('MSFT', 160.00);

        expect(result.symbol).toBe('MSFT');
        expect(result.price).toBe(160.00);
        expect(result.source).toBe('manual');
        expect(mockUpsertPrice).toHaveBeenCalledWith(
          'MSFT',
          expect.any(Date),
          160.00,
          'manual',
          {}
        );

        mockUpsertPrice.mockRestore();
      });

      it('should handle manual price with metadata', async () => {
        const metadata = { companyName: 'Microsoft Corporation' };
        const mockUpsertPrice = jest.spyOn(StockPrice, 'upsertPrice').mockResolvedValue({
          symbol: 'MSFT',
          price: 160.00,
          source: 'manual'
        });

        await stockPriceService.setManualPrice('MSFT', 160.00, new Date(), metadata);

        expect(mockUpsertPrice).toHaveBeenCalledWith(
          'MSFT',
          expect.any(Date),
          160.00,
          'manual',
          metadata
        );

        mockUpsertPrice.mockRestore();
      });
    });
  });

  describe('Utility Functions', () => {
    describe('retryWithBackoff', () => {
      it('should retry failed operations with exponential backoff', async () => {
        let attempts = 0;
        const failingFunction = jest.fn(() => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        });

        const result = await stockPriceService.retryWithBackoff(failingFunction, 3);

        expect(result).toBe('success');
        expect(failingFunction).toHaveBeenCalledTimes(3);
      });

      it('should throw error after max attempts', async () => {
        const alwaysFailingFunction = jest.fn(() => {
          throw new Error('Permanent failure');
        });

        await expect(stockPriceService.retryWithBackoff(alwaysFailingFunction, 2)).rejects.toThrow('Permanent failure');
        expect(alwaysFailingFunction).toHaveBeenCalledTimes(2);
      });
    });

    describe('delay', () => {
      it('should delay execution for specified time', async () => {
        const start = Date.now();
        await stockPriceService.delay(100);
        const end = Date.now();

        expect(end - start).toBeGreaterThanOrEqual(90); // Allow for timing variations
      });
    });
  });
});
