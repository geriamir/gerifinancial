import api from './base';
import {
  PensionAccount,
  PensionSummary,
  PensionSnapshot,
  PensionSyncResult
} from './types/pension';

export const pensionApi = {
  getSummary: async (): Promise<PensionSummary> => {
    const response = await api.get<PensionSummary>('/pension/summary');
    return response.data;
  },

  getAccounts: async (filters?: { productType?: string; provider?: string }): Promise<PensionAccount[]> => {
    const params = new URLSearchParams();
    if (filters?.productType) params.append('productType', filters.productType);
    if (filters?.provider) params.append('provider', filters.provider);
    const query = params.toString();
    const response = await api.get<PensionAccount[]>(`/pension/accounts${query ? `?${query}` : ''}`);
    return response.data;
  },

  getAccount: async (id: string): Promise<PensionAccount> => {
    const response = await api.get<PensionAccount>(`/pension/accounts/${id}`);
    return response.data;
  },

  getSnapshots: async (accountId: string, days?: number): Promise<PensionSnapshot[]> => {
    const params = days ? `?days=${days}` : '';
    const response = await api.get<PensionSnapshot[]>(`/pension/accounts/${accountId}/snapshots${params}`);
    return response.data;
  },

  getHistory: async (days?: number): Promise<{ date: string; totalBalance: number; accountCount: number }[]> => {
    const params = days ? `?days=${days}` : '';
    const response = await api.get(`/pension/history${params}`);
    return response.data;
  },

  initiateOtp: async (bankAccountId: string, connection: 'sms' | 'email', destination: string): Promise<{ message: string; connection: string }> => {
    const response = await api.post('/pension/sync/initiate', { bankAccountId, connection, destination });
    return response.data;
  },

  verifyAndSync: async (bankAccountId: string, otp: string, connection: 'sms' | 'email', destination: string): Promise<PensionSyncResult> => {
    const response = await api.post<PensionSyncResult>('/pension/sync/verify', {
      bankAccountId, otp, connection, destination
    });
    return response.data;
  }
};
