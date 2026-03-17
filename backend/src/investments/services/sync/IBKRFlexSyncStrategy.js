const logger = require('../../../shared/utils/logger');
const BaseSyncStrategy = require('../../../banking/services/sync-strategies/BaseSyncStrategy');
const IBKRFlexClient = require('../../../banking/services/ibkrFlexClient');
const portfolioService = require('../portfolioService');
const investmentService = require('../investmentService');

/**
 * Sync strategy for Interactive Brokers using the Flex Web Service.
 * Fetches positions, trades, dividends, and cash movements via Flex Query reports.
 */
class IBKRFlexSyncStrategy extends BaseSyncStrategy {
  constructor() {
    super({
      name: 'ibkr-flex',
      displayName: 'Interactive Brokers Flex',
      icon: '📊',
      statusUpdates: {
        start: { progress: 20, message: 'Fetching IBKR Flex report...' },
        error: (error) => ({ progress: 0, message: `IBKR sync failed: ${error}` })
      }
    });
  }

  getEmptyResult() {
    return {
      portfolios: { newPortfolios: 0, updatedPortfolios: 0, errors: [] },
      transactions: { newTransactions: 0, errors: [] }
    };
  }

  async executeSync(bankAccount, options, context) {
    try {
      logger.info(`${this.icon} Starting IBKR Flex sync for ${bankAccount._id}`);

      if (this.statusUpdates.start) {
        await this.updateStatus(bankAccount._id, {
          status: 'scraping',
          ...this.statusUpdates.start
        });
      }

      const client = new IBKRFlexClient(
        bankAccount.credentials.flexToken,
        bankAccount.credentials.queryId
      );

      const report = await client.fetchReport();
      logger.info(`IBKR Flex report fetched: ${report.openPositions.length} positions, ${report.trades.length} trades, ${report.cashTransactions.length} cash transactions, ${report.cashReport.length} cash report rows, equitySummary: ${!!report.equitySummary}`);

      // Process positions into portfolios
      const portfolioData = this.mapPositionsToPortfolio(report, bankAccount);
      const portfolioResults = await portfolioService.processScrapedPortfolios(
        portfolioData,
        bankAccount
      );

      // Process trades and cash transactions as regular transactions
      const transactionResults = await this.processTransactions(report, bankAccount);

      logger.info(`✅ IBKR Flex sync completed for ${bankAccount._id}`);
      return {
        portfolios: portfolioResults,
        transactions: transactionResults,
        metadata: {
          scrapingTimestamp: new Date().toISOString(),
          accountType: 'ibkr',
          positionCount: report.openPositions.length,
          tradeCount: report.trades.length,
          cashTransactionCount: report.cashTransactions.length
        }
      };

    } catch (error) {
      logger.error(`❌ IBKR Flex sync failed for ${bankAccount._id}: ${error.message}`);

      if (this.statusUpdates.error) {
        await this.updateStatus(bankAccount._id, {
          status: 'error',
          ...this.statusUpdates.error(error.message),
          isActive: false
        });
      }

      throw error;
    }
  }

  /**
   * Map IBKR open positions to the portfolio format expected by portfolioService
   */
  mapPositionsToPortfolio(report, bankAccount) {
    const accountId = report.accountInfo?.accountId || bankAccount.name;
    const currency = report.accountInfo?.currency || bankAccount.defaultCurrency || 'USD';

    // Group positions by asset class for a single portfolio
    const investments = report.openPositions.map(pos => {
      const symbol = pos.symbol || pos.description;
      const quantity = parseFloat(pos.position || pos.quantity || 0);
      const mktValue = parseFloat(pos.positionValue || pos.marketValue || 0);

      return {
        paperId: symbol,
        symbol,
        name: pos.description || pos.symbol,
        paperName: pos.description || pos.symbol,
        amount: quantity,
        quantity,
        value: mktValue,
        currentPrice: parseFloat(pos.markPrice || pos.closePrice || 0),
        marketValue: mktValue,
        costBasis: parseFloat(pos.costBasisMoney || 0),
        holdingType: this.mapAssetClass(pos.assetCategory || pos.assetClass),
        currency: pos.currency || currency,
        isin: pos.isin || null,
        exchange: pos.listingExchange || null
      };
    });

    const totalValue = investments.reduce((sum, inv) => sum + inv.marketValue, 0);

    // Extract cash balance from equity summary or cash report
    let cashBalance = 0;
    if (report.equitySummary) {
      const es = report.equitySummary;
      cashBalance = parseFloat(es.cash || es.cashValue || es.totalCash || es.totalCashValue || 0);
    } else if (report.cashReport && report.cashReport.length > 0) {
      // Cash report has per-currency rows; sum endingCash (or endingSettledCash) for the base currency
      for (const row of report.cashReport) {
        const amount = parseFloat(row.endingCash || row.endingSettledCash || row.clientFees || 0);
        if (amount && (row.currency === currency || row.currency === 'BASE_SUMMARY')) {
          cashBalance = amount;
          break;
        }
      }
    }
    logger.info(`IBKR cash balance: ${cashBalance}`);

    return [{
      portfolioId: accountId,
      portfolioName: `IBKR - ${accountId}`,
      accountNumber: accountId,
      type: 'investment',
      totalValue: totalValue + cashBalance,
      cashBalance,
      currency,
      investments,
      rawData: { accountInfo: report.accountInfo, equitySummary: report.equitySummary }
    }];
  }

