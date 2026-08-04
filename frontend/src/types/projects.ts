// frontend/src/types/projects.ts

// Project Types
export type ProjectType = 'vacation' | 'home_renovation' | 'investment';

// Core Project Budget Interface (matches backend model)
export interface ProjectBudget {
  _id: string;
  userId: string;
  name: string;
  type: ProjectType;
  
  // Timeline
  startDate: Date;
  endDate: Date;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  
  // Funding Sources
  fundingSources: FundingSource[];
  
  // Budget Breakdown
  categoryBudgets: CategoryBudget[];
  
  // Category Breakdown with enhanced transaction grouping (replaces both categoryBreakdown and plannedExpensesGrouped)
  categoryBreakdown?: CategoryBreakdownItem[];
  
  // Calculated Totals
  totalBudget: number;
  totalPaid: number;
  totalPlannedPaid?: number;
  totalUnplannedPaid?: number;
  
  // Unplanned Expenses (from backend getProjectOverview)
  unplannedExpenses?: UnplannedExpense[];
  unplannedExpensesCount?: number;
  
  // Settings
  impactsOtherBudgets: boolean;
  projectTag?: string; // ObjectId as string
  currency: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  
  // Virtual Fields (from backend)
  totalFunding: number;
  totalAvailableFunding: number;
  progress: number; // Progress percentage (0-100)
  remainingBudget: number;
  budgetVariance: number;
  daysRemaining: number;
  durationDays: number;
  isOverBudget?: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Funding Source Configuration
export interface FundingSource {
  type: 'ongoing_funds' | 'loan' | 'bonus' | 'savings' | 'other';
  description: string;
  expectedAmount: number;
  availableAmount: number;
  limit?: number;
  currency?: string; // Allow different currency from project
}

// Category Budget Allocation
export interface CategoryBudget {
  categoryId: string;
  subCategoryId: string;
  budgetedAmount: number;
  actualAmount: number;
  description?: string; // User-defined description for this budget item
  currency?: string; // Allow different currency from project
  linkedTransactionIds?: string[]; // For pre-filling from existing transactions
}

// Enhanced Category Breakdown Item (combines budget info with grouped transactions)
export interface CategoryBreakdownItem {
  // Budget Identification
  budgetId: string;
  categoryId: {
    _id: string;
    name: string;
    type: string;
  };
  subCategoryId: {
    _id: string;
    name: string;
  };
  description?: string; // User-defined description for this budget item (planned expense name)
  
  // Budget Amounts
  budgeted: number;
  actual: number;
  currency: string;
  budgetedInProjectCurrency: number;
  actualInProjectCurrency: number;
  variance: number;
  varianceInProjectCurrency: number;
  variancePercentage: number;
  status: 'under' | 'on-target' | 'over' | 'exact';
  
