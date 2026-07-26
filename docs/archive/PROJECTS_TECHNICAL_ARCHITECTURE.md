# Projects Feature Technical Architecture

## 🏗️ **Technical Overview**

**Document Purpose**: Detailed technical specifications for implementing the Projects feature frontend components and integration patterns.

**Last Updated**: August 18, 2025  
**Related Documents**: `PROJECTS_FEATURE_ROADMAP.md`, `PROJECTS_COMPONENT_SPECIFICATIONS.md`

---

## 🎯 **Architecture Principles**

### **Design Patterns**
- **Component-Driven Development**: Modular, reusable React components
- **Container/Presentational Pattern**: Separate data logic from UI rendering
- **Context-Based State Management**: Centralized project state with React Context
- **API-First Integration**: Leverage existing backend endpoints with minimal changes
- **TypeScript-First**: Full type safety with comprehensive interfaces

### **Technical Stack Integration**
```typescript
// Existing Stack (Leverage)
- React 18 + TypeScript
- Material-UI (MUI) v5
- React Router v6
- Axios for API calls
- React Hook Form for forms
- Date-fns for date manipulation

// New Additions (Minimal)
- React Query (optional, for caching)
- Chart.js (for project analytics)
```

---

## 📦 **Component Architecture**

### **Directory Structure**
```
frontend/src/components/projects/
├── creation/                    # Project creation workflow
│   ├── ProjectCreationWizard.tsx
│   ├── ProjectBasicsStep.tsx
│   ├── ProjectFundingStep.tsx
│   ├── ProjectBudgetStep.tsx
│   └── ProjectReviewStep.tsx
├── detail/                      # Project detail views
│   ├── ProjectDetailPage.tsx
│   ├── ProjectOverviewSection.tsx
│   ├── ProjectBudgetBreakdown.tsx
│   ├── ProjectFundingStatus.tsx
│   ├── ProjectTransactionsList.tsx
│   └── ProjectTimelineView.tsx
├── list/                        # Project list management
│   ├── ProjectsListPage.tsx
│   ├── ProjectCard.tsx
│   ├── ProjectFilters.tsx
│   ├── ProjectSearch.tsx
│   └── ProjectActions.tsx
├── edit/                        # Project editing components
│   ├── ProjectEditDialog.tsx
│   ├── ProjectStatusManager.tsx
│   ├── ProjectFundingEditor.tsx
│   └── ProjectBudgetEditor.tsx
├── shared/                      # Reusable project components
│   ├── ProjectStatusChip.tsx
│   ├── ProjectProgressBar.tsx
│   ├── ProjectActions.tsx
│   ├── ProjectCard.tsx
│   └── ProjectMetrics.tsx
└── dashboard/                   # Main projects dashboard (Phase 2)
    ├── ProjectsDashboard.tsx
    ├── ProjectsOverview.tsx
    ├── ProjectsAnalytics.tsx
    └── ActiveProjectsWidget.tsx
```

---

## 🔗 **State Management Architecture**

### **ProjectContext Implementation**
```typescript
// frontend/src/contexts/ProjectContext.tsx
interface ProjectContextType {
  // State
  projects: ProjectBudget[];
  currentProject: ProjectBudget | null;
  loading: boolean;
  error: string | null;
  filters: ProjectFilters;
  searchQuery: string;
  
  // Actions
  createProject: (data: ProjectCreationData) => Promise<ProjectBudget>;
  updateProject: (id: string, data: Partial<ProjectBudget>) => Promise<ProjectBudget>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => Promise<ProjectBudget>;
  refreshProjects: () => Promise<void>;
  
  // Filtering & Search
  setFilters: (filters: Partial<ProjectFilters>) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  
  // Computed Values
  filteredProjects: ProjectBudget[];
  activeProjects: ProjectBudget[];
  completedProjects: ProjectBudget[];
  totalProjectValue: number;
  totalSpent: number;
  totalRemaining: number;
}

// Usage Pattern
const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectBudget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Implementation details...
  
  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};
```

