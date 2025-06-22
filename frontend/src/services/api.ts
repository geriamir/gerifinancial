import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData extends LoginData {
  name: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  token: string;
}

export const authApi = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  }
};

export interface BankAccount {
  _id: string;
  bankId: string;
  name: string;
  status: 'active' | 'error' | 'pending' | 'disabled';
  lastScraped: string | null;
  lastError?: {
    message: string;
    date: string;
  };
  scrapingConfig: {
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      timeOfDay: string;
    };
    options: {
      startDate: string;
      monthsBack: number;
    };
  };
}

export interface AddBankAccountDto {
  bankId: string;
  name: string;
  credentials: {
    username: string;
    password: string;
  };
}

export interface UpdateScrapingConfigDto {
  schedule?: {
    frequency?: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
  };
  options?: {
    startDate?: string;
    monthsBack?: number;
  };
}

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
  }
};

export default api;
