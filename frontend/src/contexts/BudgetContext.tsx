import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { budgetsApi, MonthlyBudget, ProjectBudget, BudgetSummary, CreateMonthlyBudgetData, CreateProjectBudgetData } from '../services/api/budgets';

interface BudgetContextType {
  // State
  currentMonthlyBudget: MonthlyBudget | null;
  projectBudgets: ProjectBudget[];
  budgetSummary: BudgetSummary | null;
  loading: boolean;
  error: string | null;

  // Current period tracking
  currentYear: number;
  currentMonth: number;

  // Actions
  setCurrentPeriod: (year: number, month: number) => void;
  refreshBudgets: () => Promise<void>;
  
  // Monthly Budget actions
  loadMonthlyBudget: (year: number, month: number) => Promise<MonthlyBudget | null>;
  createMonthlyBudget: (data: CreateMonthlyBudgetData) => Promise<MonthlyBudget>;
  updateMonthlyBudget: (id: string, data: Partial<CreateMonthlyBudgetData>) => Promise<MonthlyBudget>;
  calculateMonthlyBudget: (year: number, month: number, monthsToAnalyze?: number) => Promise<MonthlyBudget>;
  
  // Project Budget actions
  loadProjectBudgets: (filters?: { status?: string; year?: number }) => Promise<void>;
  createProjectBudget: (data: CreateProjectBudgetData) => Promise<ProjectBudget>;
  updateProjectBudget: (id: string, data: Partial<CreateProjectBudgetData>) => Promise<ProjectBudget>;
  deleteProjectBudget: (id: string) => Promise<void>;
  
  // Summary actions
  loadBudgetSummary: (year: number, month: number) => Promise<void>;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (context === undefined) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
};

interface BudgetProviderProps {
  children: ReactNode;
}

export const BudgetProvider: React.FC<BudgetProviderProps> = ({ children }) => {
  // State
  const [currentMonthlyBudget, setCurrentMonthlyBudget] = useState<MonthlyBudget | null>(null);
  const [projectBudgets, setProjectBudgets] = useState<ProjectBudget[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current period tracking
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);

  // Utility function to handle errors
  const handleError = (error: any, operation: string) => {
    console.error(`Error in ${operation}:`, error);
    setError(error.response?.data?.error || error.message || `Failed to ${operation}`);
    setLoading(false);
  };

  // Clear error when starting new operations
  const clearError = () => setError(null);

  // Set current period
  const setCurrentPeriod = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  // Load monthly budget
  const loadMonthlyBudget = async (year: number, month: number): Promise<MonthlyBudget | null> => {
    try {
      clearError();
      setLoading(true);
      const response = await budgetsApi.getMonthlyBudget(year, month);
      
      // Handle API response format {success: true, data: budget}
      const budget = (response as any)?.data || response;
      
      // If budget data is null, set to null
      if (!budget || budget === null) {
        setCurrentMonthlyBudget(null);
        return null;
      }
      
      setCurrentMonthlyBudget(budget);
      return budget;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No budget exists for this period
        setCurrentMonthlyBudget(null);
        return null;
      }
      handleError(error, 'load monthly budget');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Create monthly budget
  const createMonthlyBudget = async (data: CreateMonthlyBudgetData): Promise<MonthlyBudget> => {
    try {
      clearError();
      setLoading(true);
      const budget = await budgetsApi.createMonthlyBudget(data);
      setCurrentMonthlyBudget(budget);
      return budget;
    } catch (error: any) {
      handleError(error, 'create monthly budget');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update monthly budget
  const updateMonthlyBudget = async (id: string, data: Partial<CreateMonthlyBudgetData>): Promise<MonthlyBudget> => {
    try {
      clearError();
      setLoading(true);
      const budget = await budgetsApi.updateMonthlyBudget(id, data);
      setCurrentMonthlyBudget(budget);
      return budget;
    } catch (error: any) {
      handleError(error, 'update monthly budget');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Calculate monthly budget from history
  const calculateMonthlyBudget = async (year: number, month: number, monthsToAnalyze?: number): Promise<MonthlyBudget> => {
    try {
      clearError();
      setLoading(true);
      const budget = await budgetsApi.calculateMonthlyBudget(year, month, monthsToAnalyze);
      setCurrentMonthlyBudget(budget);
      return budget;
    } catch (error: any) {
      handleError(error, 'calculate monthly budget');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Load project budgets
  const loadProjectBudgets = async (filters?: { status?: string; year?: number }): Promise<void> => {
    try {
      clearError();
      setLoading(true);
      const response = await budgetsApi.getProjectBudgets(filters);
      setProjectBudgets(response.projects);
    } catch (error: any) {
      handleError(error, 'load project budgets');
    } finally {
      setLoading(false);
    }
  };

  // Create project budget
  const createProjectBudget = async (data: CreateProjectBudgetData): Promise<ProjectBudget> => {
    try {
      clearError();
      setLoading(true);
      const project = await budgetsApi.createProjectBudget(data);
      setProjectBudgets(prev => [...prev, project]);
      return project;
    } catch (error: any) {
      handleError(error, 'create project budget');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update project budget
  const updateProjectBudget = async (id: string, data: Partial<CreateProjectBudgetData>): Promise<ProjectBudget> => {
    try {
      clearError();
      setLoading(true);
      const project = await budgetsApi.updateProjectBudget(id, data);
      setProjectBudgets(prev => prev.map(p => p._id === id ? project : p));
      return project;
    } catch (error: any) {
      handleError(error, 'update project budget');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete project budget
  const deleteProjectBudget = async (id: string): Promise<void> => {
    try {
      clearError();
      setLoading(true);
      await budgetsApi.deleteProjectBudget(id);
      setProjectBudgets(prev => prev.filter(p => p._id !== id));
    } catch (error: any) {
      handleError(error, 'delete project budget');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Load budget summary
  const loadBudgetSummary = async (year: number, month: number): Promise<void> => {
    try {
      clearError();
      const summary = await budgetsApi.getBudgetSummary(year, month);
      setBudgetSummary(summary);
    } catch (error: any) {
      handleError(error, 'load budget summary');
    }
  };

  // Refresh all budgets
  const refreshBudgets = useCallback(async (): Promise<void> => {
    await Promise.all([
      loadMonthlyBudget(currentYear, currentMonth),
      loadProjectBudgets({ status: 'active' }),
      loadBudgetSummary(currentYear, currentMonth)
    ]);
  }, [currentYear, currentMonth]);

  // Load initial data when context mounts or period changes
  useEffect(() => {
    refreshBudgets();
  }, [refreshBudgets]);

  const value: BudgetContextType = {
    // State
    currentMonthlyBudget,
    projectBudgets,
    budgetSummary,
    loading,
    error,
    currentYear,
    currentMonth,

    // Actions
    setCurrentPeriod,
    refreshBudgets,
    loadMonthlyBudget,
    createMonthlyBudget,
    updateMonthlyBudget,
    calculateMonthlyBudget,
    loadProjectBudgets,
    createProjectBudget,
    updateProjectBudget,
    deleteProjectBudget,
    loadBudgetSummary,
  };

  return (
    <BudgetContext.Provider value={value}>
      {children}
    </BudgetContext.Provider>
  );
};
