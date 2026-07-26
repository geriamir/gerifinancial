# Projects Feature Component Specifications

## 📋 **Component Interface Specifications**

**Document Purpose**: Detailed TypeScript interfaces, component props, and implementation specifications for all Projects feature components.

**Last Updated**: August 18, 2025  
**Related Documents**: `PROJECTS_FEATURE_ROADMAP.md`, `PROJECTS_TECHNICAL_ARCHITECTURE.md`

---

## 🔗 **Core Type Definitions**

### **Base Project Types**
```typescript
// frontend/src/types/projects.ts

// Core Project Budget Interface (matches backend model)
interface ProjectBudget {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  
  // Timeline
  startDate: Date;
  endDate: Date;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  
  // Funding Sources
  fundingSources: FundingSource[];
  
  // Budget Breakdown
  categoryBudgets: CategoryBudget[];
  
  // Calculated Totals
  totalBudget: number;
  totalSpent: number;
  
  // Settings
  impactsOtherBudgets: boolean;
  projectTag?: string; // ObjectId as string
  currency: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  
  // Virtual Fields (from backend)
  totalFunding: number;
  totalAvailableFunding: number;
  progressPercentage: number;
  remainingBudget: number;
  budgetVariance: number;
  daysRemaining: number;
  durationDays: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Funding Source Configuration
interface FundingSource {
  type: 'ongoing_funds' | 'loan' | 'bonus' | 'savings' | 'other';
  description: string;
  expectedAmount: number;
  availableAmount: number;
  limit?: number;
}

// Category Budget Allocation
interface CategoryBudget {
  categoryId: string;
  subCategoryId: string;
  budgetedAmount: number;
  actualAmount: number;
}

// Project Creation Form Data
interface ProjectCreationData {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  fundingSources: Omit<FundingSource, 'availableAmount'>[];
  categoryBudgets: Omit<CategoryBudget, 'actualAmount'>[];
  currency?: string;
  notes?: string;
}

// Project Filters for List/Search
interface ProjectFilters {
  status?: 'planning' | 'active' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
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
interface ProjectProgress {
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
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

interface ProjectsListResponse {
  projects: ProjectBudget[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
```

---

## 🎨 **Component Props Specifications**

### **Project Creation Components**

#### **ProjectCreationWizard**
```typescript
// Main wizard container component
interface ProjectCreationWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: ProjectBudget) => void;
  initialData?: Partial<ProjectCreationData>;
  mode?: 'create' | 'edit';
  projectId?: string; // for edit mode
}

// Usage Example:
const ProjectCreationWizard: React.FC<ProjectCreationWizardProps> = ({
  open,
  onClose,
  onSuccess,
  initialData,
  mode = 'create',
  projectId
}) => {
  // Component implementation
};
```

#### **ProjectBasicsStep**
```typescript
interface ProjectBasicsStepProps {
  data: Partial<ProjectCreationData>;
  onUpdate: (data: Partial<ProjectCreationData>) => void;
  onNext: () => void;
  errors: Record<string, string>;
  loading?: boolean;
}

// Step-specific data interface
interface ProjectBasicsData {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}
```

#### **ProjectFundingStep**
```typescript
interface ProjectFundingStepProps {
  data: Partial<ProjectCreationData>;
  onUpdate: (data: Partial<ProjectCreationData>) => void;
  onNext: () => void;
  onPrev: () => void;
  errors: Record<string, string>;
  loading?: boolean;
}

// Funding source form interface
interface FundingSourceFormData {
  type: FundingSource['type'];
  description: string;
  expectedAmount: string; // string for form handling
  limit?: string;
}
```

