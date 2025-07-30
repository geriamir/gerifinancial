const { RSUGrant, RSUSale, StockPrice } = require('../../models');
const vestingService = require('./vestingService');
const taxCalculationService = require('./taxCalculationService');
const stockPriceService = require('./stockPriceService');

class RSUService {
  /**
   * Create a new RSU grant with vesting schedule
   * @param {string} userId - User ID
   * @param {Object} grantData - Grant data
   * @returns {Object} Created grant with vesting schedule
   */
  async createGrant(userId, grantData) {
    try {
    // Validate required fields
    if (!grantData.stockSymbol || !grantData.grantDate || 
        !grantData.totalValue || !grantData.totalShares) {
      throw new Error('Missing required grant fields');
    }

      // Generate vesting schedule
      const vestingSchedule = vestingService.generateQuarterlySchedule(
        new Date(grantData.grantDate),
        grantData.totalShares,
        5 // 5 years
      );

      // Validate vesting schedule
      const scheduleValidation = vestingService.validateVestingSchedule(vestingSchedule, grantData.totalShares);
      if (!scheduleValidation.isValid) {
        throw new Error(`Vesting schedule validation failed: ${scheduleValidation.errors.join(', ')}`);
      }

      // Calculate price per share
      const pricePerShare = grantData.totalValue / grantData.totalShares;

      // Handle stock price for new grant
      const stockPrice = await stockPriceService.handleNewGrant(
        grantData.stockSymbol,
        pricePerShare
      );

      // If grant date is in the past, try to populate historical prices for accurate vesting calculations
      const grantDate = new Date(grantData.grantDate);
      const now = new Date();
      
      if (grantDate < now) {
        try {
          console.log(`Grant date is in the past, fetching historical prices for ${grantData.stockSymbol}...`);
          await stockPriceService.populateHistoricalPrices(
            grantData.stockSymbol,
            grantDate,
            now
          );
        } catch (error) {
          console.warn(`Could not fetch historical prices for ${grantData.stockSymbol}:`, error.message);
          // Continue with grant creation even if historical prices fail
        }
      }

      // Create the grant
      const grant = new RSUGrant({
        userId,
        stockSymbol: grantData.stockSymbol.toUpperCase(),
        name: grantData.name,
        company: grantData.company,
        grantDate: new Date(grantData.grantDate),
        totalValue: grantData.totalValue,
        totalShares: grantData.totalShares,
        pricePerShare: pricePerShare,
        currentPrice: stockPrice.price,
        vestingSchedule,
        notes: grantData.notes || ''
      });

      await grant.save();

      // Update stock price with company metadata if provided
      if (grantData.company && stockPrice.metadata && !stockPrice.metadata.companyName) {
        stockPrice.metadata.companyName = grantData.company;
        await stockPrice.save();
      }

      return grant;
    } catch (error) {
      throw new Error(`Failed to create RSU grant: ${error.message}`);
    }
  }

  /**
   * Get user's RSU grants with optional filtering
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Array} Array of grants
   */
  async getUserGrants(userId, filters = {}) {
    try {
      const grants = await RSUGrant.getUserGrants(userId, filters);
      
      // Populate current stock prices with most recent priceDate
      const grantPromises = grants.map(async (grant) => {
        const stockPrice = await StockPrice.findOne({ symbol: grant.stockSymbol })
          .sort({ priceDate: -1 }); // Get the record with the most recent priceDate
        if (stockPrice) {
          grant.currentPrice = stockPrice.price;
          grant.currentValue = grant.totalShares * stockPrice.price;
        }
        return grant;
      });

      return await Promise.all(grantPromises);
    } catch (error) {
      throw new Error(`Failed to get user grants: ${error.message}`);
    }
  }

  /**
   * Update an existing grant
   * @param {string} grantId - Grant ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated grant
   */
  async updateGrant(grantId, updates) {
    try {
      const grant = await RSUGrant.findById(grantId);
      if (!grant) {
        throw new Error('Grant not found');
      }

      // Validate updates
      if (updates.totalShares && updates.totalShares !== grant.totalShares) {
        // If shares changed, regenerate vesting schedule
        const vestingSchedule = vestingService.generateQuarterlySchedule(
          grant.grantDate,
          updates.totalShares,
          5
        );
        updates.vestingSchedule = vestingSchedule;
      }

      // Apply updates
      Object.assign(grant, updates);
      await grant.save();

      return grant;
    } catch (error) {
      throw new Error(`Failed to update grant: ${error.message}`);
    }
  }

