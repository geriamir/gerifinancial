import api from './base';
import {
  ProjectBudget,
  ProjectCreationData,
  ProjectFilters,
  ProjectProgress,
  ProjectsListResponse,
  ApiResponse,
  ProjectError
} from '../../types/projects';

// Enhanced Projects API Service
class ProjectsApiService {
  private baseUrl = '/budgets/projects';

  // Core CRUD Operations
  async getProjects(filters?: ProjectFilters): Promise<ApiResponse<ProjectsListResponse>> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.status) params.append('status', filters.status);
      if (filters?.year) params.append('year', filters.year.toString());
      if (filters?.fundingType) params.append('fundingType', filters.fundingType);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());
      
      if (filters?.startDateRange) {
        params.append('startDateFrom', filters.startDateRange.from.toISOString());
        params.append('startDateTo', filters.startDateRange.to.toISOString());
      }
      
      if (filters?.budgetRange) {
        params.append('budgetMin', filters.budgetRange.min.toString());
        params.append('budgetMax', filters.budgetRange.max.toString());
      }

      const response = await api.get(`${this.baseUrl}?${params.toString()}`);
      
      return {
        success: true,
        data: {
          projects: response.data.projects || response.data.data?.projects || [],
          pagination: response.data.pagination || {
            total: response.data.total || 0,
            limit: filters?.limit || 20,
            offset: filters?.offset || 0,
            hasMore: false
          }
        }
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProject(id: string): Promise<ApiResponse<ProjectBudget>> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createProject(data: ProjectCreationData): Promise<ApiResponse<ProjectBudget>> {
    try {
      // Send simplified data - backend will create template-based budget
      const backendData = {
        name: data.name,
        type: data.type,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        currency: data.currency
      };

      const response = await api.post(this.baseUrl, backendData);
      
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProject(id: string, data: Partial<ProjectBudget>): Promise<ApiResponse<ProjectBudget>> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, data);
      
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteProject(id: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`${this.baseUrl}/${id}`);
      
      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProjectProgress(id: string): Promise<ApiResponse<ProjectProgress>> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}/progress`);
      
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Search and filtering utilities
  async searchProjects(query: string, filters?: ProjectFilters): Promise<ApiResponse<ProjectsListResponse>> {
    try {
      const searchFilters = {
        ...filters,
        limit: filters?.limit || 20,
        offset: filters?.offset || 0
      };
      
      const params = new URLSearchParams();
      params.append('search', query);
      
      if (searchFilters.status) params.append('status', searchFilters.status);
      if (searchFilters.limit) params.append('limit', searchFilters.limit.toString());
      if (searchFilters.offset) params.append('offset', searchFilters.offset.toString());

      const response = await api.get(`${this.baseUrl}/search?${params.toString()}`);
      
      return {
        success: true,
        data: {
          projects: response.data.projects || response.data.data?.projects || [],
          pagination: response.data.pagination || {
            total: response.data.total || 0,
            limit: searchFilters.limit,
            offset: searchFilters.offset,
            hasMore: false
          }
        }
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Batch operations
  async bulkUpdateStatus(projectIds: string[], status: ProjectBudget['status']): Promise<ApiResponse<ProjectBudget[]>> {
    try {
      const response = await api.put(`${this.baseUrl}/bulk/status`, {
        projectIds,
        status
      });
      
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async bulkDelete(projectIds: string[]): Promise<ApiResponse<void>> {
    try {
      await api.delete(`${this.baseUrl}/bulk`, {
        data: { projectIds }
      });
      
      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Analytics and insights
  async getProjectAnalytics(projectIds?: string[], dateRange?: { from: Date; to: Date }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      
      if (projectIds?.length) {
        params.append('projects', projectIds.join(','));
      }
      
      if (dateRange) {
        params.append('from', dateRange.from.toISOString());
        params.append('to', dateRange.to.toISOString());
      }

      const response = await api.get(`${this.baseUrl}/analytics?${params.toString()}`);
      
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Transaction tagging
  async tagTransaction(transactionId: string, projectId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`${this.baseUrl}/${projectId}/transactions/${transactionId}/tag`);
      
      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async untagTransaction(transactionId: string, projectId: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`${this.baseUrl}/${projectId}/transactions/${transactionId}/tag`);
      
      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async bulkTagTransactions(transactionIds: string[], projectId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`${this.baseUrl}/${projectId}/transactions/bulk-tag`, {
        transactionIds
      });
      
      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Error handling utility
  private handleError(error: any): ProjectError {
    console.error('Projects API Error:', error);
    
    if (error.response?.status === 400) {
      return {
        type: 'validation',
        message: error.response.data.message || 'Validation error',
        field: error.response.data.field,
        details: error.response.data.errors
      };
    }
    
    if (error.response?.status === 404) {
      return {
        type: 'not_found',
        message: 'Project not found'
      };
    }
    
    if (error.response?.status === 401) {
      return {
        type: 'auth',
        message: 'Authentication required'
      };
    }
    
    if (error.response?.status >= 500) {
      return {
        type: 'server',
        message: 'Server error occurred'
      };
    }
    
    return {
      type: 'network',
      message: error.message || 'Network error occurred'
    };
  }
}

// Export singleton instance
export const projectsApi = new ProjectsApiService();

// Export for backwards compatibility with existing budgets API
export default projectsApi;