#### **ProjectBudgetStep**
```typescript
interface ProjectBudgetStepProps {
  data: Partial<ProjectCreationData>;
  onUpdate: (data: Partial<ProjectCreationData>) => void;
  onNext: () => void;
  onPrev: () => void;
  errors: Record<string, string>;
  categories: Category[];
  subcategories: SubCategory[];
  loading?: boolean;
}

// Category budget form interface
interface CategoryBudgetFormData {
  categoryId: string;
  subCategoryId: string;
  budgetedAmount: string; // string for form handling
}
```

#### **ProjectReviewStep**
```typescript
interface ProjectReviewStepProps {
  data: ProjectCreationData;
  onSubmit: () => void;
  onPrev: () => void;
  loading?: boolean;
  submitting?: boolean;
  categories: Category[];
  subcategories: SubCategory[];
}
```

---

### **Project Detail Components**

#### **ProjectDetailPage**
```typescript
interface ProjectDetailPageProps {
  projectId: string;
}

// Main project detail component (page-level)
const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({ projectId }) => {
  // Component implementation
};
```

#### **ProjectOverviewSection**
```typescript
interface ProjectOverviewSectionProps {
  project: ProjectBudget;
  progress: ProjectProgress;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: ProjectBudget['status']) => void;
  loading?: boolean;
}
```

#### **ProjectBudgetBreakdown**
```typescript
interface ProjectBudgetBreakdownProps {
  project: ProjectBudget;
  progress: ProjectProgress;
  onCategoryClick?: (categoryId: string, subCategoryId: string) => void;
  showTransactions?: boolean;
  compact?: boolean;
}

// Budget breakdown item interface
interface BudgetBreakdownItem {
  categoryId: string;
  categoryName: string;
  subCategoryId: string;
  subCategoryName: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercentage: number;
  status: 'under' | 'on-target' | 'over';
  transactionCount: number;
}
```

#### **ProjectFundingStatus**
```typescript
interface ProjectFundingStatusProps {
  project: ProjectBudget;
  onFundingEdit: (fundingId: string) => void;
  onAddFunding: () => void;
  compact?: boolean;
}

// Funding status display item
interface FundingStatusItem {
  type: FundingSource['type'];
  description: string;
  expected: number;
  available: number;
  utilized: number;
  utilizationPercentage: number;
  remainingCapacity: number;
  status: 'available' | 'depleted' | 'over-limit';
}
```

#### **ProjectTransactionsList**
```typescript
interface ProjectTransactionsListProps {
  projectId: string;
  project: ProjectBudget;
  onTransactionEdit: (transactionId: string) => void;
  onTagChange: (transactionId: string, tags: string[]) => void;
  showFilters?: boolean;
  pageSize?: number;
  categoryFilter?: string;
  subCategoryFilter?: string;
}

// Tagged transaction interface
interface ProjectTransaction {
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
```

#### **ProjectTimelineView**
```typescript
interface ProjectTimelineViewProps {
  project: ProjectBudget;
  progress: ProjectProgress;
  milestones?: ProjectMilestone[];
  onMilestoneAdd?: (milestone: Omit<ProjectMilestone, 'id'>) => void;
  onMilestoneEdit?: (milestoneId: string, data: Partial<ProjectMilestone>) => void;
  compact?: boolean;
}

// Project milestone interface (future enhancement)
interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  targetDate: Date;
  completedDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  type: 'funding' | 'budget' | 'deadline' | 'custom';
}
```

---

### **Project List Components**

#### **ProjectsListPage**
```typescript
interface ProjectsListPageProps {
  initialFilters?: Partial<ProjectFilters>;
  view?: 'grid' | 'list' | 'table';
  allowCreate?: boolean;
  allowBulkActions?: boolean;
  pageSize?: number;
}
```

#### **ProjectCard**
```typescript
interface ProjectCardProps {
  project: ProjectBudget;
  variant?: 'default' | 'compact' | 'detailed';
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: ProjectBudget['status']) => void;
  showActions?: boolean;
  showProgress?: boolean;
  showFunding?: boolean;
}
```

