import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode, useRef } from 'react';
import {
  ProjectBudget,
  ProjectCreationData,
  ProjectFilters,
  ProjectProgress,
  ProjectError,
  ProjectsListResponse
} from '../types/projects';
import { projectsApi } from '../services/api/projects';

// Context State Interface
interface ProjectContextState {
  // Core State
  projects: ProjectBudget[];
  currentProject: ProjectBudget | null;
  loading: boolean;
  error: ProjectError | null;
  
  // Filtering & Search
  filters: ProjectFilters;
  searchQuery: string;
  
  // Pagination
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  
  // Progress tracking
  projectProgress: Map<string, ProjectProgress>;
  progressLoading: Set<string>;
}

// Context Actions
interface ProjectContextActions {
  // Core CRUD Actions
  createProject: (data: ProjectCreationData) => Promise<ProjectBudget>;
  updateProject: (id: string, data: Partial<ProjectBudget>, immediate?: boolean) => Promise<ProjectBudget>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => Promise<ProjectBudget>;
  refreshProjects: () => Promise<void>;
  
  // Filtering & Search Actions
  setFilters: (filters: Partial<ProjectFilters>) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  
  // Pagination Actions
  loadMore: () => Promise<void>;
  resetPagination: () => void;
  
  // Progress Actions
  getProjectProgress: (id: string) => Promise<ProjectProgress>;
  refreshProjectProgress: (id: string) => Promise<void>;
  
  // Utility Actions
  clearError: () => void;
  clearCurrentProject: () => void;
}

// Combined Context Type
interface ProjectContextType extends ProjectContextState, ProjectContextActions {
  // Computed Values
  filteredProjects: ProjectBudget[];
  activeProjects: ProjectBudget[];
  completedProjects: ProjectBudget[];
  totalProjectValue: number;
  totalPaid: number;
  totalRemaining: number;
}

// Action Types for Reducer
type ProjectAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: ProjectError | null }
  | { type: 'SET_PROJECTS'; projects: ProjectBudget[]; pagination?: any }
  | { type: 'ADD_PROJECT'; project: ProjectBudget }
  | { type: 'UPDATE_PROJECT'; project: ProjectBudget }
  | { type: 'REMOVE_PROJECT'; projectId: string }
  | { type: 'SET_CURRENT_PROJECT'; project: ProjectBudget | null }
  | { type: 'SET_FILTERS'; filters: Partial<ProjectFilters> }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_PAGINATION'; pagination: any }
  | { type: 'RESET_PAGINATION' }
  | { type: 'SET_PROJECT_PROGRESS'; projectId: string; progress: ProjectProgress }
  | { type: 'SET_PROGRESS_LOADING'; projectId: string; loading: boolean };

// Initial State
const initialState: ProjectContextState = {
  projects: [],
  currentProject: null,
  loading: false,
  error: null,
  filters: {},
  searchQuery: '',
  pagination: {
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false
  },
  projectProgress: new Map(),
  progressLoading: new Set()
};

// Reducer Function
function projectReducer(state: ProjectContextState, action: ProjectAction): ProjectContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
      
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
      
    case 'SET_PROJECTS':
      return {
        ...state,
        projects: action.projects,
        pagination: action.pagination || state.pagination,
        loading: false,
        error: null
      };
      
    case 'ADD_PROJECT':
      return {
        ...state,
        projects: [action.project, ...state.projects],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1
        }
      };
      
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p => 
          p._id === action.project._id ? action.project : p
        ),
        currentProject: state.currentProject?._id === action.project._id 
          ? action.project 
          : state.currentProject
      };
      
    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p._id !== action.projectId),
        currentProject: state.currentProject?._id === action.projectId 
          ? null 
          : state.currentProject,
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1)
        }
      };
      
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProject: action.project };
      
    case 'SET_FILTERS':
      return { 
        ...state, 
        filters: { ...state.filters, ...action.filters }
      };
      
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
      
    case 'CLEAR_FILTERS':
      return { 
        ...state, 
        filters: {},
        searchQuery: ''
      };
      
    case 'SET_PAGINATION':
      return { 
        ...state, 
        pagination: { ...state.pagination, ...action.pagination }
      };
      
    case 'RESET_PAGINATION':
      return { 
        ...state, 
        pagination: { ...initialState.pagination }
      };
      
    case 'SET_PROJECT_PROGRESS':
      const newProgressMap = new Map(state.projectProgress);
      newProgressMap.set(action.projectId, action.progress);
      const newProgressLoading = new Set(state.progressLoading);
      newProgressLoading.delete(action.projectId);
      return {
        ...state,
        projectProgress: newProgressMap,
        progressLoading: newProgressLoading
      };
      
    case 'SET_PROGRESS_LOADING':
      const updatedProgressLoading = new Set(state.progressLoading);
      if (action.loading) {
        updatedProgressLoading.add(action.projectId);
      } else {
        updatedProgressLoading.delete(action.projectId);
      }
      return {
        ...state,
        progressLoading: updatedProgressLoading
      };
      
    default:
      return state;
  }
}

