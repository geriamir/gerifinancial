import React from 'react';
import {
  Paper,
  Typography
} from '@mui/material';
import {
  getSegmentDescription,
  type ProjectOverviewSegment
} from '../../utils/projectOverviewHelper';

// Shared Tooltip Component Props Interface
interface ProjectOverviewTooltipProps {
  segment: ProjectOverviewSegment;
  totalFunding: number;
  totalBudget: number;
  totalPaid: number;
  currency: string;
}

// Common Tooltip Component for both Pie Chart and Progress Bar
const ProjectOverviewTooltip: React.FC<ProjectOverviewTooltipProps> = ({ 
  segment, 
  totalFunding, 
  totalBudget, 
  totalPaid, 
  currency 
}) => {
  return (
    <Paper sx={{ p: 1.5, maxWidth: 250, boxShadow: 3 }}>
      <Typography variant="body2" fontWeight="bold" gutterBottom>
        {segment.name}
      </Typography>
      <Typography variant="body2" color="primary" gutterBottom>
        {segment.formattedValue} ({segment.percentage}%)
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {getSegmentDescription(segment.name, totalFunding, totalBudget, totalPaid, currency)}
      </Typography>
    </Paper>
  );
};

export default ProjectOverviewTooltip;
