const { RSUGrant } = require('../../models');

class VestingService {
  /**
   * Generate quarterly vesting schedule for 5 years (20 periods)
   * @param {Date} grantDate - The grant date
   * @param {number} totalShares - Total shares to vest
   * @param {number} years - Number of years for vesting (default: 5)
   * @returns {Array} Array of vesting schedule objects
   */
  generateQuarterlySchedule(grantDate, totalShares, years = 5) {
    const periods = years * 4; // Quarterly vesting = 20 periods
    const shareDistribution = this.distributeSharesEvenly(totalShares, periods);
    const vestingDates = this.calculateVestingDates(grantDate, periods);
    const now = new Date();
    
    return vestingDates.map((date, index) => ({
      vestDate: date,
      shares: shareDistribution[index],
      vested: date <= now, // Automatically mark past dates as vested
      vestedValue: 0
    }));
  }

  /**
   * Distribute shares evenly across periods with smart remainder handling
   * @param {number} totalShares - Total shares to distribute
   * @param {number} periods - Number of vesting periods
   * @returns {Array} Array of share amounts per period
   */
  distributeSharesEvenly(totalShares, periods = 20) {
    // Validate inputs
    if (typeof totalShares !== 'number' || totalShares <= 0) {
      throw new Error('Total shares must be a positive number');
    }
    
    if (typeof periods !== 'number' || periods <= 0) {
      throw new Error('Periods must be a positive number');
    }
    
    const baseShares = Math.floor(totalShares / periods);
    const remainder = totalShares % periods;
    
    const distribution = [];
    
    for (let i = 0; i < periods; i++) {
      // Distribute remainder evenly across early periods
      const sharesThisPeriod = i < remainder ? baseShares + 1 : baseShares;
      distribution.push(sharesThisPeriod);
    }
    
    // Verify total shares match
    const totalDistributed = distribution.reduce((sum, shares) => sum + shares, 0);
    if (totalDistributed !== totalShares) {
      throw new Error(`Share distribution error: ${totalDistributed} !== ${totalShares}`);
    }
    
    return distribution;
  }

  /**
   * Calculate quarterly vesting dates starting from grant date
   * @param {Date} grantDate - The grant date
   * @param {number} periods - Number of vesting periods
   * @returns {Array} Array of vesting dates
   */
  calculateVestingDates(grantDate, periods = 20) {
    const dates = [];
    const baseDate = new Date(grantDate);
    
    for (let i = 1; i <= periods; i++) {
      const vestDate = new Date(baseDate);
      vestDate.setMonth(vestDate.getMonth() + (i * 3)); // Add 3 months for each quarter
      dates.push(vestDate);
    }
    
    return dates;
  }

  /**
   * Process vesting events for a specific date
   * @param {Date} date - Date to process vesting for (default: today)
   * @returns {Object} Summary of processed vesting events
   */
  async processVestingEvents(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Find all grants with vesting events on this date
    const grants = await RSUGrant.find({
      status: 'active',
      'vestingSchedule.vestDate': {
        $gte: startOfDay,
        $lte: endOfDay
      },
      'vestingSchedule.vested': false
    });
    
    const processedEvents = [];
    let totalSharesVested = 0;
    let totalEstimatedValue = 0;
    
    for (const grant of grants) {
      const vestingEvents = grant.vestingSchedule.filter(v => 
        v.vestDate >= startOfDay && 
        v.vestDate <= endOfDay && 
        !v.vested
      );
      
      for (const vestingEvent of vestingEvents) {
        const estimatedValue = vestingEvent.shares * (grant.currentPrice || grant.pricePerShare);
        
        vestingEvent.vested = true;
        vestingEvent.vestedValue = estimatedValue;
        
        processedEvents.push({
          grantId: grant._id,
          stockSymbol: grant.stockSymbol,
          company: grant.company,
          shares: vestingEvent.shares,
          vestDate: vestingEvent.vestDate,
          estimatedValue
        });
        
        totalSharesVested += vestingEvent.shares;
        totalEstimatedValue += estimatedValue;
      }
      
      await grant.save();
    }
    
    return {
      date,
      processedEvents,
      totalSharesVested,
      totalEstimatedValue,
      grantsAffected: grants.length
    };
  }

  /**
   * Get vesting calendar for a user
   * @param {string} userId - User ID
   * @param {number} months - Number of months to look ahead (default: 12)
   * @returns {Array} Array of vesting events grouped by month
   */
  async getVestingCalendar(userId, months = 12) {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);
    