### **Integration with BudgetContext**
```typescript
// Shared State Coordination
interface SharedProjectBudgetData {
  projectImpactOnBudgets: Map<string, number>; // projectId -> budget impact
  monthlyBudgetAllocations: Map<string, ProjectAllocation[]>; // month -> allocations
  transactionTagging: {
    pendingTags: TransactionTag[];
    taggedTransactions: Map<string, string[]>; // transactionId -> projectIds
  };
}

// Cross-Context Communication
const useBudgetProjectIntegration = () => {
  const { projects } = useProject();
  const { currentMonthlyBudget, refreshBudgets } = useBudget();
  
  const calculateProjectImpact = useCallback(() => {
    // Calculate how projects affect monthly budgets
  }, [projects, currentMonthlyBudget]);
  
  return { calculateProjectImpact };
};
```

---

## 🌐 **API Integration Architecture**

### **Projects API Service**
```typescript
// frontend/src/services/api/projects.ts
class ProjectsApiService {
  private baseUrl = '/api/budgets/projects';
  
  // Core CRUD Operations
  async getProjects(filters?: ProjectFilters): Promise<ApiResponse<ProjectsListResponse>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    
    return this.apiCall('GET', `${this.baseUrl}?${params.toString()}`);
  }
  
  async getProject(id: string): Promise<ApiResponse<ProjectBudget>> {
    return this.apiCall('GET', `${this.baseUrl}/${id}`);
  }
  
  async createProject(data: ProjectCreationData): Promise<ApiResponse<ProjectBudget>> {
    return this.apiCall('POST', this.baseUrl, data);
  }
  
  async updateProject(id: string, data: Partial<ProjectBudget>): Promise<ApiResponse<ProjectBudget>> {
    return this.apiCall('PUT', `${this.baseUrl}/${id}`, data);
  }
  
  async deleteProject(id: string): Promise<ApiResponse<void>> {
    return this.apiCall('DELETE', `${this.baseUrl}/${id}`);
  }
  
  async getProjectProgress(id: string): Promise<ApiResponse<ProjectProgress>> {
    return this.apiCall('GET', `${this.baseUrl}/${id}/progress`);
  }
  
  // Utility Methods
  private async apiCall<T>(method: string, url: string, data?: any): Promise<ApiResponse<T>> {
    // Implement with axios, error handling, auth headers
  }
}

export const projectsApi = new ProjectsApiService();
```

### **Error Handling Strategy**
```typescript
// Centralized Error Handling
interface ProjectError {
  type: 'validation' | 'network' | 'auth' | 'server' | 'not_found';
  message: string;
  field?: string; // For validation errors
  details?: any;
}

const useProjectErrorHandler = () => {
  const handleError = useCallback((error: any): ProjectError => {
    if (error.response?.status === 400) {
      return {
        type: 'validation',
        message: error.response.data.message,
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
    
    return {
      type: 'network',
      message: 'Network error occurred'
    };
  }, []);
  
  return { handleError };
};
```

---

## 📋 **Form Management Architecture**

### **Project Creation Wizard State**
```typescript
// Multi-step Form State Management
interface ProjectCreationState {
  currentStep: number;
  totalSteps: number;
  formData: Partial<ProjectCreationData>;
  validation: {
    [key: string]: string | null;
  };
  isDirty: boolean;
  canProceed: boolean;
}

// Step-by-step Validation
const useProjectCreationWizard = () => {
  const [state, setState] = useState<ProjectCreationState>({
    currentStep: 0,
    totalSteps: 4,
    formData: {},
    validation: {},
    isDirty: false,
    canProceed: false
  });
  
  const updateFormData = useCallback((stepData: Partial<ProjectCreationData>) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, ...stepData },
      isDirty: true
    }));
  }, []);
  
  const validateCurrentStep = useCallback((): boolean => {
    switch (state.currentStep) {
      case 0: return validateBasicsStep(state.formData);
      case 1: return validateFundingStep(state.formData);
      case 2: return validateBudgetStep(state.formData);
      case 3: return true; // Review step
      default: return false;
    }
  }, [state.currentStep, state.formData]);
  
  const nextStep = useCallback(() => {
    if (validateCurrentStep() && state.currentStep < state.totalSteps - 1) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  }, [validateCurrentStep, state.currentStep, state.totalSteps]);
  
  const prevStep = useCallback(() => {
    if (state.currentStep > 0) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  }, [state.currentStep]);
  
  return {
    state,
    updateFormData,
    nextStep,
    prevStep,
    validateCurrentStep,
    isFirstStep: state.currentStep === 0,
    isLastStep: state.currentStep === state.totalSteps - 1
  };
};
```

