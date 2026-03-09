import { AxiosResponse } from 'axios';
import api from './base';
import { ProjectBudget } from '../../types/projects';


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

  // Get pending patterns for current user
  getPendingPatterns: (): Promise<{ success: boolean; data: any[]; count: number }> =>
    api.get('/budgets/patterns/pending')
      .then((res: AxiosResponse) => res.data),

  // Get approved patterns for current user
  getApprovedPatterns: (): Promise<{ success: boolean; data: any[]; count: number }> =>
    api.get('/budgets/patterns/approved')
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

  getProjectBudget: (id: string): Promise<{
    success: boolean;
    data: ProjectBudget;
  }> =>
    api.get(`/budgets/projects/${id}`)
      .then((res: AxiosResponse) => res.data),

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

  // Project Expense Management API calls
  tagTransactionToProject: (projectId: string, transactionId: string): Promise<{
    success: boolean;
    message: string;
    unplannedExpense: any;
  }> =>
    api.post(`/budgets/projects/${projectId}/expenses/tag`, { transactionId })
      .then((res: AxiosResponse) => res.data),

  bulkTagTransactionsToProject: (projectId: string, transactionIds: string[], categorySuggestions?: Record<string, { categoryId: string; subCategoryId: string }>): Promise<{
    success: boolean;
    message: string;
    addedCount: number;
    unplannedExpenses: any[];
  }> =>
    api.post(`/budgets/projects/${projectId}/expenses/bulk-tag`, { transactionIds, categorySuggestions })
      .then((res: AxiosResponse) => res.data),

  removeTransactionFromProject: (projectId: string, transactionId: string): Promise<{
    success: boolean;
    message: string;
  }> =>
    api.delete(`/budgets/projects/${projectId}/expenses/${transactionId}`)
      .then((res: AxiosResponse) => res.data),

  moveExpenseToPlanned: (projectId: string, transactionId: string, categoryId: string, subCategoryId: string, budgetId?: string): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> =>
    api.put(`/budgets/projects/${projectId}/expenses/${transactionId}/move`, {
      categoryId,
      subCategoryId,
      ...(budgetId ? { budgetId } : {})
    }).then((res: AxiosResponse) => res.data),

  unassignExpense: (projectId: string, transactionId: string): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> =>
    api.put(`/budgets/projects/${projectId}/expenses/${transactionId}/unassign`)
      .then((res: AxiosResponse) => res.data),


  bulkMoveExpensesToPlanned: (projectId: string, moves: Array<{
    transactionId: string;
    categoryId: string;
    subCategoryId: string;
  }>): Promise<{
    success: boolean;
    message: string;
    movedCount: number;
    movedExpenses: any[];
  }> =>
    api.post(`/budgets/projects/${projectId}/expenses/bulk-move`, { moves })
      .then((res: AxiosResponse) => res.data),

  getProjectExpenseBreakdown: (projectId: string): Promise<{
    success: boolean;
    data: {
      projectId: string;
      projectName: string;
      currency: string;
      totalBudget: number;
      totalPaid: number;
      totalPlannedPaid: number;
      totalUnplannedPaid: number;
      isOverBudget: boolean;
      progress: number;
      plannedCategories: any[];
      categoryBreakdown: any[];
      plannedExpensesGrouped: any[];
      unplannedExpenses: any[];
      unplannedExpensesCount: number;
    };
  }> =>
    api.get(`/budgets/projects/${projectId}/expenses/breakdown`)
      .then((res: AxiosResponse) => res.data),

  addPlannedExpense: (projectId: string, expenseData: {
    categoryId: string;
    subCategoryId?: string;
    budgetedAmount: number;
    description?: string;
    currency?: string;
  }): Promise<{
    success: boolean;
    data: {
      project: ProjectBudget;
      plannedExpense: any;
    };
    message: string;
  }> =>
    api.post(`/budgets/projects/${projectId}/planned-expenses`, expenseData)
      .then((res: AxiosResponse) => res.data),

  discoverTransactions: (projectId: string, params?: {
    currencies?: string[];
    categoryIds?: string[];
    excludeILS?: boolean;
  }): Promise<{
    success: boolean;
    data: {
      transactions: Array<{
        _id: string;
        description: string;
        amount: number;
        currency: string;
        date: string;
        category?: { _id: string; name: string };
        subCategory?: { _id: string; name: string };
        accountId?: { _id: string; name: string; bankId: string };
        rawData?: { originalCurrency?: string; originalAmount?: number };
      }>;
      categorySuggestions: Record<string, {
        categoryId: string;
        categoryName: string;
        subCategoryId: string;
        subCategoryName: string;
      }>;
      filters: {
        availableCurrencies: Array<{ code: string; symbol: string; label: string }>;
        availableCategories: Array<{ _id: string; name: string }>;
      };
      project: {
        _id: string;
        name: string;
        type: string;
        startDate: string;
        endDate: string;
        currency: string;
      };
    };
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.currencies?.length) queryParams.set('currencies', params.currencies.join(','));
    if (params?.categoryIds?.length) queryParams.set('categoryIds', params.categoryIds.join(','));
    if (params?.excludeILS !== undefined) queryParams.set('excludeILS', String(params.excludeILS));
    const qs = queryParams.toString();
    return api.get(`/budgets/projects/${projectId}/discover-transactions${qs ? `?${qs}` : ''}`)
      .then((res: AxiosResponse) => res.data);
  },
};
