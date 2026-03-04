import api from './base';
import { 
  BankAccount, 
  AddBankAccountDto, 
  UpdateScrapingConfigDto,
  ScrapeOptionsDto,
  SingleAccountScrapeResult,
  BulkScrapeResult,
  BalanceSnapshot,
  BalanceSummaryItem,
  NetWorthHistoryItem
} from './types/bankAccount';

export const bankAccountsApi = {
  getAll: async (): Promise<BankAccount[]> => {
    const response = await api.get('/bank-accounts');
    return response.data;
  },

  add: async (data: AddBankAccountDto): Promise<BankAccount> => {
    const response = await api.post('/bank-accounts', data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<{
      name?: string;
      status?: string;
    }>
  ): Promise<BankAccount> => {
    const response = await api.patch(`/bank-accounts/${id}`, data);
    return response.data;
  },

  updateCredentials: async (
    id: string,
    credentials: {
      username?: string;
      password?: string;
      apiToken?: string;
    }
  ): Promise<{ message: string; account: BankAccount }> => {
    const response = await api.put(`/bank-accounts/${id}/credentials`, credentials);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/bank-accounts/${id}`);
  },

  test: async (id: string): Promise<{ message: string; nextScrapingTime?: string }> => {
    const response = await api.post(`/bank-accounts/${id}/test`);
    return response.data;
  },

  getScrapingConfig: async (id: string): Promise<{ scrapingConfig: BankAccount['scrapingConfig']; nextScrapingTime: string }> => {
    const response = await api.get(`/bank-accounts/${id}/scraping-config`);
    return response.data;
  },

  updateScrapingConfig: async (id: string, config: UpdateScrapingConfigDto): Promise<{ scrapingConfig: BankAccount['scrapingConfig']; nextScrapingTime: string }> => {
    const response = await api.patch(`/bank-accounts/${id}/scraping-config`, config);
    return response.data;
  },

  scrape: async (id: string, options: ScrapeOptionsDto): Promise<SingleAccountScrapeResult> => {
    const response = await api.post<SingleAccountScrapeResult>(`/bank-accounts/${id}/scrape`, options);
    return response.data;
  },

  scrapeAll: async (): Promise<BulkScrapeResult> => {
    const response = await api.post<BulkScrapeResult>('/bank-accounts/scrape-all');
    return response.data;
  },

  recoverTransactions: async (id: string): Promise<{
    message: string;
    previousLastScraped: string | null;
    correctedLastScraped: string;
    latestTransactionDate: string | null;
    totalJobs: number;
  }> => {
    const response = await api.post(`/bank-accounts/${id}/recover-transactions`);
    return response.data;
  },

  // ===== Balance API =====

  getBalanceSummary: async (): Promise<BalanceSummaryItem[]> => {
    const response = await api.get('/bank-accounts/balance/summary');
    return response.data;
  },

  getNetWorthHistory: async (days: number = 30): Promise<NetWorthHistoryItem[]> => {
    const response = await api.get(`/bank-accounts/balance/net-worth?days=${days}`);
    return response.data;
  },

  getBalanceHistory: async (id: string, days: number = 30): Promise<BalanceSnapshot[]> => {
    const response = await api.get(`/bank-accounts/${id}/balance/history?days=${days}`);
    return response.data;
  }
};
