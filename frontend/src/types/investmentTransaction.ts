// Investment Transaction TypeScript Interfaces
// Corresponds to backend InvestmentTransaction model and API responses

export interface InvestmentTransaction {
  _id: string;
  userId: string;
  investmentId: string;
  bankAccountId: string;
  portfolioId?: string;
  
  // Security identification
  paperId: string;
  paperName: string;
  symbol: string;
  
  // Transaction details
  amount: number;
  value: number;
  currency: string;
  taxSum?: number;
  executionDate: string; // ISO date string
  executablePrice?: number;
  
  // Derived fields
  transactionType: TransactionType;
  rawData?: any;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Populated fields (when included)
  investmentId_populated?: {
    _id: string;
    accountName: string;
    accountNumber: string;
  };
  bankAccountId_populated?: {
    _id: string;
    name: string;
    bankId: string;
  };
}

export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'OTHER';

// API Response Types

export interface InvestmentTransactionListResponse {
  transactions: InvestmentTransaction[];
  totalCount: number;
  hasMore: boolean;
}

export interface InvestmentTransactionSummary {
  totalTransactions: number;
  uniqueSymbols: number;
  totalValue: number;
  totalShares: number;
  buyTransactions: number;
  sellTransactions: number;
  dividendTransactions: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  currencies: string[];
  topSymbols: Array<{
    symbol: string;
    transactionCount: number;
    totalValue: number;
  }>;
}

export interface InvestmentTransactionSummaryResponse {
  summary: InvestmentTransactionSummary;
}

export interface CostBasisInfo {
  symbol: string;
  totalShares: number;
  avgCostPerShare: number;
  totalCostBasis: number;
  totalInvested: number;
  realizedGains: number;
  unrealizedGains?: number;
  currentValue?: number;
  transactions: Array<{
    date: string;
    type: TransactionType;
    shares: number;
    price: number;
    value: number;
    runningShares: number;
    runningCostBasis: number;
  }>;
}

export interface CostBasisResponse {
  costBasis: CostBasisInfo;
}

export interface InvestmentPerformanceMetrics {
  totalInvested: number;
  totalShares: number;
  avgCostPerShare: number;
  realizedGains: number;
  totalDividends: number;
  transactionCount: number;
  firstTransactionDate: string;
  lastTransactionDate: string;
  // Optional current market data
  currentPrice?: number;
  currentValue?: number;
  unrealizedGains?: number;
  totalReturn?: number;
  totalReturnPercent?: number;
}

export interface InvestmentPerformanceResponse {
  performance: InvestmentPerformanceMetrics | null;
}

// Filter and Query Types

export interface InvestmentTransactionFilters {
  investmentId?: string;
  symbol?: string;
  transactionType?: TransactionType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface SymbolTransactionFilters {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface TransactionSummaryFilters {
  startDate?: string;
  endDate?: string;
}

// Component Props Types

export interface InvestmentTransactionListProps {
  investmentId?: string;
  filters?: InvestmentTransactionFilters;
  showInvestmentColumn?: boolean;
  showActions?: boolean;
  maxHeight?: string;
}

export interface TransactionFiltersProps {
  filters: InvestmentTransactionFilters;
  onFiltersChange: (filters: InvestmentTransactionFilters) => void;
  availableSymbols?: string[];
  availableInvestments?: Array<{
    _id: string;
    accountName: string;
    accountNumber: string;
  }>;
}

export interface TransactionAnalyticsProps {
  transactions: InvestmentTransaction[];
  loading?: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

// Utility Types

export interface TransactionsBySymbol {
  [symbol: string]: InvestmentTransaction[];
}

export interface TransactionsByDate {
  [date: string]: InvestmentTransaction[];
}

export interface TransactionStatsCard {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'success' | 'error' | 'warning' | 'info';
}

// Chart Data Types (for analytics components)

export interface TransactionChartDataPoint {
  date: string;
  value: number;
  shares?: number;
  type?: TransactionType;
  symbol?: string;
}

export interface PerformanceChartData {
  dates: string[];
  invested: number[];
  currentValue: number[];
  realizedGains: number[];
  dividends?: number[];
}

export interface SymbolAllocationData {
  symbol: string;
  paperName: string;
  totalValue: number;
  shares: number;
  percentage: number;
  avgPrice: number;
  transactionCount: number;
}

// Error Types

export interface InvestmentTransactionError {
  message: string;
  code?: string;
  details?: any;
}

// Service Types

export interface ResyncHistoryRequest {
  forceResync?: boolean;
}

export interface ResyncHistoryResponse {
  message: string;
  result?: {
    newTransactions: number;
    duplicatesSkipped: number;
    errors: any[];
  };
}

// Hook Return Types

export interface UseInvestmentTransactionsResult {
  transactions: InvestmentTransaction[];
  totalCount: number;
  hasMore: boolean;
  loading: boolean;
  error: InvestmentTransactionError | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  filters: InvestmentTransactionFilters;
  setFilters: (filters: InvestmentTransactionFilters) => void;
}

export interface UseTransactionSummaryResult {
  summary: InvestmentTransactionSummary | null;
  loading: boolean;
  error: InvestmentTransactionError | null;
  refetch: () => Promise<void>;
}

export interface UseCostBasisResult {
  costBasis: CostBasisInfo | null;
  loading: boolean;
  error: InvestmentTransactionError | null;
  refetch: (symbol: string) => Promise<void>;
}

// Constants

export const TRANSACTION_TYPES: TransactionType[] = ['BUY', 'SELL', 'DIVIDEND', 'OTHER'];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  BUY: 'Buy',
  SELL: 'Sell',
  DIVIDEND: 'Dividend',
  OTHER: 'Other'
};

export const TRANSACTION_TYPE_COLORS: Record<TransactionType, string> = {
  BUY: '#4caf50',    // Green
  SELL: '#f44336',   // Red
  DIVIDEND: '#2196f3', // Blue
  OTHER: '#ff9800'   // Orange
};

export const DEFAULT_TRANSACTION_FILTERS: InvestmentTransactionFilters = {
  limit: 50,
  offset: 0
};

export const DATE_RANGE_PRESETS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
  { label: 'All time', days: null }
];
