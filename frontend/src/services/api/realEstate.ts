import api from './base';

export interface RealEstateInvestment {
  _id: string;
  userId: string;
  name: string;
  type: 'flip' | 'rental';
  status: 'active' | 'completed' | 'sold' | 'cancelled';
  address?: string;
  description?: string;
  totalInvestment: number;
  estimatedCurrentValue: number;
  currency: string;
  fundingSources: FundingSource[];
  categoryBudgets: CategoryBudget[];
  commitments: Commitment[];
  salePrice?: number;
  saleDate?: string;
  saleExpenses?: number;
  monthlyRent?: number;
  estimatedMonthlyRental?: number;
  mortgagePercentage?: number;
  mortgageInterestRate?: number;
  mortgageTermYears?: number;
  tenantName?: string;
  leaseStart?: string;
  leaseEnd?: string;
  rentalIncome: RentalIncome[];
  linkedBankAccountId?: any;
  investmentTag?: any;
  notes?: string;
  // Virtuals
  totalCommitted?: number;
  totalPaidCommitments?: number;
  flipGain?: number | null;
  totalRentalIncome?: number;
  estimatedMonthlyMortgage?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FundingSource {
  _id?: string;
  type: 'loan' | 'savings' | 'partner' | 'mortgage' | 'other';
  description: string;
  expectedAmount: number;
  availableAmount: number;
  currency: string;
}

export interface CategoryBudget {
  _id?: string;
  categoryId: any;
  subCategoryId: any;
  budgetedAmount: number;
  allocatedTransactions: string[];
  currency: string;
  description?: string;
}

export interface Commitment {
  _id: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: string;
  notes?: string;
}

export interface RentalIncome {
  _id: string;
  month: string;
  expectedAmount: number;
  actualAmount?: number;
  received: boolean;
  notes?: string;
}

export interface RealEstateSummary {
  totalInvestments: number;
  activeFlips: number;
  activeRentals: number;
  totalInvested: number;
  totalEstimatedValue: number;
  totalCommitments: number;
  totalRentalIncome: number;
  totalFlipGains: number;
  currency: string;
}

class RealEstateApiService {
  private baseUrl = '/real-estate';

  async getAll(filters?: { type?: string; status?: string }): Promise<RealEstateInvestment[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async getById(id: string): Promise<RealEstateInvestment> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async create(data: Partial<RealEstateInvestment>): Promise<RealEstateInvestment> {
    const response = await api.post(this.baseUrl, data);
    return response.data;
  }

  async update(id: string, data: Partial<RealEstateInvestment>): Promise<RealEstateInvestment> {
    const response = await api.put(`${this.baseUrl}/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  async getSummary(): Promise<RealEstateSummary> {
    const response = await api.get(`${this.baseUrl}/summary`);
    return response.data;
  }

  // Commitments
  async addCommitment(investmentId: string, data: Partial<Commitment>): Promise<RealEstateInvestment> {
    const response = await api.post(`${this.baseUrl}/${investmentId}/commitments`, data);
    return response.data;
  }

  async updateCommitment(investmentId: string, commitmentId: string, data: Partial<Commitment>): Promise<RealEstateInvestment> {
    const response = await api.put(`${this.baseUrl}/${investmentId}/commitments/${commitmentId}`, data);
    return response.data;
  }

  async deleteCommitment(investmentId: string, commitmentId: string): Promise<RealEstateInvestment> {
    const response = await api.delete(`${this.baseUrl}/${investmentId}/commitments/${commitmentId}`);
    return response.data;
  }

  // Rental Income
  async addRentalIncome(investmentId: string, data: Partial<RentalIncome>): Promise<RealEstateInvestment> {
    const response = await api.post(`${this.baseUrl}/${investmentId}/rental-income`, data);
    return response.data;
  }

  async updateRentalIncome(investmentId: string, incomeId: string, data: Partial<RentalIncome>): Promise<RealEstateInvestment> {
    const response = await api.put(`${this.baseUrl}/${investmentId}/rental-income/${incomeId}`, data);
    return response.data;
  }

  // Sale
  async markSold(investmentId: string, data: { salePrice: number; saleDate?: string; saleExpenses?: number }): Promise<RealEstateInvestment> {
    const response = await api.post(`${this.baseUrl}/${investmentId}/sell`, data);
    return response.data;
  }

  // Transactions
  async getTransactions(investmentId: string): Promise<any[]> {
    const response = await api.get(`${this.baseUrl}/${investmentId}/transactions`);
    return response.data;
  }

  async tagTransaction(investmentId: string, transactionId: string): Promise<any> {
    const response = await api.post(`${this.baseUrl}/${investmentId}/transactions/${transactionId}/tag`);
    return response.data;
  }

  async untagTransaction(investmentId: string, transactionId: string): Promise<any> {
    const response = await api.delete(`${this.baseUrl}/${investmentId}/transactions/${transactionId}/tag`);
    return response.data;
  }

  async bulkTagTransactions(investmentId: string, transactionIds: string[]): Promise<{ tagged: number; errors: any[] }> {
    const response = await api.post(`${this.baseUrl}/${investmentId}/transactions/bulk-tag`, { transactionIds });
    return response.data;
  }

  // Bank account linking
  async linkBankAccount(investmentId: string, bankAccountId: string): Promise<{ investment: RealEstateInvestment; autoTagged: number }> {
    const response = await api.post(`${this.baseUrl}/${investmentId}/link-account`, { bankAccountId });
    return response.data;
  }

  async unlinkBankAccount(investmentId: string): Promise<RealEstateInvestment> {
    const response = await api.delete(`${this.baseUrl}/${investmentId}/link-account`);
    return response.data;
  }
}

export const realEstateApi = new RealEstateApiService();