// Create Context
const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Context Provider Component
export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  // Core CRUD Actions
  const createProject = useCallback(async (data: ProjectCreationData): Promise<ProjectBudget> => {
    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      const response = await projectsApi.createProject(data);
      
      if (response.success) {
        dispatch({ type: 'ADD_PROJECT', project: response.data });
        return response.data;
      }
      
      throw new Error('Failed to create project');
    } catch (error) {
      const projectError = error as ProjectError;
      dispatch({ type: 'SET_ERROR', error: projectError });
      throw projectError;
    }
  }, []);

  // Debounced update function to prevent API calls on every keystroke
  const updateTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const refreshProjects = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      const currentFilters = { ...state.filters, limit: 20, offset: 0 };
      
      let response: { success: boolean; data: ProjectsListResponse };
      
      if (state.searchQuery) {
        response = await projectsApi.searchProjects(state.searchQuery, currentFilters);
      } else {
        response = await projectsApi.getProjects(currentFilters);
      }
      
      if (response.success) {
        dispatch({ 
          type: 'SET_PROJECTS', 
          projects: response.data.projects,
          pagination: response.data.pagination
        });
      }
    } catch (error) {
      const projectError = error as ProjectError;
      dispatch({ type: 'SET_ERROR', error: projectError });
    }
  }, [state.filters, state.searchQuery]);

  const updateProject = useCallback(async (id: string, data: Partial<ProjectBudget>, immediate: boolean = false): Promise<ProjectBudget> => {
    try {
      // If immediate update is requested, clear any pending debounced update
      if (immediate) {
        const existingTimeout = updateTimeouts.current.get(id);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          updateTimeouts.current.delete(id);
        }
        
        dispatch({ type: 'SET_LOADING', loading: true });
        const response = await projectsApi.updateProject(id, data);
        
        if (response.success) {
          dispatch({ type: 'UPDATE_PROJECT', project: response.data });
          dispatch({ type: 'SET_LOADING', loading: false });
          return response.data;
        }
        
        throw new Error('Failed to update project');
      }

      // For non-immediate updates, apply optimistic update locally first
      const currentProject = state.projects.find(p => p._id === id);
      if (currentProject) {
        const optimisticProject = { ...currentProject, ...data };
        dispatch({ type: 'UPDATE_PROJECT', project: optimisticProject });
      }

      // Clear any existing timeout for this project
      const existingTimeout = updateTimeouts.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new debounced timeout - DO NOT set loading state for debounced updates
      const timeoutId = setTimeout(async () => {
        try {
          const response = await projectsApi.updateProject(id, data);
          
          if (response.success) {
            dispatch({ type: 'UPDATE_PROJECT', project: response.data });
          }
          
          updateTimeouts.current.delete(id);
        } catch (error) {
          console.error('Debounced update failed:', error);
          // Revert optimistic update by refreshing projects
          refreshProjects();
        }
      }, 1000); // 1 second debounce

      updateTimeouts.current.set(id, timeoutId);

      // Return the optimistic update
      return currentProject ? { ...currentProject, ...data } : {} as ProjectBudget;
      
    } catch (error) {
      const projectError = error as ProjectError;
      dispatch({ type: 'SET_ERROR', error: projectError });
      throw projectError;
    }
  }, [state.projects, refreshProjects]);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      const response = await projectsApi.deleteProject(id);
      
      if (response.success) {
        dispatch({ type: 'REMOVE_PROJECT', projectId: id });
      } else {
        throw new Error('Failed to delete project');
      }
    } catch (error) {
      const projectError = error as ProjectError;
      dispatch({ type: 'SET_ERROR', error: projectError });
      throw projectError;
    }
  }, []);

  const getProject = useCallback(async (id: string): Promise<ProjectBudget> => {
    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      const response = await projectsApi.getProject(id);
      
      if (response.success) {
        dispatch({ type: 'SET_CURRENT_PROJECT', project: response.data });
        return response.data;
      }
      
      throw new Error('Failed to get project');
    } catch (error) {
      const projectError = error as ProjectError;
      dispatch({ type: 'SET_ERROR', error: projectError });
      throw projectError;
    }
  }, []);


  // Filtering & Search Actions
  const setFilters = useCallback((filters: Partial<ProjectFilters>) => {
    dispatch({ type: 'SET_FILTERS', filters });
    dispatch({ type: 'RESET_PAGINATION' });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });
    dispatch({ type: 'RESET_PAGINATION' });
  }, []);

  const clearFilters = useCallback(() => {
    dispatch({ type: 'CLEAR_FILTERS' });
    dispatch({ type: 'RESET_PAGINATION' });
  }, []);

  // Pagination Actions
  const loadMore = useCallback(async (): Promise<void> => {
    if (!state.pagination.hasMore || state.loading) return;
    
    try {
      const newOffset = state.pagination.offset + state.pagination.limit;
      const currentFilters = { ...state.filters, limit: 20, offset: newOffset };
      
      let response: { success: boolean; data: ProjectsListResponse };
      
      if (state.searchQuery) {
        response = await projectsApi.searchProjects(state.searchQuery, currentFilters);
      } else {
        response = await projectsApi.getProjects(currentFilters);
      }
      
      if (response.success) {
        dispatch({ 
          type: 'SET_PROJECTS', 
          projects: [...state.projects, ...response.data.projects],
          pagination: response.data.pagination
        });
      }
    } catch (error) {
      const projectError = error as ProjectError;
      dispatch({ type: 'SET_ERROR', error: projectError });
    }
  }, [state.filters, state.searchQuery, state.pagination, state.loading, state.projects]);

  const resetPagination = useCallback(() => {
    dispatch({ type: 'RESET_PAGINATION' });
  }, []);

  // Progress Actions
  const getProjectProgress = useCallback(async (id: string): Promise<ProjectProgress> => {
    try {
      dispatch({ type: 'SET_PROGRESS_LOADING', projectId: id, loading: true });
      const response = await projectsApi.getProjectProgress(id);
      
      if (response.success) {
        dispatch({ type: 'SET_PROJECT_PROGRESS', projectId: id, progress: response.data });
        return response.data;
      }
      
      throw new Error('Failed to get project progress');
    } catch (error) {
      dispatch({ type: 'SET_PROGRESS_LOADING', projectId: id, loading: false });
      const projectError = error as ProjectError;
      throw projectError;
    }
  }, []);

  const refreshProjectProgress = useCallback(async (id: string): Promise<void> => {
    await getProjectProgress(id);
  }, [getProjectProgress]);

  // Utility Actions
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null });
  }, []);

  const clearCurrentProject = useCallback(() => {
    dispatch({ type: 'SET_CURRENT_PROJECT', project: null });
  }, []);

  // Computed Values
  const filteredProjects = state.projects; // Already filtered by API

  const activeProjects = state.projects.filter(p => p.status === 'active');
  
  const completedProjects = state.projects.filter(p => p.status === 'completed');
  
  const totalProjectValue = state.projects.reduce((sum, p) => sum + p.totalBudget, 0);
  
  const totalPaid = state.projects.reduce((sum, p) => sum + p.totalPaid, 0);
  
  const totalRemaining = state.projects.reduce((sum, p) => sum + p.remainingBudget, 0);

  // Auto-refresh projects when filters or search query changes
  useEffect(() => {
    refreshProjects();
  }, [state.filters, state.searchQuery, refreshProjects]);

  // Context value
  const contextValue: ProjectContextType = {
    // State
    ...state,
    
    // Actions
    createProject,
    updateProject,
    deleteProject,
    getProject,
    refreshProjects,
    setFilters,
    setSearchQuery,
    clearFilters,
    loadMore,
    resetPagination,
    getProjectProgress,
    refreshProjectProgress,
    clearError,
    clearCurrentProject,
    
    // Computed Values
    filteredProjects,
    activeProjects,
    completedProjects,
    totalProjectValue,
    totalPaid,
    totalRemaining
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};

// Hook to use Project Context
export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

// Export for testing
export { ProjectContext };
