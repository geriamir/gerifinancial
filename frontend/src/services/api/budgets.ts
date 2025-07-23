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

  // Smart budget calculation with pattern awareness
  smartCalculateMonthlyBudget: (year: number, month: number, monthsToAnalyze?: number): Promise<any> =>
    api.post('/budgets/monthly/smart-calculate', { year, month, monthsToAnalyze })
      .then((res: AxiosResponse) => res.data),

  // Reject remaining patterns and proceed with budget calculation
  rejectRemainingPatternsAndProceed: (year: number, month: number, monthsToAnalyze?: number): Promise<any> =>
    api.post('/budgets/patterns/reject-remaining-and-proceed', { year, month, monthsToAnalyze })
      .then((res: AxiosResponse) => res.data),

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

  // Transaction Exclusion API calls
  excludeTransactionFromBudget: (transactionId: string, reason: string): Promise<{
    transactionId: string;
    excluded: boolean;
    reason: string;
    excludedAt: string;
    budgetRecalculation: any;
  }> =>
    api.put(`/budgets/transactions/${transactionId}/exclude`, { reason })
      .then((res: AxiosResponse) => res.data),

  includeTransactionInBudget: (transactionId: string): Promise<{
    transactionId: string;
    excluded: boolean;
    budgetRecalculation: any;
  }> =>
    api.delete(`/budgets/transactions/${transactionId}/exclude`)
      .then((res: AxiosResponse) => res.data),

  toggleTransactionExclusion: (transactionId: string, exclude: boolean, reason?: string): Promise<{
    transactionId: string;
    excluded: boolean;
    reason?: string;
    excludedAt?: string;
  }> =>
    api.post(`/budgets/transactions/${transactionId}/toggle-exclude`, { exclude, reason })
      .then((res: AxiosResponse) => res.data),

  getCategoryExclusions: (categoryId: string, subCategoryId?: string, startDate?: string, endDate?: string): Promise<{
    exclusions: Array<{
      id: string;
      transactionId: string;
      reason: string;
      excludedAt: string;
      transactionAmount: number;
      transactionDate: string;
      transactionDescription: string;
      isActive: boolean;
    }>;
    totalCount: number;
  }> =>
    api.get(`/budgets/category/${categoryId}/subcategory/${subCategoryId || 'null'}/exclusions`, {
      params: { startDate, endDate }
    }).then((res: AxiosResponse) => res.data),

  // Budget Editing API calls
  getBudgetForEditing: (categoryId: string, subCategoryId?: string): Promise<{
    _id: string | null;
    userId: string;
    categoryId: any;
    subCategoryId: any;
    budgetType: 'fixed' | 'variable';
    fixedAmount: number;
    monthlyAmounts: Array<{ month: number; amount: number }>;
    isManuallyEdited: boolean;
    isUniformAcrossMonths: boolean;
    allMonthsData: Array<{ month: number; amount: number }>;
    editHistory: Array<any>;
  }> =>
    api.get(`/budgets/category/${categoryId}/subcategory/${subCategoryId || 'null'}/edit`)
      .then((res: AxiosResponse) => res.data.data),

  updateCategoryBudget: (categoryId: string, subCategoryId: string | null, budgetData: {
    budgetType: 'fixed' | 'variable';
    fixedAmount?: number;
    monthlyAmounts?: Array<{ month: number; amount: number }>;
    reason?: string;
  }): Promise<any> =>
    api.put(`/budgets/category/${categoryId}/subcategory/${subCategoryId || 'null'}`, budgetData)
      .then((res: AxiosResponse) => res.data),

  recalculateBudgetWithExclusions: (categoryId: string, subCategoryId?: string, monthsToAnalyze?: number): Promise<{
    recalculatedAmount: number;
    transactionCount: number;
    averagingPeriod: number;
    excludedTransactions: number;
  }> =>
    api.post(`/budgets/category/${categoryId}/subcategory/${subCategoryId || 'null'}/recalculate`, {
      monthsToAnalyze
    }).then((res: AxiosResponse) => res.data),
};
