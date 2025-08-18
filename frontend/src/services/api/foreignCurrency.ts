import api from './base';
import {
  ForeignCurrencyAccount,
  ForeignCurrencyAccountSummary,
  CurrencySummary,
  CurrencyExchange,
  CurrencyConversion,
  Transaction,
  ForeignCurrencyAccountFilters,
  ForeignCurrencyTransactionFilters,
  ExchangeRateFilters,
  CurrencyConversionFilters,
  UpdateBalanceRequest,
  UpdateExchangeRateRequest
} from '../../types/foreignCurrency';

export const foreignCurrencyApi = {
  // Get all foreign currency accounts for the user
  getAccounts: async (filters?: ForeignCurrencyAccountFilters): Promise<ForeignCurrencyAccountSummary[]> => {
    const params = new URLSearchParams();
    if (filters?.currency) params.append('currency', filters.currency);
    if (filters?.bankAccountId) params.append('bankAccountId', filters.bankAccountId);
    
    const response = await api.get<{ success: boolean; data: ForeignCurrencyAccountSummary[]; total: number }>(
      `/foreign-currency/accounts?${params.toString()}`
    );
    return response.data.data;
  },

  // Get specific foreign currency account details
  getAccount: async (accountId: string): Promise<ForeignCurrencyAccount> => {
    const encodedAccountId = encodeURIComponent(accountId);
    const response = await api.get<{ success: boolean; data: ForeignCurrencyAccount }>(
      `/foreign-currency/accounts/${encodedAccountId}`
    );
    return response.data.data;
  },

  // Get transactions for a specific foreign currency account
  getAccountTransactions: async (
    accountId: string, 
    filters?: ForeignCurrencyTransactionFilters
  ): Promise<{
    transactions: Transaction[];
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
  }> => {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const encodedAccountId = encodeURIComponent(accountId);
    const response = await api.get<{
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
    }>(`/foreign-currency/accounts/${encodedAccountId}/transactions?${params.toString()}`);
    
    return {
      transactions: response.data.data,
      pagination: response.data.pagination,
      account: response.data.account
    };
  },

  // Update foreign currency account balance
  updateAccountBalance: async (
    accountId: string, 
    request: UpdateBalanceRequest
  ): Promise<{ account: ForeignCurrencyAccountSummary; message: string }> => {
    const encodedAccountId = encodeURIComponent(accountId);
    const response = await api.put<{
      success: boolean;
      data: ForeignCurrencyAccountSummary;
      message: string;
    }>(`/foreign-currency/accounts/${encodedAccountId}/balance`, request);
    
    return {
      account: response.data.data,
      message: response.data.message
    };
  },

  // Get currency summary for all user foreign currency accounts
  getCurrencySummary: async (): Promise<CurrencySummary[]> => {
    const response = await api.get<{
      success: boolean;
      data: CurrencySummary[];
      totalCurrencies: number;
    }>('/foreign-currency/summary');
    
    return response.data.data;
  },

  // Get latest exchange rates
  getExchangeRates: async (filters?: ExchangeRateFilters): Promise<{
    rates: CurrencyExchange[];
    baseCurrency: string;
    total: number;
  }> => {
    const params = new URLSearchParams();
    if (filters?.baseCurrency) params.append('baseCurrency', filters.baseCurrency);

    const response = await api.get<{
      success: boolean;
      data: CurrencyExchange[];
      baseCurrency: string;
      total: number;
    }>(`/foreign-currency/exchange-rates?${params.toString()}`);
    
    return {
      rates: response.data.data,
      baseCurrency: response.data.baseCurrency,
      total: response.data.total
    };
  },

  // Update exchange rate manually
  updateExchangeRate: async (request: UpdateExchangeRateRequest): Promise<{
    exchangeRate: CurrencyExchange;
    message: string;
  }> => {
    const response = await api.post<{
      success: boolean;
      data: CurrencyExchange;
      message: string;
    }>('/foreign-currency/exchange-rates', request);
    
    return {
      exchangeRate: response.data.data,
      message: response.data.message
    };
  },

  // Convert amount between currencies
  convertCurrency: async (filters: CurrencyConversionFilters): Promise<CurrencyConversion> => {
    const params = new URLSearchParams();
    params.append('amount', filters.amount.toString());
    params.append('fromCurrency', filters.fromCurrency);
    params.append('toCurrency', filters.toCurrency);
    if (filters.date) params.append('date', filters.date);

    const response = await api.get<{
      success: boolean;
      data: CurrencyConversion;
    }>(`/foreign-currency/convert?${params.toString()}`);
    
    return response.data.data;
  },

  // Helper methods for specific use cases

  // Get foreign currency accounts by bank account
  getAccountsByBankAccount: async (bankAccountId: string): Promise<ForeignCurrencyAccountSummary[]> => {
    return await foreignCurrencyApi.getAccounts({ bankAccountId });
  },

  // Get foreign currency accounts by currency
  getAccountsByCurrency: async (currency: string): Promise<ForeignCurrencyAccountSummary[]> => {
    return await foreignCurrencyApi.getAccounts({ currency });
  },

  // Get all transactions for an account (handles pagination automatically)
  getAllTransactions: async (
    accountId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Transaction[]> => {
    const allTransactions: Transaction[] = [];
    let offset = 0;
    const limit = 100; // Larger batches for bulk loading
    let hasMore = true;

    while (hasMore) {
      const result = await foreignCurrencyApi.getAccountTransactions(accountId, {
        limit,
        offset,
        startDate,
        endDate
      });

      allTransactions.push(...result.transactions);
      hasMore = result.pagination.hasMore;
      offset += limit;

      // Safety break to prevent infinite loops
      if (offset > 10000) {
        console.warn('Foreign currency transaction loading stopped at 10,000 transactions to prevent infinite loop');
        break;
      }
    }

    return allTransactions;
  },

  // Get account statistics
  getAccountStatistics: async (accountId: string): Promise<{
    totalTransactions: number;
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    averageTransactionAmount: number;
    currency: string;
    dateRange: {
      earliest: Date | null;
      latest: Date | null;
    };
  }> => {
    const transactions = await foreignCurrencyApi.getAllTransactions(accountId);
    
    if (transactions.length === 0) {
      return {
        totalTransactions: 0,
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        averageTransactionAmount: 0,
        currency: 'USD', // Default, will be overwritten
        dateRange: { earliest: null, latest: null }
      };
    }

    const currency = transactions[0].currency;
    const income = transactions.filter(t => t.amount > 0);
    const expenses = transactions.filter(t => t.amount < 0);

    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
    const netBalance = totalIncome - totalExpenses;
    const averageTransactionAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length;

    // Calculate date range
    const dates = transactions.map(t => new Date(t.date));
    const earliest = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const latest = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

    return {
      totalTransactions: transactions.length,
      totalIncome,
      totalExpenses,
      netBalance,
      averageTransactionAmount,
      currency,
      dateRange: { earliest, latest }
    };
  },

  // Batch conversion of multiple amounts
  convertMultipleAmounts: async (conversions: {
    amount: number;
    fromCurrency: string;
    toCurrency: string;
    date?: string;
  }[]): Promise<CurrencyConversion[]> => {
    const results = await Promise.all(
      conversions.map(conversion => foreignCurrencyApi.convertCurrency(conversion))
    );
    
    return results;
  },

  // Get multiple currency balances
  getMultipleCurrencyBalances: async (currencies: string[]): Promise<{
    [currency: string]: {
      totalBalance: number;
      totalBalanceILS: number;
      accountCount: number;
    };
  }> => {
    const summary = await foreignCurrencyApi.getCurrencySummary();
    const result: { [currency: string]: { totalBalance: number; totalBalanceILS: number; accountCount: number } } = {};

    currencies.forEach(currency => {
      const currencyData = summary.find(item => item.currency === currency);
      result[currency] = {
        totalBalance: currencyData?.totalBalance || 0,
        totalBalanceILS: currencyData?.totalBalanceILS || 0,
        accountCount: currencyData?.accountCount || 0
      };
    });

    return result;
  }
};