### **Form Validation Rules**
```typescript
// Validation Schema
const projectValidationSchema = {
  basics: {
    name: {
      required: true,
      minLength: 1,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9\s\-_]+$/
    },
    description: {
      required: false,
      maxLength: 500
    },
    startDate: {
      required: true,
      validate: (value: Date) => value >= new Date()
    },
    endDate: {
      required: true,
      validate: (value: Date, formData: any) => value > formData.startDate
    },
    priority: {
      required: true,
      enum: ['low', 'medium', 'high', 'urgent']
    }
  },
  funding: {
    fundingSources: {
      required: true,
      minLength: 1,
      validate: (sources: FundingSource[]) => {
        return sources.every(source => 
          source.expectedAmount > 0 && 
          source.description.length > 0
        );
      }
    }
  },
  budget: {
    categoryBudgets: {
      required: true,
      minLength: 1,
      validate: (budgets: CategoryBudget[]) => {
        const totalBudget = budgets.reduce((sum, budget) => sum + budget.budgetedAmount, 0);
        return totalBudget > 0;
      }
    }
  }
};
```

---

## 🎨 **UI Component Patterns**

### **Consistent Design System**
```typescript
// Project-specific Design Tokens
const projectTheme = {
  colors: {
    primary: '#1976d2',      // Material-UI primary
    success: '#2e7d32',      // Active projects
    warning: '#ed6c02',      // Planning projects
    error: '#d32f2f',        // Cancelled projects
    info: '#0288d1',         // Completed projects
    
    // Project-specific colors
    funding: {
      ongoing_funds: '#4caf50',
      loan: '#ff9800',
      bonus: '#9c27b0',
      savings: '#2196f3',
      other: '#607d8b'
    }
  },
  
  spacing: {
    wizard: {
      stepPadding: '24px',
      buttonSpacing: '16px'
    },
    cards: {
      padding: '16px',
      margin: '8px'
    }
  },
  
  breakpoints: {
    mobile: '600px',
    tablet: '960px',
    desktop: '1280px'
  }
};

// Reusable Component Patterns
const ProjectCard: React.FC<ProjectCardProps> = ({ project, variant = 'default' }) => {
  const theme = useTheme();
  
  return (
    <Card
      sx={{
        p: projectTheme.spacing.cards.padding,
        m: projectTheme.spacing.cards.margin,
        border: variant === 'highlighted' ? `2px solid ${theme.palette.primary.main}` : undefined,
        cursor: 'pointer',
        '&:hover': {
          boxShadow: theme.shadows[4]
        }
      }}
    >
      {/* Card content */}
    </Card>
  );
};
```

### **Loading and Error States**
```typescript
// Consistent Loading Patterns
const ProjectLoadingStates = {
  // Skeleton loading for project cards
  ProjectCardSkeleton: () => (
    <Card sx={{ p: 2, m: 1 }}>
      <Skeleton variant="text" width="60%" height={32} />
      <Skeleton variant="text" width="40%" height={24} />
      <Box display="flex" gap={1} mt={1}>
        <Skeleton variant="rectangular" width={80} height={24} />
        <Skeleton variant="rectangular" width={60} height={24} />
      </Box>
      <Skeleton variant="rectangular" width="100%" height={8} sx={{ mt: 2 }} />
    </Card>
  ),
  
  // Full page loading
  ProjectPageLoading: () => (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Skeleton variant="text" width="300px" height={48} />
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {[...Array(6)].map((_, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <ProjectLoadingStates.ProjectCardSkeleton />
          </Grid>
        ))}
      </Grid>
    </Container>
  ),
  
  // Form step loading
  WizardStepLoading: () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width="200px" height={32} />
      <Skeleton variant="rectangular" width="100%" height={200} sx={{ mt: 2 }} />
    </Box>
  )
};

// Error State Components
const ProjectErrorStates = {
  ProjectNotFound: ({ onBack }: { onBack: () => void }) => (
    <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <Typography variant="h4" color="text.secondary" gutterBottom>
        Project Not Found
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        The project you're looking for doesn't exist or has been deleted.
      </Typography>
      <Button variant="contained" onClick={onBack}>
        Back to Projects
      </Button>
    </Container>
  ),
  
  ProjectListError: ({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {error}
    </Alert>
  )
};
```

---

## 🔄 **Data Flow Architecture**