  /**
   * Delete a grant and its associated sales
   * @param {string} grantId - Grant ID
   * @returns {Object} Deletion summary
   */
  async deleteGrant(grantId) {
    try {
      const grant = await RSUGrant.findById(grantId);
      if (!grant) {
        throw new Error('Grant not found');
      }

      // Get associated sales
      const sales = await RSUSale.getSalesByGrant(grantId);
      
      // Delete all sales first
      await RSUSale.deleteMany({ grantId });
      
      // Delete the grant
      await RSUGrant.findByIdAndDelete(grantId);

      return {
        deletedGrant: true,
        deletedSalesCount: sales.length,
        stockSymbol: grant.stockSymbol
      };
    } catch (error) {
      throw new Error(`Failed to delete grant: ${error.message}`);
    }
  }

  /**
   * Record a new RSU sale
   * @param {string} userId - User ID
   * @param {Object} saleData - Sale data
   * @returns {Object} Created sale with tax calculations
   */
  async recordSale(userId, saleData) {
    try {
      // Validate sale against grant
      const validation = await RSUSale.validateSaleAgainstGrant(
        saleData.grantId,
        saleData.sharesAmount,
        new Date(saleData.saleDate)
      );

      // Calculate taxes
      const taxCalculation = await taxCalculationService.calculateSaleTax(
        validation.grant,
        {
          sharesAmount: saleData.sharesAmount,
          pricePerShare: saleData.pricePerShare,
          saleDate: new Date(saleData.saleDate)
        }
      );

      // Calculate total sale value
      const totalSaleValue = saleData.sharesAmount * saleData.pricePerShare;

      // Create the sale
      const sale = new RSUSale({
        userId,
        grantId: saleData.grantId,
        saleDate: new Date(saleData.saleDate),
        sharesAmount: saleData.sharesAmount,
        pricePerShare: saleData.pricePerShare,
        totalSaleValue: totalSaleValue,
        taxCalculation,
        notes: saleData.notes || ''
      });

      await sale.save();

      // Update stock price if this is a recent sale
      const stockPrice = await StockPrice.findOne({ symbol: validation.grant.stockSymbol });
      if (stockPrice) {
        const saleDateAge = Date.now() - new Date(saleData.saleDate).getTime();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        
        if (saleDateAge <= threeDaysMs) {
          stockPrice.updatePrice(saleData.pricePerShare, 'sale');
          await stockPrice.save();
        }
      }

      return sale;
    } catch (error) {
      throw new Error(`Failed to record sale: ${error.message}`);
    }
  }

  /**
   * Get user's sales with optional filtering
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Array} Array of sales
   */
  async getUserSales(userId, filters = {}) {
    try {
      return await RSUSale.getUserSales(userId, filters);
    } catch (error) {
      throw new Error(`Failed to get user sales: ${error.message}`);
    }
  }

  /**
   * Get sales for a specific grant
   * @param {string} grantId - Grant ID
   * @returns {Array} Array of sales
   */
  async getSalesByGrant(grantId) {
    try {
      return await RSUSale.getSalesByGrant(grantId);
    } catch (error) {
      throw new Error(`Failed to get sales by grant: ${error.message}`);
    }
  }

