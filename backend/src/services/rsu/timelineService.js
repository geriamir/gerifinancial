const { RSUGrant, RSUSale, StockPrice } = require('../../models');
const taxCalculationService = require('./taxCalculationService');
const stockPriceService = require('./stockPriceService');

class TimelineService {
  /**
   * Generate portfolio timeline with proper event-driven calculation
   * @param {string} userId - User ID
   * @param {Date} startDate - Optional start date (defaults to earliest grant)
   * @param {Date} endDate - Optional end date (defaults to 2 years from now)
   * @returns {Array} Portfolio timeline data points
   */
  async generatePortfolioTimeline(userId, startDate = null, endDate = null) {
    try {
      // Get all user grants and sales
      const grants = await RSUGrant.getUserGrants(userId, { status: 'active' });
      const sales = await RSUSale.getUserSales(userId);

      if (grants.length === 0) {
        return [];
      }

      // Determine timeline boundaries
      const grantDates = grants.map(g => new Date(g.grantDate));
      const earliestGrant = new Date(Math.min(...grantDates));
      const now = new Date();
      
      const timelineStart = startDate || earliestGrant;
      
      // Generate timeline for each grant first to find the latest event
      const grantTimelines = await Promise.all(
        grants.map(grant => this.generateGrantTimeline(grant, sales))
      );

      // Find the latest event date across all grants
      const allEvents = grantTimelines.flat();
      const latestEventDate = allEvents.length > 0 
        ? new Date(Math.max(...allEvents.map(event => event.date.getTime())))
        : new Date(now.getFullYear() + 2, now.getMonth(), 0);
      
      const timelineEnd = endDate || latestEventDate;

      console.log(`Generating timeline from ${timelineStart.toISOString()} to ${timelineEnd.toISOString()}`);

      // Consolidate into portfolio timeline
      const portfolioTimeline = this.consolidatePortfolioTimeline(
        grantTimelines, 
        timelineStart, 
        timelineEnd
      );

      return portfolioTimeline;
    } catch (error) {
      throw new Error(`Failed to generate portfolio timeline: ${error.message}`);
    }
  }

  /**
   * Identify which vesting event represents the 2-year cliff for a grant
   * @param {Object} grant - RSU Grant object
   * @returns {Date|null} Date of the cliff vesting event, or null if no cliff
   */
  identifyCliffEvent(grant) {
    if (!grant.vestingSchedule || grant.vestingSchedule.length === 0) {
      return null;
    }

    const grantDate = new Date(grant.grantDate);
    const twoYearAnniversary = new Date(grantDate);
    twoYearAnniversary.setFullYear(twoYearAnniversary.getFullYear() + 2);

    // Find the vesting event closest to the 2-year anniversary
    let cliffEvent = null;
    let minDiff = Infinity;

    for (const vesting of grant.vestingSchedule) {
      const vestDate = new Date(vesting.vestDate);
      const diff = Math.abs(vestDate.getTime() - twoYearAnniversary.getTime());
      
      // Only consider events that are at or after the 2-year mark
      if (vestDate >= twoYearAnniversary && diff < minDiff) {
        minDiff = diff;
        cliffEvent = vestDate;
      }
    }

    return cliffEvent;
  }