### **Project Creation Flow**
```typescript
// Step-by-step Data Flow
1. User starts wizard → ProjectCreationWizard mounts
2. Step 1: Basics → Local state updates, validation runs
3. Step 2: Funding → Funding sources added to form state
4. Step 3: Budget → Category budgets allocated
5. Step 4: Review → Final validation and preview
6. Submit → API call to POST /api/budgets/projects
7. Success → Navigate to project detail page
8. Context refresh → Update projects list globally

// Implementation Pattern
const ProjectCreationWizard: React.FC = () => {
  const { createProject } = useProject();
  const { wizard } = useProjectCreationWizard();
  const navigate = useNavigate();
  
  const handleSubmit = async () => {
    try {
      const newProject = await createProject(wizard.state.formData);
      navigate(`/budgets/projects/${newProject._id}`);
    } catch (error) {
      // Handle error
    }
  };
  
  return (
    <Stepper activeStep={wizard.state.currentStep}>
      {/* Wizard steps */}
    </Stepper>
  );
};
```

### **Real-time Progress Updates**
```typescript
// Project Progress Calculation
const useProjectProgress = (projectId: string) => {
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Real-time updates when transactions change
  useEffect(() => {
    const updateProgress = async () => {
      setLoading(true);
      try {
        const result = await projectsApi.getProjectProgress(projectId);
        setProgress(result.data);
      } catch (error) {
        console.error('Failed to update project progress:', error);
      } finally {
        setLoading(false);
      }
    };
    
    updateProgress();
    
    // Listen for transaction updates
    const unsubscribe = transactionEvents.subscribe('transaction-updated', updateProgress);
    return unsubscribe;
  }, [projectId]);
  
  return { progress, loading };
};
```

---

## 📱 **Mobile Optimization Strategy**

### **Responsive Design Patterns**
```typescript
// Mobile-first Component Design
const ProjectDetailPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  return (
    <Container maxWidth="lg">
      <Grid container spacing={isMobile ? 2 : 3}>
        <Grid item xs={12} md={8}>
          {/* Main content - full width on mobile */}
          <ProjectOverviewSection />
        </Grid>
        <Grid item xs={12} md={4}>
          {/* Sidebar - stacked below on mobile */}
          <ProjectActions />
        </Grid>
      </Grid>
    </Container>
  );
};

// Touch-friendly Interactions
const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  return (
    <Card
      sx={{
        minHeight: isMobile ? 120 : 100, // Larger touch targets on mobile
        cursor: 'pointer',
        '&:hover': {
          transform: isMobile ? 'none' : 'scale(1.02)', // No hover effects on mobile
          boxShadow: theme.shadows[4]
        },
        '&:active': {
          transform: isMobile ? 'scale(0.98)' : 'none' // Touch feedback on mobile
        }
      }}
    >
      {/* Card content */}
    </Card>
  );
};
```

### **Mobile Navigation Patterns**
```typescript
// Bottom Sheet for Mobile Actions
const MobileProjectActions: React.FC<{ project: ProjectBudget }> = ({ project }) => {
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  
  return (
    <>
      <IconButton
        onClick={() => setBottomSheetOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          bgcolor: 'primary.main',
          color: 'white',
          '&:hover': { bgcolor: 'primary.dark' }
        }}
      >
        <MoreVertIcon />
      </IconButton>
      
      <Drawer
        anchor="bottom"
        open={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '50vh'
          }
        }}
      >
        <List>
          <ListItem button onClick={() => handleEdit(project)}>
            <ListItemIcon><EditIcon /></ListItemIcon>
            <ListItemText primary="Edit Project" />
          </ListItem>
          {/* More actions */}
        </List>
      </Drawer>
    </>
  );
};
```

---

## 🔧 **Performance Optimization**

### **Component Optimization Strategies**
```typescript
// Memoization for Heavy Components
const ProjectCard = React.memo<ProjectCardProps>(({ project }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for when to re-render
  return (
    prevProps.project._id === nextProps.project._id &&
    prevProps.project.progressPercentage === nextProps.project.progressPercentage &&
    prevProps.project.status === nextProps.project.status
  );
});

// Virtual Scrolling for Large Lists
const ProjectsList: React.FC<{ projects: ProjectBudget[] }> = ({ projects }) => {
  const [visibleProjects, setVisibleProjects] = useState<ProjectBudget[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  useEffect(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    setVisibleProjects(projects.slice(0, end));
  }, [projects, page]);
  
  const handleLoadMore = useCallback(() => {
    if ((page + 1) * pageSize < projects.length) {
      setPage(prev => prev + 1);
    }
  }, [page, projects.length]);
  
  return (
    <InfiniteScroll
      dataLength={visibleProjects.length}
      next={handleLoadMore}
      hasMore={(page + 1) * pageSize < projects.length}
      loader={<CircularProgress />}
    >
      {visibleProjects.map(project => (
        <ProjectCard key={project._id} project={project} />
      ))}
    </InfiniteScroll>
  );
};
```

