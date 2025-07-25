import api from './base';

// Types for RSU API
export interface RSUGrant {
  _id: string;
  userId: string;
  stockSymbol: string;
  name?: string;
  company?: string;
  grantDate: string;
  totalValue: number;
  totalShares: number;
  pricePerShare: number;
  currentPrice: number;
  currentValue: number;
  vestingSchedule: VestingEvent[];
  status: 'active' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Virtual fields
  vestedShares: number;
  unvestedShares: number;
  vestingProgress: number;
  gainLoss: number;
  gainLossPercentage: number;
}

export interface VestingEvent {
  vestDate: string;
  shares: number;
  vested: boolean;
  vestedValue: number;
}

export interface RSUSale {
  _id: string;
  userId: string;
  grantId: string;
  saleDate: string;
  sharesAmount: number;
  pricePerShare: number;
  totalSaleValue: number;
  taxCalculation: TaxCalculation;
  notes?: string;
  createdAt: string;
  // Virtual fields
  effectiveTaxRate: number;
  profitMargin: number;
}

export interface TaxCalculation {
  originalValue: number;
  profit: number;
  isLongTerm: boolean;
  holdingPeriodDays: number;
  wageIncomeTax: number;
  capitalGainsTax: number;
  totalTax: number;
  netValue: number;
  effectiveTaxRate: number;
  taxBasis: {
    grantValue: number;
    saleValue: number;
    profitAmount: number;
    taxRateApplied: number;
  };
  taxRatesUsed: {
    wageIncome: number;
    capitalGains: number;
    isLongTermRate: boolean;
  };
}

export interface VestedPostTaxSummary {
  totalVestedShares: number;
  totalVestedCurrentValue: number;
  totalVestedPostTaxValue: number;
  estimatedTaxLiability: number;
}

export interface PortfolioSummary {
  grants: {
    totalGrants: number;
    totalShares: number;
    totalOriginalValue: number;
    totalCurrentValue: number;
    totalGainLoss: number;
    gainLossPercentage: number;
  };
  vesting: {
    totalGrants: number;
    totalShares: number;
    totalVestedShares: number;
    totalUnvestedShares: number;
    overallProgress: number;
    totalOriginalValue: number;
    totalCurrentValue: number;
    totalEstimatedVestedValue: number;
    totalGainLoss: number;
    gainLossPercentage: number;
    upcomingEvents: VestingEvent[];
    nextVestingDate: string | null;
    vestedPostTax: VestedPostTaxSummary;
  };
  sales: {
    recentSalesCount: number;
    totalNetProceeds: number;
    lastSaleDate: string | null;
  };
  summary: {
    totalPortfolioValue: number;
    portfolioGainLoss: number;
    nextVestingDate: string | null;
    overallProgress: number;
    vestedLiquidValue: number;
  };
}

export interface PerformanceMetrics {
  timeframe: string;
  period: {
    startDate: string;
    endDate: string;
  };
  performance: {
    totalOriginalValue: number;
    totalCurrentValue: number;
    unrealizedGains: number;
    realizedGains: number;
    totalGains: number;
    taxesPaid: number;
    netGains: number;
    returnPercentage: number;
    salesCount: number;
  };
}

export interface StockPrice {
  _id: string;
  symbol: string;
  price: number;
  lastUpdated: string;
  source: 'yahoo' | 'alphavantage' | 'manual';
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  historicalPrices: Array<{
    date: string;
    price: number;
  }>;
  isActive: boolean;
  metadata: {
    companyName?: string;
    currency: string;
    exchange?: string;
    sector?: string;
  };
}

export interface CreateGrantData {
  stockSymbol: string;
  name?: string; // Free-form name for the grant
  company?: string; // Now optional
  grantDate: string;
  totalValue: number;
  totalShares: number;
  notes?: string;
}

export interface CreateSaleData {
  grantId: string;
  saleDate: string;
  sharesAmount: number;
  pricePerShare: number;
  notes?: string;
}

export interface TaxPreviewRequest {
  grantId: string;
  sharesAmount: number;
  salePrice: number;
  saleDate?: string;
}

export interface UpcomingVestingEvent {
  _id: string;
  stockSymbol: string;
  company: string;
  vestDate: string;
  shares: number;
  currentPrice: number;
  estimatedValue: number;
}

export interface VestingCalendarMonth {
  year: number;
  month: number;
  events: UpcomingVestingEvent[];
  totalShares: number;
  totalEstimatedValue: number;
}

export interface TaxProjections {
  year: number;
  summary: {
    totalSales: number;
    totalSharesSold: number;
    totalSaleValue: number;
    totalOriginalValue: number;
    totalProfit: number;
    totalWageIncomeTax: number;
    totalCapitalGainsTax: number;
    totalTax: number;
    totalNetValue: number;
    longTermSales: number;
    shortTermSales: number;
    effectiveTaxRate: number;
    profitMargin: number;
  } | null;
  monthlyBreakdown: Array<{
    month: number;
    monthlyTax: number;
    monthlyProfit: number;
    monthlySales: number;
  }>;
  projectedQuarterlyPayments: Array<{
    quarter: string;
    dueDate: string;
    amount: number;
  }>;
}

// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  details?: any[];
}

