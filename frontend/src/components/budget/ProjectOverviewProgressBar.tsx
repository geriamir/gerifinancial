import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tooltip
} from '@mui/material';
import {
  calculateProjectOverviewData,
  type ProjectOverviewSegment
} from '../../utils/projectOverviewHelper';
import ProjectOverviewTooltip from './ProjectOverviewTooltip';

// Component Props Interface
interface ProjectOverviewProgressBarProps {
  totalFunding: number;
  totalBudget: number;
  totalPaid: number;
  totalUnplanned?: number;
  currency: string;
  height?: number;
}

// Individual progress segment component
interface ProgressSegmentProps {
  segment: ProjectOverviewSegment;
  totalValue: number;
  height: number;
  totalFunding: number;
  totalBudget: number;
  totalPaid: number;
  currency: string;
}

const ProgressSegment: React.FC<ProgressSegmentProps> = ({
  segment,
  totalValue,
  height,
  totalFunding,
  totalBudget,
  totalPaid,
  currency
}) => {
  const widthPercentage = totalValue > 0 ? (segment.value / totalValue) * 100 : 0;
  
  return (
    <Tooltip
      title={
        <ProjectOverviewTooltip
          segment={segment}
          totalFunding={totalFunding}
          totalBudget={totalBudget}
          totalPaid={totalPaid}
          currency={currency}
        />
      }
      arrow
      placement="top"
      componentsProps={{
        tooltip: {
          sx: {
            backgroundColor: 'transparent',
            padding: 0,
            border: 'none',
            boxShadow: 'none',
            '& .MuiTooltip-arrow': {
              color: 'rgba(97, 97, 97, 0.9)',
            },
          },
        },
      }}
    >
      <Box
        sx={{
          width: `${widthPercentage}%`,
          height: height,
          backgroundColor: segment.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            filter: 'brightness(1.1)',
            transform: 'scaleY(1.05)',
          },
          // Add border between segments for better visual separation
          borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
          '&:first-of-type': {
            borderLeft: 'none',
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
          },
          '&:last-of-type': {
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
          }
        }}
      >
        {/* Show percentage text only if segment is large enough */}
        {widthPercentage > 15 && (
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
              fontSize: '0.75rem'
            }}
          >
            {segment.percentage}%
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};


// Main Component
const ProjectOverviewProgressBar: React.FC<ProjectOverviewProgressBarProps> = ({
  totalFunding,
  totalBudget,
  totalPaid,
  totalUnplanned = 0,
  currency,
  height = 40
}) => {
  // Memoize the project overview data calculation
  const overviewData = useMemo(() => {
    return calculateProjectOverviewData(totalFunding, totalBudget, totalPaid, currency, totalUnplanned);
  }, [totalFunding, totalBudget, totalPaid, currency, totalUnplanned]);

  // Handle empty data case
  if (overviewData.totalValue === 0) {
    return (
      <Box sx={{ py: 2 }}>
        <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'grey.50' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Budget Data
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add funding sources and budget items to see the overview
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {/* Progress Bar Container */}
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          height: height,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: 2,
          mb: 2
        }}
      >
        {overviewData.segments.map((segment, index) => (
          <ProgressSegment
            key={index}
            segment={segment}
            totalValue={overviewData.totalValue}
            height={height}
            totalFunding={totalFunding}
            totalBudget={totalBudget}
            totalPaid={totalPaid}
            currency={currency}
          />
        ))}
      </Box>
    </Box>
  );
};

export default ProjectOverviewProgressBar;