  /**
   * Generate timeline for a single grant with all its vesting and sale events
   * IMPORTANT: Uses historical stock prices at each event date for accurate timeline calculation
   * @param {Object} grant - RSU Grant object
   * @param {Array} allSales - All user sales to filter for this grant
   * @returns {Array} Grant timeline events
   */
  async generateGrantTimeline(grant, allSales) {
    const grantId = grant._id.toString();
    const grantSales = allSales.filter(sale => {
      const saleGrantId = typeof sale.grantId === 'string' ? sale.grantId : sale.grantId._id;
      return saleGrantId.toString() === grantId;
    });

    const events = [];
    
    // Identify the cliff event for this grant
    const cliffEventDate = this.identifyCliffEvent(grant);

    // Process vesting events
    for (const vesting of grant.vestingSchedule || []) {
      const vestDate = new Date(vesting.vestDate);
      const priceAtVesting = await stockPriceService.getPriceOnDate(grant.stockSymbol, vestDate);
      
      if (!priceAtVesting || priceAtVesting <= 0) {
        throw new Error(`Could not get historical price for ${grant.stockSymbol} on ${vestDate.toDateString()}`);
      }
      
      // Check if this is the cliff event
      const isCliffEvent = cliffEventDate && vestDate.getTime() === cliffEventDate.getTime();
      
      // Use taxCalculationService for accurate tax calculations
      let eventGrossValue, eventOriginalValue, eventTaxCalculation;
      let sharesForCalculation;
      
      if (isCliffEvent) {
        // For cliff events, calculate total accumulated value for the entire grant up to this point
        // Find all vesting events up to and including this cliff event
        sharesForCalculation = grant.vestingSchedule
          .filter(v => new Date(v.vestDate) <= vestDate)
          .reduce((sum, v) => sum + v.shares, 0);
      } else {
        // For regular vesting events, calculate just this specific event
        sharesForCalculation = vesting.shares;
      }
      
      eventGrossValue = sharesForCalculation * priceAtVesting;
      eventOriginalValue = sharesForCalculation * grant.pricePerShare;
      
      // Create a temporary sale object for tax calculation
      const tempSale = {
        sharesAmount: sharesForCalculation,
        pricePerShare: priceAtVesting,
        saleDate: vestDate
      };
      
      // Use the proper tax calculation service
      try {
        eventTaxCalculation = await taxCalculationService.calculateSaleTax(grant, tempSale);
      } catch (error) {
        console.error(`Error calculating taxes for vesting event:`, error);
        // Fallback to basic calculation if service fails
        eventTaxCalculation = {
          originalValue: eventOriginalValue,
          profit: eventGrossValue - eventOriginalValue,
          isLongTerm: vestDate.getTime() - new Date(grant.grantDate).getTime() >= (2 * 365 * 24 * 60 * 60 * 1000),
          wageIncomeTax: eventOriginalValue * 0.65,
          capitalGainsTax: Math.max(0, eventGrossValue - eventOriginalValue) * 
            (vestDate.getTime() - new Date(grant.grantDate).getTime() >= (2 * 365 * 24 * 60 * 60 * 1000) ? 0.25 : 0.65),
          totalTax: 0,
          netValue: 0
        };
        eventTaxCalculation.totalTax = eventTaxCalculation.wageIncomeTax + eventTaxCalculation.capitalGainsTax;
        eventTaxCalculation.netValue = eventGrossValue - eventTaxCalculation.totalTax;
      }
      
      events.push({
        date: vestDate,
        eventType: 'vesting',
        grantId: grantId,
        stockSymbol: grant.stockSymbol,
        company: grant.company,
        sharesVested: vesting.shares,
        sharesForCalculation: sharesForCalculation, // Total shares used for tax calculation (accumulated for cliff events)
        pricePerShare: priceAtVesting,
        vestedValue: vesting.vestedValue || eventGrossValue,
        grantDate: grant.grantDate,
        originalPricePerShare: grant.pricePerShare,
        isCliffEvent: isCliffEvent,
        // Individual event tax details from taxCalculationService
        eventTaxDetails: eventTaxCalculation
      });
    }

    // Process sale events
    for (const sale of grantSales) {
      events.push({
        date: new Date(sale.saleDate),
        eventType: 'sale',
        grantId: grantId,
        stockSymbol: grant.stockSymbol,
        company: grant.company,
        sharesSold: sale.sharesAmount,
        pricePerShare: sale.pricePerShare,
        saleValue: sale.totalSaleValue,
        taxCalculation: sale.taxCalculation,
        grantDate: grant.grantDate,
        originalPricePerShare: grant.pricePerShare
      });
    }

    // Sort events chronologically
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate accumulated values for each event
    let accumulatedShares = 0;
    let accumulatedVestedShares = 0;

    const timelineEvents = events.map(event => {
      if (event.eventType === 'vesting') {
        accumulatedShares += event.sharesVested;
        // For future projections, count all vesting events, not just currently vested ones
        accumulatedVestedShares += event.sharesVested;
      } else if (event.eventType === 'sale') {
        accumulatedVestedShares -= event.sharesSold;
        // Note: we don't subtract from accumulatedShares as those represent total vested over time
      }

      // Calculate values and taxes at this point
      const currentValue = accumulatedVestedShares * event.pricePerShare;
      const originalValue = accumulatedVestedShares * event.originalPricePerShare;

      // Calculate tax implications for current holdings
      let taxDetails;
      if (accumulatedVestedShares > 0) {
        taxDetails = this.calculateAccumulatedTaxLiability(
          event,
          accumulatedVestedShares,
          originalValue,
          currentValue
        );
      } else {
        taxDetails = {
          originalValue: 0,
          currentValue: 0,
          taxLiability: 0,
          netValue: 0
        };
      }

      return {
        ...event,
        accumulatedShares,
        accumulatedVestedShares,
        accumulatedValue: currentValue,
        taxDetails
      };
    });

    return timelineEvents;
  }

