export interface Holding {
  symbol: string;
  name?: string;
  quantity: number;
  price?: number;
  currentPrice?: number;
  marketValue?: number;
  costBasis?: number;
  currency: string;
  sector?: string;
  holdingType: 'stock' | 'bond' | 'etf' | 'mutual_fund' | 'option' | 'future' | 'other';
  // Option-specific fields
  underlyingSymbol?: string;
  strikePrice?: number;
  expirationDate?: string;
  putCall?: 'CALL' | 'PUT';
  multiplier?: number;
}

export interface HoldingPriceData {
  price: number;
  change: number;
  changePercent: number;
  date: string;
}

export type HoldingsPriceData = Record<string, HoldingPriceData>;

export interface TimelinePricePoint {
  date: string;
  price: number;
  quantity: number;
  holdingValue: number;
}

export interface TimelineEvent {
  date: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'OTHER';
  shares: number;
  pricePerShare: number;
  value: number;
  symbol: string;
}

export interface CoveredCall {
  strikePrice: number;
  expirationDate: string;
  putCall: 'CALL' | 'PUT';
  contracts: number;
  multiplier: number;
  symbol: string;
  sellDate: string | null;
}

export interface HoldingTimeline {
  symbol: string;
  priceHistory: TimelinePricePoint[];
  events: TimelineEvent[];
  coveredCalls: CoveredCall[];
  days: number;
}

export interface Investment {
  _id: string;
  userId: string;
  bankAccountId: string;
  accountNumber: string;
  accountType: 'investment' | 'pension' | 'savings' | 'portfolio' | 'other';
  accountName?: string;
  balance: number;
  currency: string;
  holdings: Holding[];
  totalMarketValue: number;
  cashBalance: number;
  lastUpdated: Date;
  status: 'active' | 'closed' | 'suspended';
  totalValue: number;
}

export interface InvestmentSnapshot {
  _id: string;
  userId: string;
  investmentId: string;
  bankAccountId: string;
  date: Date;
  totalValue: number;
  totalMarketValue: number;
  cashBalance: number;
  balance: number;
  currency: string;
  holdings: Holding[];
  dayChange: number;
  dayChangePercent: number;
}

export interface PortfolioSummary {
  totalBalance: number;
  totalMarketValue: number;
  totalCashBalance: number;
  totalValue: number;
  accountCount: number;
  currency?: string;
  lastUpdated: Date | null;
  topHoldings: Array<{
    symbol: string;
    name?: string;
    totalQuantity: number;
    averagePrice: number;
    totalMarketValue: number;
    holdingType: string;
    sector?: string;
  }>;
  totalHoldings: number;
}

export interface PortfolioTrend {
  date: Date;
  totalValue: number;
  totalMarketValue: number;
  totalCashBalance: number;
  totalBalance: number;
  dayChange: number;
  dayChangePercent: number;
  accountCount: number;
}

export interface PerformanceMetrics {
  totalGain: number;
  totalGainPercent: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  daysTracked: number;
  averageDailyChange: number;
  volatility: number;
  startValue: number;
  endValue: number;
}

export interface HoldingHistory {
  date: Date;
  totalQuantity: number;
  averagePrice: number;
  totalMarketValue: number;
  accountCount: number;
}

export interface SyncResult {
  newInvestments: number;
  updatedInvestments: number;
  errors: Array<{
    accountNumber: string;
    error: string;
  }>;
}

export interface InvestmentFilters {
  bankAccountId?: string;
  accountType?: string;
  status?: string;
}

export interface PortfolioCashBalance {
  cashBalance: number;
  currency: string;
}

export type PortfolioCashBalances = Record<string, PortfolioCashBalance>;

export interface InvestmentContextState {
  investments: Investment[];
  portfolioSummary: PortfolioSummary | null;
  portfolioTrends: PortfolioTrend[];
  performanceMetrics: PerformanceMetrics | null;
  portfolioCashBalances: PortfolioCashBalances;
  holdingsPriceData: HoldingsPriceData;
  loading: boolean;
  error: string | null;
}