  /**
   * Get comprehensive portfolio summary
   * @param {string} userId - User ID
   * @returns {Object} Portfolio summary
   */
  async getPortfolioSummary(userId) {
    try {
      // Get grants with current prices (this fetches fresh stock prices)
      const grants = await this.getUserGrants(userId, { status: 'active' });

      // Calculate grants summary with current prices
      let grantsSummary = {
        totalGrants: 0,
        totalShares: 0,
        totalOriginalValue: 0,
        totalCurrentValue: 0,
        totalGainLoss: 0,
        gainLossPercentage: 0
      };

      // Calculate vested post-tax values
      let vestedPostTaxSummary = {
        totalVestedShares: 0,
        totalVestedCurrentValue: 0,
        totalVestedPostTaxValue: 0,
        estimatedTaxLiability: 0
      };

      if (grants.length > 0) {
        grantsSummary = {
          totalGrants: grants.length,
          totalShares: grants.reduce((sum, grant) => sum + grant.totalShares, 0),
          totalOriginalValue: grants.reduce((sum, grant) => sum + grant.totalValue, 0),
          totalCurrentValue: grants.reduce((sum, grant) => sum + (grant.currentValue || 0), 0),
          totalGainLoss: 0,
          gainLossPercentage: 0
        };
        
        grantsSummary.totalGainLoss = grantsSummary.totalCurrentValue - grantsSummary.totalOriginalValue;
        grantsSummary.gainLossPercentage = grantsSummary.totalOriginalValue > 0 
          ? (grantsSummary.totalGainLoss / grantsSummary.totalOriginalValue) * 100 
          : 0;

        // Calculate vested post-tax values for grants that are 2+ years old only
        // Account for sales to show available funds, not obsolete values
        const now = new Date();
        const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
        
        // Get all sales to calculate available shares
        const allSales = await this.getUserSales(userId);
        
        for (const grant of grants) {
          try {
            const vestedShares = grant.vestedShares || 0;
            if (vestedShares > 0 && grant.totalValue > 0 && grant.totalShares > 0) {
              // Check if grant qualifies for long-term capital gains (2+ years from grant date)
              const grantAge = now.getTime() - new Date(grant.grantDate).getTime();
              const isLongTerm = grantAge >= twoYearsMs;
              
              // Only include grants that are 2+ years old (long-term qualified)
              if (isLongTerm) {
                const currentPrice = grant.currentPrice || grant.pricePerShare || 0;
                
                // Calculate available shares (vested minus sold)
                const grantSales = allSales.filter(sale => {
                  const saleGrantId = typeof sale.grantId === 'string' ? sale.grantId : sale.grantId._id;
                  return saleGrantId.toString() === grant._id.toString();
                });
                const sharesSold = grantSales.reduce((total, sale) => total + sale.sharesAmount, 0);
                const availableShares = Math.max(0, vestedShares - sharesSold);
                
                // Only calculate tax estimate on available shares if we have valid data
                if (currentPrice > 0 && availableShares > 0) {
                  const availableCurrentValue = availableShares * currentPrice;
                  
                  // Estimate post-tax value for available vested shares with long-term rates
                  const taxEstimate = taxCalculationService.estimateUnrealizedTaxLiabilityWithPeriod(
                    grant, 
                    availableShares, 
                    isLongTerm
                  );
                  
                  vestedPostTaxSummary.totalVestedShares += availableShares;
                  vestedPostTaxSummary.totalVestedCurrentValue += availableCurrentValue;
                  vestedPostTaxSummary.totalVestedPostTaxValue += taxEstimate.estimatedNetValue || 0;
                  vestedPostTaxSummary.estimatedTaxLiability += taxEstimate.estimatedTotalTax || 0;
                }
              }
            }
          } catch (error) {
            console.warn(`Error calculating tax estimate for grant ${grant._id}:`, error.message);
            // Continue processing other grants
          }
        }

        // Round values
        vestedPostTaxSummary.totalVestedCurrentValue = Math.round(vestedPostTaxSummary.totalVestedCurrentValue * 100) / 100;
        vestedPostTaxSummary.totalVestedPostTaxValue = Math.round(vestedPostTaxSummary.totalVestedPostTaxValue * 100) / 100;
        vestedPostTaxSummary.estimatedTaxLiability = Math.round(vestedPostTaxSummary.estimatedTaxLiability * 100) / 100;
      }

      // Get vesting statistics
      const vestingStats = await vestingService.getVestingStatistics(userId);

      // Get recent sales
      const recentSales = await RSUSale.getUserSales(userId, {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
      });

      // Calculate total net proceeds from sales
      const totalNetProceeds = recentSales.reduce((sum, sale) => 
        sum + (sale.taxCalculation?.netValue || 0), 0
      );

      return {
        grants: grantsSummary,
        vesting: {
          ...vestingStats,
          vestedPostTax: vestedPostTaxSummary
        },
        sales: {
          recentSalesCount: recentSales.length,
          totalNetProceeds: Math.round(totalNetProceeds * 100) / 100,
          lastSaleDate: recentSales.length > 0 ? recentSales[0].saleDate : null
        },
        summary: {
          totalPortfolioValue: grantsSummary.totalCurrentValue + totalNetProceeds,
          portfolioGainLoss: grantsSummary.totalGainLoss,
          nextVestingDate: vestingStats.nextVestingDate,
          overallProgress: vestingStats.overallProgress,
          vestedLiquidValue: vestedPostTaxSummary.totalVestedPostTaxValue // Available liquid value after taxes
        }
      };
    } catch (error) {
      throw new Error(`Failed to get portfolio summary: ${error.message}`);
    }
  }

