export interface Holding {
  symbol: string;
  name?: string;
  quantity: number;
  price?: number;
  marketValue?: number;
  currency: string;
  sector?: string;
  holdingType: 'stock' | 'bond' | 'etf' | 'mutual_fund' | 'other';
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

export interface InvestmentContextState {
  investments: Investment[];
  portfolioSummary: PortfolioSummary | null;
  portfolioTrends: PortfolioTrend[];
  performanceMetrics: PerformanceMetrics | null;
  loading: boolean;
  error: string | null;
}