  /**
   * Calculate tax liability for accumulated vested shares at a point in time
   * @param {Object} event - Current event
   * @param {number} shares - Number of shares held
   * @param {number} originalValue - Original grant value for these shares
   * @param {number} currentValue - Current market value
   * @returns {Object} Tax calculation details
   */
  calculateAccumulatedTaxLiability(event, shares, originalValue, currentValue) {
    const profit = currentValue - originalValue;
    
    // Determine if long-term (2+ years from grant date)
    const holdingPeriodMs = event.date.getTime() - new Date(event.grantDate).getTime();
    const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
    const isLongTerm = holdingPeriodMs >= twoYearsMs;

    // Calculate taxes based on Israeli tax rules
    const wageIncomeTax = originalValue * 0.65; // 65% on original value
    const capitalGainsTaxRate = isLongTerm ? 0.25 : 0.65;
    const capitalGainsTax = Math.max(0, profit) * capitalGainsTaxRate;
    const totalTax = wageIncomeTax + capitalGainsTax;
    const netValue = currentValue - totalTax;

    return {
      originalValue: Math.round(originalValue * 100) / 100,
      currentValue: Math.round(currentValue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      isLongTerm,
      wageIncomeTax: Math.round(wageIncomeTax * 100) / 100,
      capitalGainsTax: Math.round(capitalGainsTax * 100) / 100,
      taxLiability: Math.round(totalTax * 100) / 100,
      netValue: Math.round(netValue * 100) / 100
    };
  }

  /**
   * Consolidate grant timelines into portfolio-level monthly data points
   * @param {Array} grantTimelines - Array of grant timeline arrays
   * @param {Date} startDate - Timeline start date
   * @param {Date} endDate - Timeline end date
   * @returns {Array} Portfolio timeline data points
   */
  consolidatePortfolioTimeline(grantTimelines, startDate, endDate) {
    // Flatten all events and sort chronologically
    const allEvents = grantTimelines.flat().sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Build complete timeline from earliest event to latest
    if (allEvents.length === 0) return [];
    
    const earliestEvent = allEvents[0].date;
    const latestEvent = allEvents[allEvents.length - 1].date;
    
    // Extend range to include full months and requested timeframe
    const timelineStart = new Date(Math.min(earliestEvent.getTime(), startDate.getTime()));
    const timelineEnd = new Date(Math.max(latestEvent.getTime(), endDate.getTime()));
    
    // Generate monthly data points for the FULL timeline
    const monthlyData = new Map();
    const now = new Date();

    const currentMonth = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);
    while (currentMonth <= timelineEnd) {
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = currentMonth.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      
      monthlyData.set(monthKey, {
        date: new Date(currentMonth),
        month: monthLabel,
        monthKey,
        isHistorical: currentMonth < now,
        isFuture: currentMonth > now,
        isToday: currentMonth.getFullYear() === now.getFullYear() && 
                currentMonth.getMonth() === now.getMonth(),
        events: [],
        totalAccumulatedShares: 0,
        totalAccumulatedValue: 0,
        totalNetValue: 0,
        totalTaxLiability: 0,
        grantBreakdown: []
      });

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // Assign events to monthly buckets
    for (const event of allEvents) {
      const eventDate = new Date(event.date);
      const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData.has(monthKey)) {
        monthlyData.get(monthKey).events.push(event);
      }
    }

    // Calculate portfolio totals for each month using accumulated values from events
    const sortedMonths = Array.from(monthlyData.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    
    for (const monthData of sortedMonths) {
      // Group latest events by grant to get the most recent accumulated values
      const grantLatestEvents = new Map();
      
      // For each grant, find the latest event up to this month across ALL previous months
      for (const month of sortedMonths) {
        if (month.date > monthData.date) break; // Only consider months up to current month
        
        for (const event of month.events) {
          // Keep track of the latest event for each grant
          if (!grantLatestEvents.has(event.grantId) || 
              event.date >= grantLatestEvents.get(event.grantId).date) {
            grantLatestEvents.set(event.grantId, event);
          }
        }
      }

      // Sum up accumulated values from the latest event of each grant
      let totalShares = 0;
      let totalValue = 0;
      let totalNetValue = 0;
      let totalTaxLiability = 0;
      const grantBreakdown = [];

      for (const [grantId, latestEvent] of grantLatestEvents.entries()) {
        if (latestEvent.accumulatedVestedShares > 0) {
          // Check if this grant has passed its 2-year cliff at this point in time
          const grantDate = new Date(latestEvent.grantDate);
          const twoYearCliff = new Date(grantDate);
          twoYearCliff.setFullYear(twoYearCliff.getFullYear() + 2);
          
          // Include grants if the cliff date has passed by the END of this month
          const monthEnd = new Date(monthData.date.getFullYear(), monthData.date.getMonth() + 1, 0);
          if (monthEnd >= twoYearCliff) {
            totalShares += latestEvent.accumulatedVestedShares;
            totalValue += latestEvent.accumulatedValue;
            totalNetValue += latestEvent.taxDetails.netValue;
            totalTaxLiability += latestEvent.taxDetails.taxLiability;

            grantBreakdown.push({
              grantId,
              stockSymbol: latestEvent.stockSymbol,
              company: latestEvent.company,
              shares: latestEvent.accumulatedVestedShares,
              value: Math.round(latestEvent.accumulatedValue * 100) / 100,
              netValue: Math.round(latestEvent.taxDetails.netValue * 100) / 100,
              taxLiability: Math.round(latestEvent.taxDetails.taxLiability * 100) / 100,
              isLongTerm: latestEvent.taxDetails.isLongTerm
            });
          }
        }
      }

      monthData.totalAccumulatedShares = totalShares;
      monthData.totalAccumulatedValue = Math.round(totalValue * 100) / 100;
      monthData.totalNetValue = Math.round(totalNetValue * 100) / 100;
      monthData.totalTaxLiability = Math.round(totalTaxLiability * 100) / 100;
      monthData.grantBreakdown = grantBreakdown;
    }

    // Filter to return only the requested timeframe while preserving accumulated values
    return sortedMonths.filter(month => 
      month.date >= startDate && month.date <= endDate
    );
  }


  /**
   * Get portfolio timeline with specific date range
   * @param {string} userId - User ID
   * @param {string} timeframe - Timeframe ('1Y', '2Y', '5Y', 'ALL')
   * @returns {Array} Portfolio timeline data
   */
  async getPortfolioTimelineByTimeframe(userId, timeframe = '1Y') {
    const now = new Date();
    let startDate, endDate;

    switch (timeframe) {
      case '1Y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        endDate = new Date(now.getFullYear() + 2, now.getMonth(), 0);
        break;
      case '2Y':
        startDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
        endDate = new Date(now.getFullYear() + 2, now.getMonth(), 0);
        break;
      case '5Y':
        startDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
        endDate = new Date(now.getFullYear() + 3, now.getMonth(), 0);
        break;
      case 'ALL':
        startDate = null; // Will use earliest grant date
        endDate = null; // Will use latest vesting event date
        break;
      default:
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        endDate = new Date(now.getFullYear() + 2, now.getMonth(), 0);
    }

    return this.generatePortfolioTimeline(userId, startDate, endDate);
  }

  /**
   * Validate timeline data integrity
   * @param {Array} timeline - Timeline data to validate
   * @returns {Object} Validation result
   */
  validateTimeline(timeline) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(timeline) || timeline.length === 0) {
      errors.push('Timeline data is empty or invalid');
      return { isValid: false, errors, warnings };
    }

    // Check chronological order
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].date < timeline[i - 1].date) {
        errors.push('Timeline data is not in chronological order');
        break;
      }
    }

    // Check for negative values
    const negativeValues = timeline.filter(point => 
      point.totalAccumulatedValue < 0 || point.totalNetValue < 0
    );
    if (negativeValues.length > 0) {
      warnings.push(`${negativeValues.length} timeline points have negative values`);
    }

    // Check for unrealistic jumps
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      const valueChange = Math.abs(curr.totalAccumulatedValue - prev.totalAccumulatedValue);
      
      if (valueChange > prev.totalAccumulatedValue * 2) { // More than 200% change
        warnings.push(`Large value jump detected at ${curr.month}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      timelinePoints: timeline.length,
      dateRange: {
        start: timeline[0]?.date,
        end: timeline[timeline.length - 1]?.date
      }
    };
  }
}

module.exports = new TimelineService();
