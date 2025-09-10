import { useState, useEffect, useCallback } from 'react';
import { budgetsApi } from '../services/api/budgets';
import { ProjectBudget } from '../types/projects';

export interface UseProjectsResult {
  projects: ProjectBudget[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  tagTransactionToProject: (projectId: string, transactionId: string) => Promise<void>;
  removeTransactionFromProject: (projectId: string, transactionId: string) => Promise<void>;
}

export const useProjects = (): UseProjectsResult => {
  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch projects that are in planning or active status for transaction tagging
      // Users should be able to tag expenses even to projects that haven't officially started yet
      const response = await budgetsApi.getProjectBudgets({
        limit: 100 // Get all projects regardless of status for now
      });
      
      // The response structure is { projects: [], total: number, page: number, totalPages: number }
      const projects = response.projects || [];
      setProjects(projects);
    } catch (err) {
      console.error('useProjects - Failed to fetch projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const tagTransactionToProject = useCallback(async (projectId: string, transactionId: string) => {
    try {
      await budgetsApi.tagTransactionToProject(projectId, transactionId);
      // No need to refetch projects list as this doesn't change project data
    } catch (err) {
      console.error('Failed to tag transaction to project:', err);
      throw new Error('Failed to add transaction to project');
    }
  }, []);

  const removeTransactionFromProject = useCallback(async (projectId: string, transactionId: string) => {
    try {
      await budgetsApi.removeTransactionFromProject(projectId, transactionId);
      // No need to refetch projects list as this doesn't change project data
    } catch (err) {
      console.error('Failed to remove transaction from project:', err);
      throw new Error('Failed to remove transaction from project');
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
    tagTransactionToProject,
    removeTransactionFromProject,
  };
};

export default useProjects;