// Grant Management API
export const grantsApi = {
  // Get all grants for the user
  getAll: async (filters?: { status?: string; stockSymbol?: string }): Promise<RSUGrant[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.stockSymbol) params.append('stockSymbol', filters.stockSymbol);
    
    const response = await api.get<ApiResponse<RSUGrant[]>>(`/rsus/grants?${params.toString()}`);
    return response.data.data;
  },

  // Get a specific grant
  getById: async (id: string): Promise<RSUGrant> => {
    const response = await api.get<ApiResponse<RSUGrant>>(`/rsus/grants/${id}`);
    return response.data.data;
  },

  // Create a new grant
  create: async (grantData: CreateGrantData): Promise<RSUGrant> => {
    const response = await api.post<ApiResponse<RSUGrant>>('/rsus/grants', grantData);
    return response.data.data;
  },

  // Update a grant
  update: async (id: string, updates: Partial<CreateGrantData>): Promise<RSUGrant> => {
    const response = await api.put<ApiResponse<RSUGrant>>(`/rsus/grants/${id}`, updates);
    return response.data.data;
  },

  // Delete a grant
  delete: async (id: string): Promise<void> => {
    await api.delete(`/rsus/grants/${id}`);
  },

  // Get grant performance
  getPerformance: async (id: string): Promise<any> => {
    const response = await api.get<ApiResponse<any>>(`/rsus/grants/${id}/performance`);
    return response.data.data;
  }
};

// Sales Management API
export const salesApi = {
  // Get all sales for the user
  getAll: async (filters?: { 
    grantId?: string; 
    startDate?: string; 
    endDate?: string;
  }): Promise<RSUSale[]> => {
    const params = new URLSearchParams();
    if (filters?.grantId) params.append('grantId', filters.grantId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    
    const response = await api.get<ApiResponse<RSUSale[]>>(`/rsus/sales?${params.toString()}`);
    return response.data.data;
  },

  // Get a specific sale
  getById: async (id: string): Promise<RSUSale> => {
    const response = await api.get<ApiResponse<RSUSale>>(`/rsus/sales/${id}`);
    return response.data.data;
  },

  // Record a new sale
  create: async (saleData: CreateSaleData): Promise<RSUSale> => {
    const response = await api.post<ApiResponse<RSUSale>>('/rsus/sales', saleData);
    return response.data.data;
  },

  // Update a sale
  update: async (id: string, updates: Partial<CreateSaleData>): Promise<RSUSale> => {
    const response = await api.put<ApiResponse<RSUSale>>(`/rsus/sales/${id}`, updates);
    return response.data.data;
  },

  // Delete a sale
  delete: async (id: string): Promise<void> => {
    await api.delete(`/rsus/sales/${id}`);
  }
};

// Portfolio & Analytics API
export const portfolioApi = {
  // Get portfolio summary
  getSummary: async (): Promise<PortfolioSummary> => {
    const response = await api.get<ApiResponse<PortfolioSummary>>('/rsus/portfolio');
    return response.data.data;
  },

  // Get portfolio performance
  getPerformance: async (timeframe?: string): Promise<PerformanceMetrics> => {
    const params = timeframe ? `?timeframe=${timeframe}` : '';
    const response = await api.get<ApiResponse<PerformanceMetrics>>(`/rsus/performance${params}`);
    return response.data.data;
  }
};

// Vesting API
export const vestingApi = {
  // Get upcoming vesting events
  getUpcoming: async (days?: number): Promise<UpcomingVestingEvent[]> => {
    const params = days ? `?days=${days}` : '';
    const response = await api.get<ApiResponse<UpcomingVestingEvent[]>>(`/rsus/vesting/upcoming${params}`);
    return response.data.data;
  },

  // Get vesting calendar
  getCalendar: async (months?: number): Promise<VestingCalendarMonth[]> => {
    const params = months ? `?months=${months}` : '';
    const response = await api.get<ApiResponse<VestingCalendarMonth[]>>(`/rsus/vesting/calendar${params}`);
    return response.data.data;
  }
};

// Tax Calculation API
export const taxApi = {
  // Preview tax calculation
  preview: async (request: TaxPreviewRequest): Promise<TaxCalculation & {
    grantInfo: {
      stockSymbol: string;
      company: string;
      grantDate: string;
      totalShares: number;
      availableShares: number;
    };
    saleInfo: {
      sharesAmount: number;
      pricePerShare: number;
      saleDate: string;
      totalSaleValue: number;
    };
  }> => {
    const response = await api.post<ApiResponse<any>>('/rsus/tax/preview', request);
    return response.data.data;
  },

  // Get tax projections
  getProjections: async (year?: number): Promise<TaxProjections> => {
    const params = year ? `?year=${year}` : '';
    const response = await api.get<ApiResponse<TaxProjections>>(`/rsus/tax/projections${params}`);
    return response.data.data;
  },

  // Get annual tax summary
  getSummary: async (year: number): Promise<any> => {
    const response = await api.get<ApiResponse<any>>(`/rsus/tax/summary/${year}`);
    return response.data.data;
  }
};

// Stock Price API
export const stockPriceApi = {
  // Get current stock price
  get: async (symbol: string): Promise<StockPrice> => {
    const response = await api.get<ApiResponse<StockPrice>>(`/rsus/prices/${symbol}`);
    return response.data.data;
  },

  // Update stock price manually
  update: async (symbol: string, price: number, companyName?: string): Promise<StockPrice> => {
    const response = await api.post<ApiResponse<StockPrice>>(`/rsus/prices/${symbol}`, {
      price,
      companyName
    });
    return response.data.data;
  },

  // Get price history
  getHistory: async (symbol: string, days?: number): Promise<{
    symbol: string;
    currentPrice: number;
    history: Array<{ date: string; price: number; }>;
  }> => {
    const params = days ? `?days=${days}` : '';
    const response = await api.get<ApiResponse<any>>(`/rsus/prices/${symbol}/history${params}`);
    return response.data.data;
  }
};

// Combined API object
export const rsuApi = {
  grants: grantsApi,
  sales: salesApi,
  portfolio: portfolioApi,
  vesting: vestingApi,
  tax: taxApi,
  stockPrice: stockPriceApi
};

export default rsuApi;
