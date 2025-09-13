export interface CreditCard {
  _id: string;
  bankAccountId: string;
  userId: string;
  identifier: string;
  name: string;
  cutoffDay: number;
  gracePeriodDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardWithStats extends CreditCard {
  recentTransactionCount: number;
  totalSpentLast6Months: number;
}

export interface CreditCardDetails extends CreditCard {
  totalTransactions: number;
  totalSpentAllTime: number;
  avgMonthlySpending: number;
  lastTransactionDate?: string;
}

export interface CreditCardBasicStats {
  cardId: string;
  last6MonthsTotal: number;
  avgMonthlySpending: number;
  totalTransactions: number;
  periodStart: string;
  periodEnd: string;
}

export interface CategoryBreakdown {
  _id: string;
  category: string;
  subCategory?: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface CreditCardMonthlyStats {
  cardId: string;
  year: number;
  month: number;
  monthName: string;
  totalAmount: number;
  transactionCount: number;
  categoryBreakdown: CategoryBreakdown[];
}

export interface MonthlyTrendData {
  year: number;
  month: number;
  monthName: string;
  totalAmount: number;
  transactionCount: number;
}

export interface CreditCardTrend {
  cardId: string;
  months: MonthlyTrendData[];
  totalPeriodAmount: number;
  avgMonthlyAmount: number;
}

export interface CreditCardTransactionFilters {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  subCategory?: string;
  minAmount?: number;
  maxAmount?: number;
  description?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreditCardTransactionsResult {
  transactions: any[]; // Using any[] for now, can be replaced with proper Transaction type
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
