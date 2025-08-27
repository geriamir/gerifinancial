// Foreign Currency Account Types
export interface ForeignCurrencyAccount {
  _id: string;
  userId: string;
  bankAccountId: string;
  originalAccountNumber: string;
  accountNumber: string;
  currency: string;
  accountType: 'checking' | 'savings' | 'credit' | 'investment';
  balance: number;
  balanceILS: number;
  lastExchangeRate: number | null;
  lastExchangeRateDate: string | null;
  status: 'active' | 'inactive' | 'closed';
  transactionCount: number;
  lastTransactionDate: string | null;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  
  // Populated fields
  bankAccountId_populated?: {
    _id: string;
    name: string;
    bankId: string;
  };
}

// Foreign Currency Account Summary
export interface ForeignCurrencyAccountSummary {
  accountNumber: string;
  displayName: string;
  currency: string;
  balance: number;
  balanceILS: number;
  transactionCount: number;
  lastTransactionDate: string | null;
  status: 'active' | 'inactive' | 'closed';
  lastExchangeRate: number | null;
  lastExchangeRateDate: string | null;
}

// Currency Exchange Rate Types
export interface CurrencyExchange {
  _id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: string;
  source: 'bank-of-israel' | 'xe-api' | 'manual' | 'fixer-api' | 'israeli-bank-scrapers';
  metadata?: Record<string, any>;
  pair: string;
  createdAt: string;
  updatedAt: string;
}

// Currency Summary by Currency Type
export interface CurrencySummary {
  currency: string;
  totalBalance: number;
  totalBalanceILS: number;
  accountCount: number;
  totalTransactions: number;
  lastTransactionDate: string | null;
  currentExchangeRate: number | null;
  currentBalanceILS: number | null;
}

// Currency Conversion Types
export interface CurrencyConversion {
  originalAmount: number;
  convertedAmount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  date: string;
}

// API Response Types
export interface ForeignCurrencyAccountsResponse {
  success: boolean;
  data: ForeignCurrencyAccountSummary[];
  total: number;
}

export interface ForeignCurrencyAccountResponse {
  success: boolean;
  data: ForeignCurrencyAccount;
}

export interface ForeignCurrencyTransactionsResponse {
  success: boolean;
  data: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  account: {
    id: string;
    currency: string;
    displayName: string;
  };
}

export interface CurrencySummaryResponse {
  success: boolean;
  data: CurrencySummary[];
  totalCurrencies: number;
}

export interface ExchangeRatesResponse {
  success: boolean;
  data: CurrencyExchange[];
  baseCurrency: string;
  total: number;
}

export interface CurrencyConversionResponse {
  success: boolean;
  data: CurrencyConversion;
}

export interface UpdateBalanceRequest {
  balance: number;
  exchangeRate?: number;
}

export interface UpdateExchangeRateRequest {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date?: string;
}

// Transaction type for foreign currency (extends existing Transaction type)
export interface Transaction {
  _id: string;
  identifier: string;
  userId: string;
  accountId: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  memo?: string;
  type?: 'income' | 'expense';
  category?: {
    _id: string;
    name: string;
  };
  subCategory?: {
    _id: string;
    name: string;
  };
  rawData: {
    originalAmount?: number;
    exchangeRate?: number;
    foreignCurrencyAccount?: boolean;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

// Filter types
export interface ForeignCurrencyAccountFilters {
  currency?: string;
  bankAccountId?: string;
}

export interface ForeignCurrencyTransactionFilters {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface ExchangeRateFilters {
  baseCurrency?: string;
}

export interface CurrencyConversionFilters {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  date?: string;
}

// Constants
export const SUPPORTED_CURRENCIES = [
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' }
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number]['code'];

export const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit' },
  { value: 'investment', label: 'Investment' }
] as const;

export const ACCOUNT_STATUSES = [
  { value: 'active', label: 'Active', color: 'success' },
  { value: 'inactive', label: 'Inactive', color: 'warning' },
  { value: 'closed', label: 'Closed', color: 'error' }
] as const;

export const EXCHANGE_RATE_SOURCES = [
  { value: 'israeli-bank-scrapers', label: 'Bank Data' },
  { value: 'bank-of-israel', label: 'Bank of Israel' },
  { value: 'xe-api', label: 'XE.com' },
  { value: 'fixer-api', label: 'Fixer.io' },
  { value: 'manual', label: 'Manual Entry' }
] as const;

// Currency-to-locale mapping
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  'ILS': 'he-IL',
  'USD': 'en-US',
  'EUR': 'de-DE',
  'GBP': 'en-GB',
  'JPY': 'ja-JP',
  'CHF': 'de-CH',
  'CAD': 'en-CA',
  'AUD': 'en-AU'
};

// Get appropriate locale for currency
export const getLocaleForCurrency = (currency: string): string => {
  return CURRENCY_LOCALE_MAP[currency] || 'en-US';
};

// Currency formatting utilities
export const formatCurrency = (
  amount: number, 
  currency: string, 
  locale?: string
): string => {
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  const effectiveLocale = locale || getLocaleForCurrency(currency);
  
  if (!currencyInfo) {
    return `${amount.toFixed(2)} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(effectiveLocale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    return `${currencyInfo.symbol}${amount.toFixed(2)}`;
  }
};

export const getCurrencySymbol = (currency: string): string => {
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  return currencyInfo?.symbol || currency;
};

export const getCurrencyName = (currency: string): string => {
  const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  return currencyInfo?.name || currency;
};

// Default filters
export const DEFAULT_FOREIGN_CURRENCY_TRANSACTION_FILTERS: ForeignCurrencyTransactionFilters = {
  limit: 25,
  offset: 0
};

export const DEFAULT_EXCHANGE_RATE_FILTERS: ExchangeRateFilters = {
  baseCurrency: 'ILS'
};
