import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { formatCurrencyDisplay } from '../../utils/formatters';
import type { ProjectBudget } from '../../services/api/budgets';

interface ProjectBudgetsListProps {
  projectBudgets: ProjectBudget[];
  loading?: boolean;
  onNewProject: () => void;
}

const ProjectBudgetsList: React.FC<ProjectBudgetsListProps> = ({
  projectBudgets,
  loading = false,
  onNewProject
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'planning': return 'warning';
      case 'on-hold': return 'error';
      default: return 'default';
    }
  };

  if (!projectBudgets || projectBudgets.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mt: 4 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Active Projects</Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            size="small"
            disabled={loading}
            onClick={onNewProject}
          >
            New Project
          </Button>
        </Box>

        <Box>
          {projectBudgets.slice(0, 5).map((project) => (
            <Box
              key={project._id}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              p={2}
              border={1}
              borderColor="grey.200"
              borderRadius={1}
              mb={1}
            >
              <Box>
                <Typography variant="subtitle1">{project.name}</Typography>
                <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                  <Chip
                    label={project.status}
                    color={getStatusColor(project.status) as any}
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {project.daysRemaining} days remaining
                  </Typography>
                </Box>
              </Box>
              <Box textAlign="right">
                <Typography variant="body2" color="text.secondary">
                  {project.progressPercentage.toFixed(1)}% complete
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={project.progressPercentage}
                  sx={{ width: 100, mt: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {formatCurrencyDisplay(project.remainingBudget)} remaining
                </Typography>
              </Box>
            </Box>
          ))}
          {projectBudgets.length > 5 && (
            <Button variant="text" fullWidth sx={{ mt: 1 }}>
              View All Projects ({projectBudgets.length})
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProjectBudgetsList;
