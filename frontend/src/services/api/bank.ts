import api from './base';
import { 
  BankAccount, 
  AddBankAccountDto, 
  UpdateScrapingConfigDto,
  ScrapeOptionsDto,
  ScrapeResult 
} from './types';

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

  scrape: async (id: string, options: ScrapeOptionsDto): Promise<void> => {
    await api.post(`/bank-accounts/${id}/scrape`, options);
  },

  scrapeAll: async (): Promise<ScrapeResult> => {
    const response = await api.post<ScrapeResult>('/bank-accounts/scrape-all');
    return response.data;
  }
};