#### **ProjectFilters**
```typescript
interface ProjectFiltersProps {
  filters: ProjectFilters;
  onFiltersChange: (filters: Partial<ProjectFilters>) => void;
  onClearFilters: () => void;
  availableStatuses?: ProjectBudget['status'][];
  availablePriorities?: ProjectBudget['priority'][];
  availableFundingTypes?: FundingSource['type'][];
  compact?: boolean;
}
```

#### **ProjectSearch**
```typescript
interface ProjectSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  placeholder?: string;
  suggestions?: ProjectSearchSuggestion[];
  loading?: boolean;
}

interface ProjectSearchSuggestion {
  type: 'project' | 'category' | 'tag';
  value: string;
  label: string;
  count?: number;
}
```

#### **ProjectActions**
```typescript
interface ProjectActionsProps {
  selectedProjects: string[];
  onBulkStatusChange: (status: ProjectBudget['status']) => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
  onDeselectAll: () => void;
  loading?: boolean;
}
```

---

### **Project Editing Components**

#### **ProjectEditDialog**
```typescript
interface ProjectEditDialogProps {
  open: boolean;
  project: ProjectBudget;
  onClose: () => void;
  onSave: (data: Partial<ProjectBudget>) => void;
  loading?: boolean;
}
```

#### **ProjectStatusManager**
```typescript
interface ProjectStatusManagerProps {
  currentStatus: ProjectBudget['status'];
  onStatusChange: (status: ProjectBudget['status']) => void;
  allowedTransitions?: ProjectBudget['status'][];
  showConfirmation?: boolean;
  disabled?: boolean;
}

// Status transition configuration
interface StatusTransition {
  from: ProjectBudget['status'];
  to: ProjectBudget['status'];
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  warningMessage?: string;
}
```

#### **ProjectFundingEditor**
```typescript
interface ProjectFundingEditorProps {
  fundingSources: FundingSource[];
  onFundingChange: (sources: FundingSource[]) => void;
  onAddFunding: () => void;
  onRemoveFunding: (index: number) => void;
  totalBudget: number;
  errors?: Record<string, string>;
}
```

#### **ProjectBudgetEditor**
```typescript
interface ProjectBudgetEditorProps {
  categoryBudgets: CategoryBudget[];
  onBudgetChange: (budgets: CategoryBudget[]) => void;
  onAddCategory: () => void;
  onRemoveCategory: (index: number) => void;
  categories: Category[];
  subcategories: SubCategory[];
  totalFunding: number;
  errors?: Record<string, string>;
}
```

---

### **Shared Components**

#### **ProjectStatusChip**
```typescript
interface ProjectStatusChipProps {
  status: ProjectBudget['status'];
  variant?: 'default' | 'outlined' | 'filled';
  size?: 'small' | 'medium';
  clickable?: boolean;
  onClick?: () => void;
}
```

#### **ProjectProgressBar**
```typescript
interface ProjectProgressBarProps {
  value: number; // 0-100
  variant?: 'linear' | 'circular';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showPercentage?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  thickness?: number;
}
```

#### **ProjectMetrics**
```typescript
interface ProjectMetricsProps {
  project: ProjectBudget;
  metrics: ProjectMetric[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  variant?: 'default' | 'compact' | 'detailed';
}

interface ProjectMetric {
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
```

---

### **Dashboard Components (Phase 2)**

#### **ProjectsDashboard**
```typescript
interface ProjectsDashboardProps {
  userId: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  showAnalytics?: boolean;
  showRecentActivity?: boolean;
  compactView?: boolean;
}
```

#### **ProjectsOverview**
```typescript
interface ProjectsOverviewProps {
  projects: ProjectBudget[];
  loading?: boolean;
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
  onTimeframeChange?: (timeframe: string) => void;
}

interface ProjectsOverviewData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  averageProgress: number;
  projectsOnTrack: number;
  projectsOverBudget: number;
  upcomingDeadlines: number;
}
```

