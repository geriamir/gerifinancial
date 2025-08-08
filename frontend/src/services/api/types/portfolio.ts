export interface PortfolioInvestment {
  symbol: string;
  name?: string;
  quantity: number;
  currentPrice?: number;
  marketValue?: number;
  currency: string;
  sector?: string;
  investmentType: 'stock' | 'bond' | 'etf' | 'mutual_fund' | 'commodity' | 'cash' | 'other';
  paperId?: string;
  isin?: string;
  exchange?: string;
  lastUpdated?: Date;
}

export interface Portfolio {
  _id: string;
  userId: string;
  bankAccountId: string;
  portfolioId: string;
  portfolioName?: string;
  accountNumber?: string;
  portfolioType: 'investment' | 'pension' | 'savings' | 'managed' | 'self_directed' | 'other';
  totalValue: number;
  totalMarketValue: number;
  cashBalance: number;
  currency: string;
  investments: PortfolioInvestment[];
  lastUpdated: Date;
  status: 'active' | 'closed' | 'suspended';
}

export interface PortfolioSnapshot {
  _id: string;
  userId: string;
  portfolioId: string;
  bankAccountId: string;
  date: Date;
  totalValue: number;
  totalMarketValue: number;
  cashBalance: number;
  currency: string;
  investments: Array<{
    symbol: string;
    name?: string;
    quantity: number;
    price?: number;
    marketValue?: number;
    currency: string;
    sector?: string;
    investmentType: string;
  }>;
  dayChange: number;
  dayChangePercent: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalMarketValue: number;
  totalCashBalance: number;
  portfolioCount: number;
  lastUpdated: Date | null;
  topInvestments: Array<{
    symbol: string;
    name?: string;
    totalQuantity: number;
    averagePrice: number;
    totalMarketValue: number;
    investmentType: string;
    sector?: string;
    portfolioCount: number;
  }>;
  totalInvestments: number;
  allocation: Array<{
    investmentType: string;
    totalValue: number;
    count: number;
  }>;
  sectorAllocation: Array<{
    sector: string;
    totalValue: number;
    count: number;
  }>;
}

export interface PortfolioTrend {
  date: Date;
  totalValue: number;
  totalMarketValue: number;
  totalCashBalance: number;
  portfolioCount: number;
  dayChange: number;
  dayChangePercent: number;
}

export interface PortfolioPerformanceMetrics {
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

export interface InvestmentHistory {
  date: Date;
  totalQuantity: number;
  averagePrice: number;
  totalMarketValue: number;
  portfolioCount: number;
}

export interface PortfolioSyncResult {
  newPortfolios: number;
  updatedPortfolios: number;
  errors: Array<{
    portfolioId: string;
    error: string;
  }>;
}

export interface PortfolioFilters {
  bankAccountId?: string;
  portfolioType?: string;
  status?: string;
}

export interface PortfolioContextState {
  portfolios: Portfolio[];
  portfolioSummary: PortfolioSummary | null;
  portfolioTrends: PortfolioTrend[];
  performanceMetrics: PortfolioPerformanceMetrics | null;
  loading: boolean;
  error: string | null;
}
