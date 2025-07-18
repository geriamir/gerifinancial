import { AxiosResponse } from 'axios';
import api from './base';

export interface MonthlyBudget {
  _id: string;
  userId: string;
  year: number;
  month: number;
  currency: string;
  salaryBudget: number;
  otherIncomeBudgets: Array<{
    categoryId: string;
    amount: number;
  }>;
  expenseBudgets: Array<{
    categoryId: string;
    subCategoryId: string;
    budgetedAmount: number;
    actualAmount: number;
  }>;
  isAutoCalculated: boolean;
  lastCalculated?: string;
  notes?: string;
  status: 'draft' | 'active' | 'completed';
  totalBudgetedIncome: number;
  totalBudgetedExpenses: number;
  totalActualIncome: number;
  totalActualExpenses: number;
  budgetBalance: number;
  actualBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBudget {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'completed' | 'on-hold';
  fundingSources: Array<{
    sourceType: 'salary' | 'bonus' | 'loan' | 'savings' | 'other';
    categoryId?: string;
    amount: number;
    description?: string;
    isReceived: boolean;
  }>;
  categoryBudgets: Array<{
    categoryId: string;
    subCategoryId: string;
    budgetedAmount: number;
    actualAmount: number;
  }>;
  projectTag?: string;
  currency: string;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  totalBudget: number;
  totalReceived: number;
  totalSpent: number;
  remainingBudget: number;
  progressPercentage: number;
  daysRemaining: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSummary {
  monthly: {
    totalBudgetedIncome: number;
    totalBudgetedExpenses: number;
    totalActualExpenses: number;
    budgetBalance: number;
    actualBalance: number;
  } | null;
  yearly: any; // TODO: Define yearly budget type
  activeProjects: Array<{
    id: string;
    name: string;
    progress: number;
    remainingBudget: number;
    daysRemaining: number;
  }>;
}

export interface CreateMonthlyBudgetData {
  year: number;
  month: number;
  currency?: string;
  salaryBudget?: number;
  otherIncomeBudgets?: Array<{
    categoryId: string;
    amount: number;
  }>;
  expenseBudgets?: Array<{
    categoryId: string;
    subCategoryId: string;
    budgetedAmount: number;
  }>;
  notes?: string;
  status?: 'draft' | 'active' | 'completed';
}

export interface CreateProjectBudgetData {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  fundingSources: Array<{
    sourceType: 'salary' | 'bonus' | 'loan' | 'savings' | 'other';
    categoryId?: string;
    amount: number;
    description?: string;
    isReceived?: boolean;
  }>;
  categoryBudgets?: Array<{
    categoryId: string;
    subCategoryId: string;
    budgetedAmount: number;
  }>;
  currency?: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
}

export const budgetsApi = {
  // Monthly Budget API calls
  getMonthlyBudget: (year: number, month: number): Promise<MonthlyBudget> =>
    api.get<MonthlyBudget>(`/budgets/monthly/${year}/${month}`)
      .then((res: AxiosResponse<MonthlyBudget>) => res.data),

  createMonthlyBudget: (data: CreateMonthlyBudgetData): Promise<MonthlyBudget> =>
    api.post<MonthlyBudget>('/budgets/monthly', data)
      .then((res: AxiosResponse<MonthlyBudget>) => res.data),

  updateMonthlyBudget: (id: string, data: Partial<CreateMonthlyBudgetData>): Promise<MonthlyBudget> =>
    api.put<MonthlyBudget>(`/budgets/monthly/${id}`, data)
      .then((res: AxiosResponse<MonthlyBudget>) => res.data),

  calculateMonthlyBudget: (year: number, month: number, monthsToAnalyze?: number): Promise<MonthlyBudget> =>
    api.post<MonthlyBudget>('/budgets/monthly/calculate', { year, month, monthsToAnalyze })
      .then((res: AxiosResponse<MonthlyBudget>) => res.data),

  getMonthlyBudgetActual: (year: number, month: number) =>
    api.get(`/budgets/monthly/${year}/${month}/actual`)
      .then((res: AxiosResponse) => res.data),

  // Project Budget API calls
  getProjectBudgets: (params?: {
    status?: string;
    year?: number;
    page?: number;
    limit?: number;
  }): Promise<{ projects: ProjectBudget[]; total: number; page: number; totalPages: number }> =>
    api.get('/budgets/projects', { params })
      .then((res: AxiosResponse) => res.data),

  getProjectBudget: (id: string): Promise<ProjectBudget> =>
    api.get<ProjectBudget>(`/budgets/projects/${id}`)
      .then((res: AxiosResponse<ProjectBudget>) => res.data),

  createProjectBudget: (data: CreateProjectBudgetData): Promise<ProjectBudget> =>
    api.post<ProjectBudget>('/budgets/projects', data)
      .then((res: AxiosResponse<ProjectBudget>) => res.data),

  updateProjectBudget: (id: string, data: Partial<CreateProjectBudgetData>): Promise<ProjectBudget> =>
    api.put<ProjectBudget>(`/budgets/projects/${id}`, data)
      .then((res: AxiosResponse<ProjectBudget>) => res.data),

  deleteProjectBudget: (id: string): Promise<void> =>
    api.delete(`/budgets/projects/${id}`)
      .then((res: AxiosResponse<void>) => res.data),

  getProjectProgress: (id: string) =>
    api.get(`/budgets/projects/${id}/progress`)
      .then((res: AxiosResponse) => res.data),

  // Summary and Dashboard API calls
  getBudgetSummary: (year: number, month: number): Promise<BudgetSummary> =>
    api.get<BudgetSummary>('/budgets/summary', { params: { year, month } })
      .then((res: AxiosResponse<BudgetSummary>) => res.data),

  getDashboardOverview: () =>
    api.get('/budgets/dashboard')
      .then((res: AxiosResponse) => res.data),
};