  // Enhanced Transaction Details with Installment Grouping
  expenses: Array<{
    _id: string;
    amount: number;
    amountInProjectCurrency: number;
    currency: string;
    date: string;
    description: string;
    categoryName: string;
    subCategoryName?: string;
    isInstallmentGroup?: boolean;
    installmentCount?: number;
    installmentIdentifier?: string;
    originalAmount?: number;
    originalCurrency?: string;
    exchangeRate?: number;
  }>;
  expenseCount: number;
}

// Smart Recommendation for expense categorization
export interface Recommendation {
  categoryId: string;
  subCategoryId: string;
  categoryName: string;
  subCategoryName: string;
  confidence: number;
  reason: string;
  currentBudgetedAmount: number;
  currentActualAmount: number;
  wouldExceedBudget: boolean;
  newActualAmount: number;
}

// Unplanned Expense (from backend getUnplannedExpenses method)
export interface UnplannedExpense {
  transactionId: string;
  transaction: any; // Full transaction object
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  exchangeRate: number;
  transactionDate: string;
  categoryId: string;
  subCategoryId: string;
  category: { _id: string; name: string };
  subCategory: { _id: string; name: string };
  recommendations?: Recommendation[]; // Smart recommendations for budget allocation
}

// Project Creation Form Data (simplified)
export interface ProjectCreationData {
  name: string;
  type: ProjectType;
  startDate: Date;
  endDate: Date;
  currency: string;
  // The sentence the user typed to draft the project, kept with it. Two projects
  // can spend from the same category, so this is what later lets a transaction
  // be matched to the right one.
  description?: string;
  // Omitted or empty, the backend builds the budget from its own template for
  // the project type - which is what the plain form has always relied on. Only a
  // non-empty list replaces that with an explicit budget, so the dialog can pass
  // its drafted lines here without having to special-case having none.
  categoryBudgets?: DraftedCategoryBudget[];
}

// A budget line the AI drafter proposed, already resolved to categories the user
// owns - the ids are what make it saveable without a second lookup.
export interface DraftedCategoryBudget {
  categoryId: string;
  subCategoryId: string;
  categoryName: string;
  subCategoryName: string;
  budgetedAmount: number;
  currency: string;
  description: string;
}

export interface ProjectDraft {
  name?: string;
  type?: ProjectType;
  startDate?: string;
  endDate?: string;
  currency?: string;
  categoryBudgets: DraftedCategoryBudget[];
  // Things the model suggested that could not be used, so the user can see what
  // was left out rather than wondering why the plan looks thin.
  warnings: string[];
}

// Project Template for budget allocation
export interface ProjectTemplate {
  type: ProjectType;
  label: string;
  description: string;
  defaultCategories: {
    name: string;
    categoryId: string;
    subCategoryId: string;
    isRequired: boolean;
  }[];
}

// Project Filters for List/Search
export interface ProjectFilters {
  status?: 'planning' | 'active' | 'completed' | 'cancelled';
  year?: number;
  startDateRange?: {
    from: Date;
    to: Date;
  };
  budgetRange?: {
    min: number;
    max: number;
  };
  fundingType?: FundingSource['type'];
  limit?: number;
  offset?: number;
}

// Project Progress Analytics
export interface ProjectProgress {
  projectId: string;
  overallProgress: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    subCategoryId: string;
    subCategoryName: string;
    budgeted: number;
    actual: number;
    variance: number;
    variancePercentage: number;
    status: 'under' | 'on-target' | 'over';
  }>;
  fundingStatus: Array<{
    type: FundingSource['type'];
    description: string;
    expected: number;
    available: number;
    utilized: number;
    utilizationPercentage: number;
  }>;
  timeline: {
    startDate: Date;
    endDate: Date;
    daysElapsed: number;
    daysRemaining: number;
    timelineProgress: number;
  };
  predictions: {
    estimatedCompletion: Date;
    budgetOverrun: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface ProjectsListResponse {
  projects: ProjectBudget[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Project Search Suggestion
export interface ProjectSearchSuggestion {
  type: 'project' | 'category' | 'tag';
  value: string;
  label: string;
  count?: number;
}

// Tagged transaction interface
export interface ProjectTransaction {
  _id: string;
  amount: number;
  description: string;
  date: Date;
  categoryId: string;
  categoryName: string;
  subCategoryId: string;
  subCategoryName: string;
  tags: string[];
  projectTags: string[];
  bankAccountName: string;
}

// Project milestone interface (future enhancement)
export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  targetDate: Date;
  completedDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  type: 'funding' | 'budget' | 'deadline' | 'custom';
}

// Project metric interface
export interface ProjectMetric {
  key: string;
  label: string;
  value: number | string;
  format: 'currency' | 'percentage' | 'days' | 'count' | 'text';
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: number;
    period: string;
  };
  color?: 'success' | 'warning' | 'error' | 'info';
}

// Projects overview data
export interface ProjectsOverviewData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
  totalPaid: number;
  totalRemaining: number;
  averageProgress: number;
  projectsOnTrack: number;
  projectsOverBudget: number;
  upcomingDeadlines: number;
}

// Project analytic metric
export interface ProjectAnalyticMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  format: 'currency' | 'percentage' | 'count';
}

// Project analytic chart
export interface ProjectAnalyticChart {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: any[];
  config: any;
}

// Status transition configuration
export interface StatusTransition {
  from: ProjectBudget['status'];
  to: ProjectBudget['status'];
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  warningMessage?: string;
}

// Project context error interface
export interface ProjectError {
  type: 'validation' | 'network' | 'auth' | 'server' | 'not_found';
  message: string;
  field?: string; // For validation errors
  details?: any;
}