  /**
   * Process trades and cash transactions as investment transactions
   */
  async processTransactions(report, bankAccount) {
    const investmentTxns = [];

    // Map trades to investment transaction format
    for (const trade of report.trades) {
      const symbol = trade.symbol || trade.description;
      const quantity = parseFloat(trade.quantity || 0);
      const price = parseFloat(trade.tradePrice || trade.price || 0);
      const value = parseFloat(trade.netCash || trade.proceeds || 0);

      investmentTxns.push({
        paperId: symbol,
        paperName: trade.description || symbol,
        symbol,
        amount: quantity,
        value,
        currency: trade.currency || bankAccount.defaultCurrency || 'USD',
        executionDate: new Date(this.parseDate(trade.tradeDate || trade.dateTime)),
        executablePrice: price,
        rawData: trade
      });
    }

    // Map cash transactions (dividends, interest, fees)
    for (const ct of report.cashTransactions) {
      const symbol = ct.symbol || 'CASH';
      const amount = parseFloat(ct.amount || 0);

      investmentTxns.push({
        paperId: symbol,
        paperName: this.buildCashDescription(ct),
        symbol,
        amount: 0,
        value: amount,
        currency: ct.currency || bankAccount.defaultCurrency || 'USD',
        executionDate: new Date(this.parseDate(ct.reportDate || ct.dateTime)),
        executablePrice: 0,
        rawData: ct
      });
    }

    return investmentService.processPortfolioTransactions(investmentTxns, bankAccount);
  }

  buildCashDescription(ct) {
    const type = (ct.type || '').toUpperCase();
    const symbol = ct.symbol || '';

    if (type.includes('DIVIDEND')) return `Dividend: ${symbol}`;
    if (type.includes('WITHHOLDING')) return `Tax Withholding: ${symbol}`;
    if (type.includes('INTEREST')) return `Interest: ${symbol || 'Account'}`;
    if (type.includes('COMMISSION')) return `Commission: ${symbol}`;
    if (type.includes('FEE')) return `Fee: ${ct.description || symbol}`;
    if (type.includes('DEPOSIT')) return `Deposit`;
    if (type.includes('WITHDRAWAL')) return `Withdrawal`;
    return ct.description || `${type}: ${symbol}`.trim();
  }

  mapAssetClass(assetCategory) {
    if (!assetCategory) return 'stock';
    const cat = assetCategory.toUpperCase();
    if (cat.includes('STK') || cat.includes('STOCK')) return 'stock';
    if (cat.includes('OPT') || cat.includes('OPTION')) return 'option';
    if (cat.includes('FUT') || cat.includes('FUTURE')) return 'future';
    if (cat.includes('BOND') || cat.includes('BILL')) return 'bond';
    if (cat.includes('FUND') || cat.includes('MF')) return 'mutual_fund';
    if (cat.includes('WAR')) return 'stock';
    return 'stock';
  }

  parseDate(dateStr) {
    if (!dateStr) return new Date().toISOString();
    // IBKR dates can be YYYYMMDD, YYYY-MM-DD, or full datetime strings
    if (/^\d{8}$/.test(dateStr)) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    return dateStr;
  }
}

module.exports = IBKRFlexSyncStrategy;