#### **ProjectsAnalytics**
```typescript
interface ProjectsAnalyticsProps {
  projects: ProjectBudget[];
  dateRange: {
    from: Date;
    to: Date;
  };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  metrics: ProjectAnalyticMetric[];
  charts: ProjectAnalyticChart[];
}

interface ProjectAnalyticMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  format: 'currency' | 'percentage' | 'count';
}

interface ProjectAnalyticChart {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: any[];
  config: any;
}
```

#### **ActiveProjectsWidget**
```typescript
interface ActiveProjectsWidgetProps {
  projects: ProjectBudget[];
  maxItems?: number;
  onViewAll?: () => void;
  onProjectClick?: (projectId: string) => void;
  showProgress?: boolean;
  showDeadlines?: boolean;
  variant?: 'default' | 'compact' | 'minimal';
}
```

---

## 🔧 **Hook Specifications**

### **Core Project Hooks**

#### **useProject**
```typescript
interface UseProjectResult {
  project: ProjectBudget | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  update: (data: Partial<ProjectBudget>) => Promise<void>;
  delete: () => Promise<void>;
}

const useProject = (projectId: string): UseProjectResult => {
  // Implementation
};
```

#### **useProjectList**
```typescript
interface UseProjectListResult {
  projects: ProjectBudget[];
  loading: boolean;
  error: string | null;
  filters: ProjectFilters;
  searchQuery: string;
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
  };
  
  // Actions
  setFilters: (filters: Partial<ProjectFilters>) => void;
  setSearchQuery: (query: string) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  createProject: (data: ProjectCreationData) => Promise<ProjectBudget>;
  
  // Computed values
  filteredProjects: ProjectBudget[];
  activeProjects: ProjectBudget[];
  completedProjects: ProjectBudget[];
}

const useProjectList = (initialFilters?: ProjectFilters): UseProjectListResult => {
  // Implementation
};
```

#### **useProjectProgress**
```typescript
interface UseProjectProgressResult {
  progress: ProjectProgress | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  
  // Real-time updates
  subscribeToUpdates: () => () => void; // Returns unsubscribe function
}

const useProjectProgress = (projectId: string): UseProjectProgressResult => {
  // Implementation
};
```

#### **useProjectCreation**
```typescript
interface UseProjectCreationResult {
  currentStep: number;
  totalSteps: number;
  formData: Partial<ProjectCreationData>;
  validation: Record<string, string>;
  isValid: boolean;
  isSubmitting: boolean;
  
  // Actions
  updateFormData: (data: Partial<ProjectCreationData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  validateStep: (step?: number) => boolean;
  submitProject: () => Promise<ProjectBudget>;
  resetForm: () => void;
  
  // State queries
  canProceed: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
}

const useProjectCreation = (initialData?: Partial<ProjectCreationData>): UseProjectCreationResult => {
  // Implementation
};
```

### **Utility Hooks**

#### **useProjectAnalytics**
```typescript
interface UseProjectAnalyticsResult {
  analytics: ProjectsOverviewData;
  charts: ProjectAnalyticChart[];
  metrics: ProjectAnalyticMetric[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  exportData: () => Promise<Blob>;
}

const useProjectAnalytics = (
  projects: ProjectBudget[],
  dateRange: { from: Date; to: Date }
): UseProjectAnalyticsResult => {
  // Implementation
};
```

#### **useProjectTransactions**
```typescript
interface UseProjectTransactionsResult {
  transactions: ProjectTransaction[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
  };
  
  // Actions
  loadMore: () => Promise<void>;
  tagTransaction: (transactionId: string, tags: string[]) => Promise<void>;
  untagTransaction: (transactionId: string, projectId: string) => Promise<void>;
  bulkTag: (transactionIds: string[], projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const useProjectTransactions = (
  projectId: string,
  filters?: {
    categoryId?: string;
    subCategoryId?: string;
    dateRange?: { from: Date; to: Date };
  }
): UseProjectTransactionsResult => {
  // Implementation
};
```