  /**
   * Get portfolio performance metrics
   * @param {string} userId - User ID
   * @param {string} timeframe - Timeframe ('1M', '3M', '6M', '1Y', 'ALL')
   * @returns {Object} Performance metrics
   */
  async getPortfolioPerformance(userId, timeframe = '1Y') {
    try {
      const grants = await this.getUserGrants(userId, { status: 'active' });
      const sales = await this.getUserSales(userId);

      // Calculate timeframe boundaries
      const endDate = new Date();
      let startDate = new Date();
      
      switch (timeframe) {
        case '1M':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case '3M':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '6M':
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case '1Y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case 'ALL':
          startDate = new Date('1900-01-01');
          break;
        default:
          startDate.setFullYear(startDate.getFullYear() - 1);
      }

      // Calculate performance metrics
      let totalOriginalValue = 0;
      let totalCurrentValue = 0;
      let totalRealizedGains = 0;
      let totalTaxesPaid = 0;
      
      grants.forEach(grant => {
        totalOriginalValue += grant.totalValue;
        totalCurrentValue += grant.currentValue;
      });

      const timeframeSales = sales.filter(sale => 
        sale.saleDate >= startDate && sale.saleDate <= endDate
      );

      timeframeSales.forEach(sale => {
        totalRealizedGains += sale.taxCalculation?.profit || 0;
        totalTaxesPaid += sale.taxCalculation?.totalTax || 0;
      });

      const unrealizedGains = totalCurrentValue - totalOriginalValue;
      const totalGains = unrealizedGains + totalRealizedGains;
      const netGains = totalGains - totalTaxesPaid;
      const returnPercentage = totalOriginalValue > 0 ? (totalGains / totalOriginalValue) * 100 : 0;

      return {
        timeframe,
        period: {
          startDate,
          endDate
        },
        performance: {
          totalOriginalValue: Math.round(totalOriginalValue * 100) / 100,
          totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
          unrealizedGains: Math.round(unrealizedGains * 100) / 100,
          realizedGains: Math.round(totalRealizedGains * 100) / 100,
          totalGains: Math.round(totalGains * 100) / 100,
          taxesPaid: Math.round(totalTaxesPaid * 100) / 100,
          netGains: Math.round(netGains * 100) / 100,
          returnPercentage: Math.round(returnPercentage * 100) / 100,
          salesCount: timeframeSales.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to get portfolio performance: ${error.message}`);
    }
  }

  /**
   * Get performance for a specific grant
   * @param {string} grantId - Grant ID
   * @returns {Object} Grant performance metrics
   */
  async getGrantPerformance(grantId) {
    try {
      const grant = await RSUGrant.findById(grantId);
      if (!grant) {
        throw new Error('Grant not found');
      }

      const sales = await RSUSale.getSalesByGrant(grantId);
      const vestingProgress = await vestingService.getVestingProgress(grantId);

      // Calculate realized performance from sales
      let totalSaleValue = 0;
      let totalTaxesPaid = 0;
      let totalNetProceeds = 0;
      let sharesSold = 0;

      sales.forEach(sale => {
        totalSaleValue += sale.totalSaleValue;
        totalTaxesPaid += sale.taxCalculation?.totalTax || 0;
        totalNetProceeds += sale.taxCalculation?.netValue || 0;
        sharesSold += sale.sharesAmount;
      });

      // Calculate unrealized performance
      const remainingShares = grant.totalShares - sharesSold;
      const remainingOriginalValue = (remainingShares / grant.totalShares) * grant.totalValue;
      const remainingCurrentValue = remainingShares * (grant.currentPrice || grant.pricePerShare);
      const unrealizedGains = remainingCurrentValue - remainingOriginalValue;

      return {
        grantId,
        stockSymbol: grant.stockSymbol,
        company: grant.company,
        grantDate: grant.grantDate,
        totalShares: grant.totalShares,
        sharesSold,
        remainingShares,
        vesting: vestingProgress,
        realized: {
          totalSaleValue: Math.round(totalSaleValue * 100) / 100,
          totalTaxesPaid: Math.round(totalTaxesPaid * 100) / 100,
          totalNetProceeds: Math.round(totalNetProceeds * 100) / 100,
          effectiveTaxRate: totalSaleValue > 0 ? Math.round((totalTaxesPaid / totalSaleValue) * 10000) / 100 : 0
        },
        unrealized: {
          remainingOriginalValue: Math.round(remainingOriginalValue * 100) / 100,
          remainingCurrentValue: Math.round(remainingCurrentValue * 100) / 100,
          unrealizedGains: Math.round(unrealizedGains * 100) / 100,
          unrealizedGainsPercentage: remainingOriginalValue > 0 ? Math.round((unrealizedGains / remainingOriginalValue) * 10000) / 100 : 0
        },
        overall: {
          totalOriginalValue: grant.totalValue,
          totalCurrentValue: grant.currentValue,
          totalGainLoss: grant.gainLoss,
          gainLossPercentage: grant.gainLossPercentage
        }
      };
    } catch (error) {
      throw new Error(`Failed to get grant performance: ${error.message}`);
    }
  }

  /**
   * Validate grant data
   * @param {Object} grantData - Grant data to validate
   * @returns {Object} Validation result
   */
  validateGrantData(grantData) {
    const errors = [];

    if (!grantData.stockSymbol || typeof grantData.stockSymbol !== 'string') {
      errors.push('Stock symbol is required');
    }

    // Company name is now optional
    if (grantData.company && typeof grantData.company !== 'string') {
      errors.push('Company name must be a string if provided');
    }

    if (!grantData.grantDate) {
      errors.push('Grant date is required');
    } else {
      const grantDate = new Date(grantData.grantDate);
      if (isNaN(grantDate.getTime())) {
        errors.push('Invalid grant date');
      }
    }

    if (!grantData.totalValue || grantData.totalValue <= 0) {
      errors.push('Total value must be greater than 0');
    }

    if (!grantData.totalShares || grantData.totalShares <= 0) {
      errors.push('Total shares must be greater than 0');
    }

    if (grantData.totalShares && !Number.isInteger(grantData.totalShares)) {
      errors.push('Total shares must be a whole number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get upcoming vesting events for dashboard
   * @param {string} userId - User ID
   * @param {number} days - Days to look ahead (default: 30)
   * @returns {Array} Upcoming vesting events
   */
  async getUpcomingVesting(userId, days = 30) {
    try {
      return await vestingService.getUpcomingVestings(userId, days);
    } catch (error) {
      throw new Error(`Failed to get upcoming vesting: ${error.message}`);
    }
  }

  /**
   * Process vesting events for a specific date
   * @param {Date} date - Date to process (default: today)
   * @returns {Object} Processing summary
   */
  async processVestingEvents(date = new Date()) {
    try {
      return await vestingService.processVestingEvents(date);
    } catch (error) {
      throw new Error(`Failed to process vesting events: ${error.message}`);
    }
  }

  /**
   * Get tax preview for a potential sale
   * @param {string} userId - User ID
   * @param {string} grantId - Grant ID
   * @param {number} sharesAmount - Shares to sell
   * @param {number} salePrice - Sale price per share
   * @returns {Object} Tax calculation preview
   */
  async getTaxPreview(userId, grantId, sharesAmount, salePrice) {
    try {
      return await taxCalculationService.previewTaxCalculation(grantId, sharesAmount, salePrice);
    } catch (error) {
      throw new Error(`Failed to get tax preview: ${error.message}`);
    }
  }

  /**
   * Get tax projections for a year
   * @param {string} userId - User ID
   * @param {number} year - Year for projections
   * @returns {Object} Tax projections
   */
  async getTaxProjections(userId, year) {
    try {
      return await taxCalculationService.getTaxProjections(userId, year);
    } catch (error) {
      throw new Error(`Failed to get tax projections: ${error.message}`);
    }
  }
}

module.exports = new RSUService();
