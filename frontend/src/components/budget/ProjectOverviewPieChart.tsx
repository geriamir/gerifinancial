import React, { useMemo } from 'react';
import {
  Box,
  Typography
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import {
  calculateProjectOverviewData
} from '../../utils/projectOverviewHelper';
import ProjectOverviewTooltip from './ProjectOverviewTooltip';

// Component Props Interface
interface ProjectOverviewPieChartProps {
  totalFunding: number;
  totalBudget: number;
  totalPaid: number;
  totalUnplanned?: number;
  currency: string;
  size?: number;
}

// Custom Tooltip Component for Recharts
const CustomTooltip: React.FC<any> = ({ active, payload, totalFunding, totalBudget, totalPaid, currency }) => {
  if (active && payload && payload.length) {
    const segment = payload[0].payload;
    
    return (
      <ProjectOverviewTooltip
        segment={segment}
        totalFunding={totalFunding}
        totalBudget={totalBudget}
        totalPaid={totalPaid}
        currency={currency}
      />
    );
  }
  return null;
};


// Main Component
const ProjectOverviewPieChart: React.FC<ProjectOverviewPieChartProps> = ({
  totalFunding,
  totalBudget,
  totalPaid,
  totalUnplanned = 0,
  currency,
  size = 280
}) => {
  // Memoize the pie chart data calculation
  const pieChartData = useMemo(() => {
    return calculateProjectOverviewData(totalFunding, totalBudget, totalPaid, currency, totalUnplanned);
  }, [totalFunding, totalBudget, totalPaid, currency, totalUnplanned]);

  // Handle empty data case
  if (pieChartData.totalValue === 0) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: size,
          flexDirection: 'column'
        }}
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Budget Data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add funding sources and budget items to see the overview
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        py: 2
      }}
    >
      {/* Pie Chart */}
      <Box sx={{ 
        width: size, 
        height: size,
        position: 'relative'
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieChartData.segments}
              cx="50%"
              cy="50%"
              outerRadius={size * 0.35}
              innerRadius={size * 0.15}
              paddingAngle={2}
              dataKey="value"
            >
              {pieChartData.segments.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              content={
                <CustomTooltip 
                  totalFunding={totalFunding}
                  totalBudget={totalBudget}
                  totalPaid={totalPaid}
                  currency={currency}
                />
              } 
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default ProjectOverviewPieChart;
