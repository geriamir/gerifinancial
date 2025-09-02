const averagingDenominatorService = require('../averagingDenominatorService');

describe('AveragingDenominatorService', () => {
  
  describe('getAveragingDenominator', () => {
    
    it('should return 1 for empty category months to avoid division by zero', () => {
      const categoryMonths = new Set();
      const allDataMonths = 6;
      const requestedMonths = 6;
      
      const result = averagingDenominatorService.getAveragingDenominator(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(1);
    });

    it('should handle null category months gracefully', () => {
      const categoryMonths = null;
      const allDataMonths = 6;
      const requestedMonths = 6;
      
      const result = averagingDenominatorService.getAveragingDenominator(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(1);
    });

    it('should fall back to category months present for invalid parameters', () => {
      const categoryMonths = new Set([1, 2, 3]);
      const allDataMonths = 0; // Invalid
      const requestedMonths = -1; // Invalid
      
      const result = averagingDenominatorService.getAveragingDenominator(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(3);
    });

    it('should return category months when category appears in ALL available data months', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5, 6]);
      const allDataMonths = 6; // Same as category months
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingDenominator(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(6); // Should use actual months present
    });

    it('should return category months for high presence pattern (>=80%)', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5]); // 5 out of 6 months = 83%
      const allDataMonths = 6;
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingDenominator(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(5); // Should use actual months present
    });

    it('should return category months for sporadic patterns (<80%)', () => {
      const categoryMonths = new Set([1, 3, 5]); // 3 out of 6 months = 50%
      const allDataMonths = 6;
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingDenominator(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(3); // Should use actual months present
    });

    it('should handle edge case where category appears exactly at 80% threshold', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 8]); // 5 out of 6 months = 83% (above 80%)
      const allDataMonths = 6;
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingDenominator(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(5); // Should treat as high presence
    });
  });

  describe('getAveragingDenominatorEnhanced', () => {
    
    it('should return 1 for empty category months', () => {
      const categoryMonths = new Set();
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      const requestedMonths = 6;
      
      const result = averagingDenominatorService.getAveragingDenominatorEnhanced(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(1);
    });

    it('should handle invalid allDataMonths gracefully', () => {
      const categoryMonths = new Set([1, 2, 3]);
      const allDataMonths = new Set(); // Empty
      const requestedMonths = 6;
      
      const result = averagingDenominatorService.getAveragingDenominatorEnhanced(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(3);
    });

    it('should return category months when appearing in ALL available data months', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5, 6]);
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingDenominatorEnhanced(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      // Should use requested months since this looks like a regular expense extending beyond data window
      expect(result).toBe(12);
    });

    it('should detect regular expense starting from first month (limited scraping history)', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5]); // Missing month 6
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]); // Data available for all months
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingDenominatorEnhanced(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(5); // Use actual months present
    });

    it('should detect irregular pattern when category has gaps from beginning', () => {
      const categoryMonths = new Set([3, 4, 5, 6, 7]); // Missing months 1, 2
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6, 7]); // Data available for all months
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingDenominatorEnhanced(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(5); // Use actual months present even for irregular pattern
    });

    it('should handle sporadic patterns correctly', () => {
      const categoryMonths = new Set([1, 4, 7]); // Very sporadic - 3 out of 7 months
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6, 7]);
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingDenominatorEnhanced(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result).toBe(3); // Use actual months present for sporadic
    });
  });

  describe('analyzeSpendingPattern', () => {
    
    it('should identify REGULAR pattern when category appears in all months', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5, 6]);
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      
      const result = averagingDenominatorService.analyzeSpendingPattern(
        categoryMonths, allDataMonths
      );
      
      expect(result.patternType).toBe('REGULAR');
      expect(result.confidence).toBe(95);
      expect(result.coveragePercentage).toBe(100);
      expect(result.monthsPresent).toBe(6);
      expect(result.totalMonthsAnalyzed).toBe(6);
    });

    it('should identify MOSTLY_REGULAR pattern (80-99% coverage)', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5]); // 5 out of 6 = 83%
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      
      const result = averagingDenominatorService.analyzeSpendingPattern(
        categoryMonths, allDataMonths
      );
      
      expect(result.patternType).toBe('MOSTLY_REGULAR');
      expect(result.confidence).toBe(80);
      expect(result.coveragePercentage).toBe(83);
    });

    it('should identify SEMI_REGULAR pattern (50-79% coverage)', () => {
      const categoryMonths = new Set([1, 2, 3, 4]); // 4 out of 6 = 67%
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      
      const result = averagingDenominatorService.analyzeSpendingPattern(
        categoryMonths, allDataMonths
      );
      
      expect(result.patternType).toBe('SEMI_REGULAR');
      expect(result.confidence).toBe(60);
      expect(result.coveragePercentage).toBe(67);
    });

    it('should identify IRREGULAR pattern (<50% coverage)', () => {
      const categoryMonths = new Set([1, 3]); // 2 out of 6 = 33%
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      
      const result = averagingDenominatorService.analyzeSpendingPattern(
        categoryMonths, allDataMonths
      );
      
      expect(result.patternType).toBe('IRREGULAR');
      expect(result.confidence).toBe(40);
      expect(result.coveragePercentage).toBe(33);
    });

    it('should handle edge case at 50% threshold', () => {
      const categoryMonths = new Set([1, 2, 3]); // 3 out of 6 = 50%
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      
      const result = averagingDenominatorService.analyzeSpendingPattern(
        categoryMonths, allDataMonths
      );
      
      expect(result.patternType).toBe('SEMI_REGULAR');
      expect(result.coveragePercentage).toBe(50);
    });

    it('should include sorted month arrays in analysis', () => {
      const categoryMonths = new Set([6, 2, 4, 1]); // Unsorted input
      const allDataMonths = new Set([5, 1, 6, 2, 4, 3]);
      
      const result = averagingDenominatorService.analyzeSpendingPattern(
        categoryMonths, allDataMonths
      );
      
      expect(result.categoryMonths).toEqual([1, 2, 4, 6]); // Should be sorted
      expect(result.allDataMonths).toEqual([1, 2, 3, 4, 5, 6]); // Should be sorted
    });
  });

  describe('getAveragingStrategy', () => {
    
    it('should return complete strategy with analysis and reasoning for regular pattern', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5, 6]);
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      // Should use requested months since this looks like a regular expense extending beyond data window
      expect(result.denominator).toBe(12);
      expect(result.analysis.patternType).toBe('REGULAR');
      expect(result.reasoning).toContain('Regular expense appearing in all 6 available months');
    });

    it('should return strategy for mostly regular pattern', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5]);
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result.analysis.patternType).toBe('MOSTLY_REGULAR');
      expect(result.reasoning).toContain('Mostly regular expense (83% coverage)');
      expect(result.reasoning).toContain('Missing months likely due to limited data history');
    });

    it('should return strategy for semi-regular pattern', () => {
      const categoryMonths = new Set([1, 2, 3, 4]);
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result.analysis.patternType).toBe('SEMI_REGULAR');
      expect(result.reasoning).toContain('Semi-regular expense (67% coverage)');
    });

    it('should return strategy for irregular pattern', () => {
      const categoryMonths = new Set([1, 4]);
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]);
      const requestedMonths = 12;
      
      const result = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(result.analysis.patternType).toBe('IRREGULAR');
      expect(result.reasoning).toContain('Irregular expense (33% coverage)');
    });
  });

  describe('_generateReasoning', () => {
    
    it('should generate appropriate reasoning for each pattern type', () => {
      const service = averagingDenominatorService;
      
      // Regular pattern
      let analysis = { patternType: 'REGULAR', coveragePercentage: 100, monthsPresent: 6 };
      let reasoning = service._generateReasoning(analysis, 6, 12);
      expect(reasoning).toContain('Regular expense appearing in all 6 available months');
      
      // Mostly regular pattern
      analysis = { patternType: 'MOSTLY_REGULAR', coveragePercentage: 83, monthsPresent: 5 };
      reasoning = service._generateReasoning(analysis, 5, 12);
      expect(reasoning).toContain('Mostly regular expense (83% coverage)');
      
      // Semi-regular pattern
      analysis = { patternType: 'SEMI_REGULAR', coveragePercentage: 67, monthsPresent: 4 };
      reasoning = service._generateReasoning(analysis, 4, 12);
      expect(reasoning).toContain('Semi-regular expense (67% coverage)');
      
      // Irregular pattern
      analysis = { patternType: 'IRREGULAR', coveragePercentage: 33, monthsPresent: 2 };
      reasoning = service._generateReasoning(analysis, 2, 12);
      expect(reasoning).toContain('Irregular expense (33% coverage)');
      
      // Unknown pattern type
      analysis = { patternType: 'UNKNOWN', coveragePercentage: 50, monthsPresent: 3 };
      reasoning = service._generateReasoning(analysis, 3, 12);
      expect(reasoning).toContain('Using 3 months for averaging');
    });
  });

  describe('Real-world scenarios', () => {
    
    it('should handle salary pattern (appears every month)', () => {
      const categoryMonths = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const requestedMonths = 12;
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(strategy.denominator).toBe(12);
      expect(strategy.analysis.patternType).toBe('REGULAR');
      expect(strategy.analysis.confidence).toBe(95);
    });

    it('should handle mortgage scenario - regular monthly expense with limited query window', () => {
      // Mortgage exists Feb-July but analysis queries Jan-June (missing July data)
      const categoryMonths = new Set([2, 3, 4, 5, 6]); // Feb-June (5 months)
      const allDataMonths = new Set([2, 3, 4, 5, 6]); // Same as category (no data in Jan)
      const requestedMonths = 6; // Analysis requested Jan-June
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      // Should recognize this as a regular monthly expense and use 6 months
      expect(strategy.denominator).toBe(6);
      expect(strategy.analysis.patternType).toBe('REGULAR');
    });

    it('should handle new expense starting mid-analysis period', () => {
      // New expense starts in month 4 and continues (4,5,6 out of 1,2,3,4,5,6)
      const categoryMonths = new Set([4, 5, 6]); // 3 consecutive months
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6]); // 6 months of data
      const requestedMonths = 6;
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      // Should use actual months present for SEMI_REGULAR pattern (50% coverage)
      expect(strategy.denominator).toBe(3);
      expect(strategy.analysis.patternType).toBe('SEMI_REGULAR'); // 50% coverage
    });

    it('should handle grocery pattern with limited scraping history', () => {
      const categoryMonths = new Set([7, 8, 9, 10, 11, 12]); // Only 6 months of data
      const allDataMonths = new Set([7, 8, 9, 10, 11, 12]); // Same as category months
      const requestedMonths = 12;
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      // Should use full requested period since this looks like regular expense extending beyond data window
      expect(strategy.denominator).toBe(12);
      expect(strategy.analysis.patternType).toBe('REGULAR');
    });

    it('should handle quarterly insurance payments', () => {
      const categoryMonths = new Set([1, 4, 7, 10]); // Quarterly payments
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const requestedMonths = 12;
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(strategy.denominator).toBe(4); // Use actual months present
      expect(strategy.analysis.patternType).toBe('IRREGULAR'); // 33% coverage
    });

    it('should handle vacation expenses (sporadic)', () => {
      const categoryMonths = new Set([7, 12]); // Summer and winter vacation
      const allDataMonths = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const requestedMonths = 12;
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(strategy.denominator).toBe(2); // Use actual months present
      expect(strategy.analysis.patternType).toBe('IRREGULAR');
      expect(strategy.analysis.coveragePercentage).toBe(17); // 2/12 = 17%
    });

    it('should handle missing first months due to account setup', () => {
      const categoryMonths = new Set([5, 6, 7, 8, 9, 10, 11, 12]); // Started tracking mid-year
      const allDataMonths = new Set([5, 6, 7, 8, 9, 10, 11, 12]); // Same period
      const requestedMonths = 12;
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      // Should use full requested period since this looks like regular expense extending beyond data window
      expect(strategy.denominator).toBe(12);
      expect(strategy.analysis.patternType).toBe('REGULAR'); // 100% of available data
    });
  });

  describe('Performance and edge cases', () => {
    
    it('should handle large datasets efficiently', () => {
      const categoryMonths = new Set();
      const allDataMonths = new Set();
      
      // Create large datasets
      for (let i = 1; i <= 1000; i++) {
        allDataMonths.add(i);
        if (i % 2 === 0) { // Even months only
          categoryMonths.add(i);
        }
      }
      
      const start = Date.now();
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, 1000
      );
      const end = Date.now();
      
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
      expect(strategy.analysis.coveragePercentage).toBe(50);
      expect(strategy.analysis.patternType).toBe('SEMI_REGULAR');
    });

    it('should handle single month scenarios', () => {
      const categoryMonths = new Set([1]);
      const allDataMonths = new Set([1]);
      const requestedMonths = 12;
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(strategy.denominator).toBe(1);
      expect(strategy.analysis.patternType).toBe('REGULAR');
      expect(strategy.analysis.coveragePercentage).toBe(100);
    });

    it('should handle months in random order', () => {
      const categoryMonths = new Set([12, 3, 7, 1, 9, 5]);
      const allDataMonths = new Set([11, 1, 8, 12, 3, 5, 9, 7, 2, 6]);
      const requestedMonths = 12;
      
      const strategy = averagingDenominatorService.getAveragingStrategy(
        categoryMonths, allDataMonths, requestedMonths
      );
      
      expect(strategy.analysis.categoryMonths).toEqual([1, 3, 5, 7, 9, 12]); // Should be sorted
      expect(strategy.analysis.allDataMonths).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 11, 12]); // Should be sorted
    });
  });
});
