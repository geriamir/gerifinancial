import api from './base';
import { 
  BankAccount, 
  AddBankAccountDto, 
  UpdateScrapingConfigDto,
  ScrapeOptionsDto,
  SingleAccountScrapeResult,
  BulkScrapeResult 
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
  }
};
