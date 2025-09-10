import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Divider
} from '@mui/material';
import {
  PieChart as PieChartIcon,
  LinearScale as ProgressBarIcon
} from '@mui/icons-material';
import ProjectOverviewPieChart from './ProjectOverviewPieChart';
import ProjectOverviewProgressBar from './ProjectOverviewProgressBar';
import { calculateProjectOverviewData } from '../../utils/projectOverviewHelper';

// Component Props Interface
interface ProjectOverviewVisualizationProps {
  totalFunding: number;
  totalBudget: number;
  totalPaid: number;
  totalUnplanned?: number;
  currency: string;
  defaultView?: 'pie' | 'progress';
  size?: number;
  progressBarHeight?: number;
}

// Visualization type
type VisualizationType = 'pie' | 'progress';

// Local storage key for user preference
const BUDGET_VISUALIZATION_PREFERENCE_KEY = 'budgetVisualizationPreference';

// Helper functions for localStorage
const getUserPreference = (): VisualizationType | null => {
  try {
    const saved = localStorage.getItem(BUDGET_VISUALIZATION_PREFERENCE_KEY);
    if (saved === 'pie' || saved === 'progress') {
      return saved;
    }
  } catch (error) {
    console.warn('Failed to read budget visualization preference from localStorage:', error);
  }
  return null;
};

const saveUserPreference = (preference: VisualizationType): void => {
  try {
    localStorage.setItem(BUDGET_VISUALIZATION_PREFERENCE_KEY, preference);
  } catch (error) {
    console.warn('Failed to save budget visualization preference to localStorage:', error);
  }
};

// Main Component
const ProjectOverviewVisualization: React.FC<ProjectOverviewVisualizationProps> = ({
  totalFunding,
  totalBudget,
  totalPaid,
  totalUnplanned = 0,
  currency,
  defaultView = 'pie',
  size = 280,
  progressBarHeight = 40
}) => {
  // Initialize state with user preference or default
  const [viewType, setViewType] = useState<VisualizationType>(() => {
    const userPreference = getUserPreference();
    return userPreference || defaultView;
  });

  // Save preference when view type changes
  useEffect(() => {
    saveUserPreference(viewType);
  }, [viewType]);

  // Handle view type change
  const handleViewChange = (
    event: React.MouseEvent<HTMLElement>,
    newViewType: VisualizationType
  ) => {
    if (newViewType !== null) {
      setViewType(newViewType);
    }
  };

  // Get overview data
  const overviewData = calculateProjectOverviewData(totalFunding, totalBudget, totalPaid, currency, totalUnplanned);

  // Handle empty data case
  if (overviewData.totalValue === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Budget Data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add funding sources and budget items to see the project overview
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Toggle */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2 
      }}>
        <Typography variant="h6">
          {overviewData.title}
        </Typography>
        
        <ToggleButtonGroup
          value={viewType}
          exclusive
          onChange={handleViewChange}
          size="small"
          aria-label="visualization type"
        >
          <ToggleButton value="pie" aria-label="pie chart">
            <PieChartIcon sx={{ mr: 1 }} />
            Pie Chart
          </ToggleButton>
          <ToggleButton value="progress" aria-label="progress bar">
            <ProgressBarIcon sx={{ mr: 1 }} />
            Progress Bar
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Visualization Content */}
      <Box>
        {viewType === 'pie' ? (
          <ProjectOverviewPieChart
            totalFunding={totalFunding}
            totalBudget={totalBudget}
            totalPaid={totalPaid}
            totalUnplanned={totalUnplanned}
            currency={currency}
            size={size}
          />
        ) : (
          <ProjectOverviewProgressBar
            totalFunding={totalFunding}
            totalBudget={totalBudget}
            totalPaid={totalPaid}
            totalUnplanned={totalUnplanned}
            currency={currency}
            height={progressBarHeight}
          />
        )}
      </Box>
    </Box>
  );
};

export default ProjectOverviewVisualization;