---

## 🎨 **Style Specifications**

### **Theme Integration**
```typescript
// Project-specific theme extensions
declare module '@mui/material/styles' {
  interface Theme {
    projects: {
      colors: {
        status: {
          planning: string;
          active: string;
          completed: string;
          cancelled: string;
        };
        funding: {
          ongoing_funds: string;
          loan: string;
          bonus: string;
          savings: string;
          other: string;
        };
        progress: {
          onTrack: string;
          warning: string;
          overBudget: string;
        };
      };
      spacing: {
        wizard: {
          stepPadding: number;
          buttonSpacing: number;
        };
        cards: {
          padding: number;
          margin: number;
        };
      };
      shadows: {
        card: string;
        cardHover: string;
        dialog: string;
      };
    };
  }
}
```

### **Component Styling Patterns**
```typescript
// Consistent styling patterns for project components
const useProjectStyles = () => {
  const theme = useTheme();
  
  return {
    projectCard: {
      padding: theme.projects.spacing.cards.padding,
      margin: theme.projects.spacing.cards.margin,
      borderRadius: theme.shape.borderRadius,
      boxShadow: theme.projects.shadows.card,
      transition: theme.transitions.create(['box-shadow', 'transform']),
      '&:hover': {
        boxShadow: theme.projects.shadows.cardHover,
        transform: 'translateY(-2px)'
      }
    },
    statusChip: (status: ProjectBudget['status']) => ({
      backgroundColor: theme.projects.colors.status[status],
      color: theme.palette.getContrastText(theme.projects.colors.status[status])
    }),
    progressBar: (value: number) => ({
      backgroundColor: value > 100 
        ? theme.projects.colors.progress.overBudget
        : value > 80 
        ? theme.projects.colors.progress.warning
        : theme.projects.colors.progress.onTrack
    }),
    fundingChip: (type: FundingSource['type']) => ({
      backgroundColor: theme.projects.colors.funding[type],
      color: theme.palette.getContrastText(theme.projects.colors.funding[type])
    })
  };
};
```

---

## 🧪 **Testing Interfaces**

### **Test Utilities**
```typescript
// Testing helper interfaces and utilities
interface ProjectTestUtils {
  renderWithProjectContext: (
    component: ReactElement,
    contextOverrides?: Partial<ProjectContextType>
  ) => RenderResult;
  
  createMockProject: (overrides?: Partial<ProjectBudget>) => ProjectBudget;
  createMockProjectProgress: (overrides?: Partial<ProjectProgress>) => ProjectProgress;
  createMockFundingSource: (overrides?: Partial<FundingSource>) => FundingSource;
  
  mockProjectsApi: {
    getProjects: jest.MockedFunction<typeof projectsApi.getProjects>;
    getProject: jest.MockedFunction<typeof projectsApi.getProject>;
    createProject: jest.MockedFunction<typeof projectsApi.createProject>;
    updateProject: jest.MockedFunction<typeof projectsApi.updateProject>;
    deleteProject: jest.MockedFunction<typeof projectsApi.deleteProject>;
    getProjectProgress: jest.MockedFunction<typeof projectsApi.getProjectProgress>;
  };
}

// Component test props interfaces
interface ProjectComponentTestProps<T> {
  component: React.ComponentType<T>;
  defaultProps: T;
  variants?: Array<{
    name: string;
    props: Partial<T>;
  }>;
  interactions?: Array<{
    name: string;
    action: (component: RenderResult) => Promise<void>;
    assertion: (component: RenderResult) => void;
  }>;
}
```

---

*Last Updated: August 18, 2025*
*Status: Complete component specifications for Projects feature*

---

**Component Specifications**: **Comprehensive TypeScript interfaces and props for all project components**
**Ready for**: Sprint 1 implementation with full type safety and clear contracts