### **Caching Strategy**
```typescript
// React Query Integration for Caching
const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
};

// Smart Prefetching
const useProjectListWithPrefetch = () => {
  const queryClient = useQueryClient();
  
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects()
  });
  
  // Prefetch project details for active projects
  useEffect(() => {
    if (projects?.data?.projects) {
      projects.data.projects
        .filter(p => p.status === 'active')
        .slice(0, 5) // Only prefetch first 5
        .forEach(project => {
          queryClient.prefetchQuery({
            queryKey: ['project', project._id],
            queryFn: () => projectsApi.getProject(project._id),
            staleTime: 5 * 60 * 1000
          });
        });
    }
  }, [projects, queryClient]);
  
  return projects;
};
```

---

## 🧪 **Testing Architecture**

### **Component Testing Strategy**
```typescript
// Test Utilities
const renderWithProjectContext = (
  component: ReactElement,
  contextValue: Partial<ProjectContextType> = {}
) => {
  const defaultContext: ProjectContextType = {
    projects: [],
    currentProject: null,
    loading: false,
    error: null,
    // ... other defaults
  };
  
  return render(
    <ProjectContext.Provider value={{ ...defaultContext, ...contextValue }}>
      {component}
    </ProjectContext.Provider>
  );
};

// Example Component Test
describe('ProjectCard', () => {
  const mockProject: ProjectBudget = {
    _id: 'project-1',
    name: 'Test Project',
    status: 'active',
    progressPercentage: 75,
    remainingBudget: 5000,
    daysRemaining: 30
  };
  
  it('renders project information correctly', () => {
    renderWithProjectContext(<ProjectCard project={mockProject} />);
    
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('75% complete')).toBeInTheDocument();
    expect(screen.getByText('30 days remaining')).toBeInTheDocument();
  });
  
  it('handles click to navigate to detail page', async () => {
    const user = userEvent.setup();
    renderWithProjectContext(<ProjectCard project={mockProject} />);
    
    const card = screen.getByRole('button');
    await user.click(card);
    
    expect(mockNavigate).toHaveBeenCalledWith(`/budgets/projects/${mockProject._id}`);
  });
});
```

### **Integration Testing Patterns**
```typescript
// API Integration Tests
describe('Project Creation Flow', () => {
  it('creates project end-to-end', async () => {
    const user = userEvent.setup();
    
    // Mock API responses
    server.use(
      rest.post('/api/budgets/projects', (req, res, ctx) => {
        return res(ctx.json({
          success: true,
          data: { _id: 'new-project-id', name: 'New Project' }
        }));
      })
    );
    
    renderWithProjectContext(<ProjectCreationWizard />);
    
    // Step 1: Basics
    await user.type(screen.getByLabelText('Project Name'), 'Test Project');
    await user.click(screen.getByText('Next'));
    
    // Step 2: Funding
    await user.click(screen.getByText('Add Funding Source'));
    await user.selectOptions(screen.getByLabelText('Type'), 'savings');
    await user.type(screen.getByLabelText('Amount'), '10000');
    await user.click(screen.getByText('Next'));
    
    // Step 3: Budget
    await user.click(screen.getByText('Add Category Budget'));
    await user.selectOptions(screen.getByLabelText('Category'), 'food');
    await user.type(screen.getByLabelText('Budget Amount'), '5000');
    await user.click(screen.getByText('Next'));
    
    // Step 4: Review and Submit
    await user.click(screen.getByText('Create Project'));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/budgets/projects/new-project-id');
    });
  });
});
```

---

*Last Updated: August 18, 2025*
*Status: Complete technical architecture for Projects feature implementation*

---

**Technical Architecture**: **Comprehensive blueprint for robust, scalable project management implementation**
**Next Step**: Begin component implementation following these specifications
