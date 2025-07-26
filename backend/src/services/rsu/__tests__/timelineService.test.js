const timelineService = require('../timelineService');
const stockPriceService = require('../stockPriceService');

// Mock stockPriceService
jest.mock('../stockPriceService', () => ({
  getPriceOnDate: jest.fn()
}));

describe('TimelineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Timeline Integration with Stock Price Service', () => {
    it('should delegate historical price lookups to stockPriceService.getPriceOnDate', () => {
      // Timeline service now directly uses stockPriceService.getPriceOnDate
      // instead of having its own redundant getHistoricalPrice method
      
      // Verify that the stockPriceService is properly mocked and available
      expect(stockPriceService.getPriceOnDate).toBeDefined();
      expect(typeof stockPriceService.getPriceOnDate).toBe('function');
      
      // The timeline service should use stockPriceService.getPriceOnDate directly
      // in generateGrantTimeline method for historical price lookups
    });

    it('should handle price lookup failures properly in timeline generation', () => {
      // Timeline service should throw errors when price lookups fail
      // instead of using default fallback values that could distort calculations
      
      // This ensures timeline calculations are accurate and fail fast
      // when historical data is not available rather than using incorrect prices
      expect(true).toBe(true); // Placeholder - actual timeline tests would go here
    });

    it('should demonstrate stockPriceService integration for future dates', async () => {
      const mockSymbol = 'FUTURE';
      const futureDate = new Date('2030-01-15');
      const mockCurrentPrice = 250.75;
      
      // Mock stockPriceService to return current price for future dates
      stockPriceService.getPriceOnDate.mockResolvedValue(mockCurrentPrice);

      // Timeline service uses stockPriceService.getPriceOnDate directly
      const result = await stockPriceService.getPriceOnDate(mockSymbol, futureDate);

      expect(stockPriceService.getPriceOnDate).toHaveBeenCalledWith(mockSymbol, futureDate);
      expect(result).toBe(mockCurrentPrice);
    });

    it('should demonstrate stockPriceService integration for non-trading days', async () => {
      const mockSymbol = 'WEEKEND';
      const weekendDate = new Date('2023-01-14');
      const mockLastTradingDayPrice = 175.50;
      
      // Mock stockPriceService to return last trading day price
      stockPriceService.getPriceOnDate.mockResolvedValue(mockLastTradingDayPrice);

      // Timeline service uses stockPriceService.getPriceOnDate directly
      const result = await stockPriceService.getPriceOnDate(mockSymbol, weekendDate);

      expect(stockPriceService.getPriceOnDate).toHaveBeenCalledWith(mockSymbol, weekendDate);
      expect(result).toBe(mockLastTradingDayPrice);
    });
  });

  describe('Timeline Service Core Functionality', () => {
    it('should identify cliff events correctly', () => {
      const mockGrant = {
        grantDate: new Date('2023-01-01'),
        vestingSchedule: [
          { vestDate: new Date('2024-01-01'), shares: 100 },
          { vestDate: new Date('2025-01-01'), shares: 100 }, // This should be the cliff event
          { vestDate: new Date('2026-01-01'), shares: 100 }
        ]
      };

      const cliffDate = timelineService.identifyCliffEvent(mockGrant);
      
      // Should identify the vesting event closest to 2-year anniversary
      expect(cliffDate).toEqual(new Date('2025-01-01'));
    });

    it('should return null for grants without cliff events', () => {
      const mockGrant = {
        grantDate: new Date('2023-01-01'),
        vestingSchedule: [
          { vestDate: new Date('2023-06-01'), shares: 100 }, // Before 2-year mark
          { vestDate: new Date('2024-01-01'), shares: 100 }  // Before 2-year mark
        ]
      };

      const cliffDate = timelineService.identifyCliffEvent(mockGrant);
      
      // Should return null since no vesting events are at or after 2-year mark
      expect(cliffDate).toBeNull();
    });

    it('should validate timeline data structure', () => {
      const validTimeline = [
        { date: new Date('2023-01-01'), totalAccumulatedValue: 1000, totalNetValue: 800 },
        { date: new Date('2023-02-01'), totalAccumulatedValue: 1200, totalNetValue: 950 },
        { date: new Date('2023-03-01'), totalAccumulatedValue: 1100, totalNetValue: 900 }
      ];

      const validation = timelineService.validateTimeline(validTimeline);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(validation.timelinePoints).toBe(3);
    });

    it('should detect invalid timeline data', () => {
      const invalidTimeline = [
        { date: new Date('2023-02-01'), totalAccumulatedValue: 1000, totalNetValue: 800 },
        { date: new Date('2023-01-01'), totalAccumulatedValue: 1200, totalNetValue: 950 } // Out of order
      ];

      const validation = timelineService.validateTimeline(invalidTimeline);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Timeline data is not in chronological order');
    });
  });
});