    const vestingEvents = await RSUGrant.getUpcomingVestingEvents(userId, months * 30);
    
    // Group events by month
    const calendar = {};
    
    vestingEvents.forEach(event => {
      const monthKey = `${event.vestDate.getFullYear()}-${String(event.vestDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!calendar[monthKey]) {
        calendar[monthKey] = {
          year: event.vestDate.getFullYear(),
          month: event.vestDate.getMonth() + 1,
          events: [],
          totalShares: 0,
          totalEstimatedValue: 0
        };
      }
      
      calendar[monthKey].events.push(event);
      calendar[monthKey].totalShares += event.shares;
      calendar[monthKey].totalEstimatedValue += event.estimatedValue || 0;
    });
    
    // Convert to array and sort by date
    return Object.values(calendar).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  /**
   * Update vesting status for a specific grant and date
   * @param {string} grantId - Grant ID
   * @param {Date} vestDate - Vesting date
   * @param {number} shares - Number of shares to vest
   * @param {number} vestedValue - Value at vesting (optional)
   * @returns {Object} Updated grant
   */
  async updateVestingStatus(grantId, vestDate, shares, vestedValue = null) {
    const grant = await RSUGrant.findById(grantId);
    if (!grant) {
      throw new Error('Grant not found');
    }
    
    const success = grant.updateVestingStatus(vestDate, true, vestedValue);
    if (!success) {
      throw new Error('Vesting event not found for the specified date');
    }
    
    await grant.save();
    return grant;
  }

  /**
   * Get vesting progress for a specific grant
   * @param {string} grantId - Grant ID
   * @returns {Object} Vesting progress summary
   */
  async getVestingProgress(grantId) {
    const grant = await RSUGrant.findById(grantId);
    if (!grant) {
      throw new Error('Grant not found');
    }
    
    const totalShares = grant.totalShares;
    const vestedShares = grant.vestedShares;
    const unvestedShares = grant.unvestedShares;
    const progressPercentage = grant.vestingProgress;
    
    const upcomingVesting = grant.getUpcomingVesting(90); // Next 3 months
    const nextVesting = upcomingVesting.length > 0 ? upcomingVesting[0] : null;
    
    return {
      grantId,
      stockSymbol: grant.stockSymbol,
      company: grant.company,
      totalShares,
      vestedShares,
      unvestedShares,
      progressPercentage,
      nextVesting: nextVesting ? {
        vestDate: nextVesting.vestDate,
        shares: nextVesting.shares,
        estimatedValue: nextVesting.shares * (grant.currentPrice || grant.pricePerShare)
      } : null,
      upcomingEvents: upcomingVesting.map(v => ({
        vestDate: v.vestDate,
        shares: v.shares,
        estimatedValue: v.shares * (grant.currentPrice || grant.pricePerShare)
      }))
    };
  }

  /**
   * Get upcoming vesting events for a user
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look ahead (default: 30)
   * @returns {Array} Array of upcoming vesting events
   */
  async getUpcomingVestings(userId, days = 30) {
    return await RSUGrant.getUpcomingVestingEvents(userId, days);
  }

  /**
   * Get vesting statistics for a user
   * @param {string} userId - User ID
   * @returns {Object} Vesting statistics summary
   */
  async getVestingStatistics(userId) {
    const grants = await RSUGrant.getUserGrants(userId, { status: 'active' });
    
    let totalShares = 0;
    let totalVestedShares = 0;
    let totalUnvestedShares = 0;
    let totalOriginalValue = 0;
    let totalCurrentValue = 0;
    let totalEstimatedVestedValue = 0;
    
    const upcomingEvents = [];
    
    grants.forEach(grant => {
      totalShares += grant.totalShares;
      totalVestedShares += grant.vestedShares;
      totalUnvestedShares += grant.unvestedShares;
      totalOriginalValue += grant.totalValue;
      totalCurrentValue += grant.currentValue;
      
      // Calculate estimated value of vested shares
      const vestedValue = grant.vestedShares * (grant.currentPrice || grant.pricePerShare);
      totalEstimatedVestedValue += vestedValue;
      
      // Collect upcoming vesting events
      const upcoming = grant.getUpcomingVesting(365); // Next year
      upcoming.forEach(v => {
        upcomingEvents.push({
          grantId: grant._id,
          stockSymbol: grant.stockSymbol,
          company: grant.company,
          vestDate: v.vestDate,
          shares: v.shares,
          estimatedValue: v.shares * (grant.currentPrice || grant.pricePerShare)
        });
      });
    });
    
    // Sort upcoming events by date
    upcomingEvents.sort((a, b) => a.vestDate - b.vestDate);
    
    const overallProgress = totalShares > 0 ? (totalVestedShares / totalShares) * 100 : 0;
    
    return {
      totalGrants: grants.length,
      totalShares,
      totalVestedShares,
      totalUnvestedShares,
      overallProgress,
      totalOriginalValue,
      totalCurrentValue,
      totalEstimatedVestedValue,
      totalGainLoss: totalCurrentValue - totalOriginalValue,
      gainLossPercentage: totalOriginalValue > 0 ? ((totalCurrentValue - totalOriginalValue) / totalOriginalValue) * 100 : 0,
      upcomingEvents: upcomingEvents.slice(0, 10), // Next 10 events
      nextVestingDate: upcomingEvents.length > 0 ? upcomingEvents[0].vestDate : null
    };
  }

  /**
   * Process all past vesting events for existing grants
   * @returns {Object} Summary of processed past vesting events
   */
  async processAllPastVestingEvents() {
    const now = new Date();
    console.log('Processing all past vesting events...');
    
    // Find all grants with past vesting events that are not marked as vested
    const grants = await RSUGrant.find({
      status: 'active',
      'vestingSchedule.vestDate': { $lt: now },
      'vestingSchedule.vested': false
    });
    
    let totalEventsProcessed = 0;
    let totalSharesVested = 0;
    let grantsUpdated = 0;
    
    for (const grant of grants) {
      let grantUpdated = false;
      
      for (const vestingEvent of grant.vestingSchedule) {
        if (vestingEvent.vestDate < now && !vestingEvent.vested) {
          vestingEvent.vested = true;
          // Set a default vested value based on current or grant price
          const priceAtVesting = grant.currentPrice || grant.pricePerShare;
          vestingEvent.vestedValue = vestingEvent.shares * priceAtVesting;
          
          totalEventsProcessed++;
          totalSharesVested += vestingEvent.shares;
          grantUpdated = true;
        }
      }
      
      if (grantUpdated) {
        await grant.save();
        grantsUpdated++;
        console.log(`Updated grant ${grant._id} (${grant.stockSymbol}) - processed past vesting events`);
      }
    }
    
    const summary = {
      grantsUpdated,
      totalEventsProcessed,
      totalSharesVested,
      processedAt: now
    };
    
    console.log('Past vesting events processing completed:', summary);
    return summary;
  }

  /**
   * Initialize vesting service - process past events on startup
   */
  async initialize() {
    console.log('Initializing Vesting Service...');
    try {
      await this.processAllPastVestingEvents();
      console.log('Vesting Service initialized successfully');
    } catch (error) {
      console.error('Error initializing Vesting Service:', error);
      throw error;
    }
  }

  /**
   * Validate vesting schedule integrity
   * @param {Array} vestingSchedule - Vesting schedule to validate
   * @param {number} totalShares - Expected total shares
   * @returns {Object} Validation result
   */
  validateVestingSchedule(vestingSchedule, totalShares) {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(vestingSchedule) || vestingSchedule.length === 0) {
      errors.push('Vesting schedule cannot be empty');
      return { isValid: false, errors, warnings };
    }
    
    // Check total shares
    const scheduledShares = vestingSchedule.reduce((sum, v) => sum + v.shares, 0);
    if (scheduledShares !== totalShares) {
      errors.push(`Scheduled shares (${scheduledShares}) do not match total shares (${totalShares})`);
    }
    
    // Check for negative or zero shares
    const invalidShares = vestingSchedule.filter(v => v.shares <= 0);
    if (invalidShares.length > 0) {
      errors.push(`${invalidShares.length} vesting events have invalid share amounts`);
    }
    
    // Check for duplicate dates
    const dates = vestingSchedule.map(v => v.vestDate.toDateString());
    const uniqueDates = new Set(dates);
    if (dates.length !== uniqueDates.size) {
      warnings.push('Duplicate vesting dates found');
    }
    
    // Check date ordering
    const sortedSchedule = [...vestingSchedule].sort((a, b) => a.vestDate - b.vestDate);
    const isOrdered = vestingSchedule.every((v, i) => v.vestDate.getTime() === sortedSchedule[i].vestDate.getTime());
    if (!isOrdered) {
      warnings.push('Vesting schedule is not in chronological order');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      totalScheduledShares: scheduledShares,
      totalExpectedShares: totalShares
    };
  }
}

module.exports = new VestingService();
