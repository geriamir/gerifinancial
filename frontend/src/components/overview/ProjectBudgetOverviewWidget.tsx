/**
 * PROJECT BUDGET OVERVIEW WIDGET
 * 
 * Displays active project budget summaries on the main Overview page
 * Shows project progress, budget utilization, and recent activity
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  Grid,
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Folder as ProjectIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Launch as LaunchIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { budgetsApi } from '../../services/api/budgets';

interface ProjectSummary {
  _id: string;
  name: string;
  status: string;
  totalBudget: number;
  totalSpent: number;
  currency: string;
  progress: number;
  isOverBudget: boolean;
  categoryCount: number;
  recentActivity: string;
}

interface ProjectBudgetOverviewWidgetProps {
  maxProjects?: number;
}

const ProjectBudgetOverviewWidget: React.FC<ProjectBudgetOverviewWidgetProps> = ({
  maxProjects = 4
}) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjectSummaries = async () => {
      try {
        setLoading(true);
        const response = await budgetsApi.getDashboardOverview();
        
        if (response.success && response.data?.activeProjects) {
          // Filter and process active projects
          const activeProjects = response.data.activeProjects
            .sort((a: any, b: any) => {
              // Sort by progress (over-budget projects first, then by completion percentage)
              const aOverBudget = a.progress > 100;
              const bOverBudget = b.progress > 100;
              if (aOverBudget !== bOverBudget) {
                return aOverBudget ? -1 : 1;
              }
              return b.progress - a.progress;
            })
            .slice(0, maxProjects)
            .map((project: any) => ({
              _id: project.id || project._id,
              name: project.name,
              status: 'active',
              totalBudget: project.remainingBudget && project.progress ? 
                Math.round(project.remainingBudget / (1 - project.progress / 100)) : 0,
              totalSpent: project.remainingBudget && project.progress ? 
                Math.round((project.remainingBudget / (1 - project.progress / 100)) * (project.progress / 100)) : 0,
              currency: 'ILS',
              progress: Math.round(project.progress || 0),
              isOverBudget: (project.progress || 0) > 100,
              categoryCount: 0, // Will be populated from detailed project data if needed
              recentActivity: new Date().toISOString()
            }));

          setProjects(activeProjects);
        } else {
          // Fallback to project budgets API if dashboard doesn't have activeProjects
          const projectsResponse = await budgetsApi.getProjectBudgets({ status: 'active', limit: maxProjects });
          
          const activeProjects = (projectsResponse.projects || [])
            .slice(0, maxProjects)
            .map((project: any) => ({
              _id: project._id,
              name: project.name,
              status: project.status,
              totalBudget: project.totalBudget || 0,
              totalSpent: project.totalSpent || 0,
              currency: project.currency || 'ILS',
              progress: Math.round(((project.totalSpent || 0) / (project.totalBudget || 1)) * 100),
              isOverBudget: (project.totalSpent || 0) > (project.totalBudget || 0),
              categoryCount: project.categoryBudgets?.length || 0,
              recentActivity: project.updatedAt || project.createdAt || new Date().toISOString()
            }));

          setProjects(activeProjects);
        }
      } catch (err) {
        console.error('Error fetching project summaries:', err);
        setError('Failed to load project summaries');
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectSummaries();
  }, [maxProjects]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getProgressColor = (progress: number, isOverBudget: boolean) => {
    if (isOverBudget) return 'error';
    if (progress >= 80) return 'warning';
    if (progress >= 60) return 'info';
    return 'success';
  };

  const getStatusIcon = (progress: number, isOverBudget: boolean) => {
    if (isOverBudget) {
      return <WarningIcon color="error" fontSize="small" />;
    }
    if (progress >= 90) {
      return <CheckCircleIcon color="success" fontSize="small" />;
    }
    return <TrendingUpIcon color="primary" fontSize="small" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Project Budgets
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <LinearProgress sx={{ width: '100%' }} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom color="error">
            Project Budgets
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3
        }}>
          <Typography variant="h6">
            Active Projects
          </Typography>
          <Button
            size="small"
            endIcon={<LaunchIcon />}
            onClick={() => navigate('/projects')}
          >
            View All
          </Button>
        </Box>

        {projects.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ProjectIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No active projects found
            </Typography>
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => navigate('/projects')}
            >
              Create Project
            </Button>
          </Box>
        ) : (
          <Box sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            flexWrap: 'wrap',
            gap: 2
          }}>
            {projects.map((project) => (
              <Box key={project._id} sx={{ 
                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)' },
                minWidth: 0
              }}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '100%',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 2
                    }
                  }}
                  onClick={() => navigate('/projects')}
                >
                  <CardContent sx={{ pb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                      <ProjectIcon sx={{ mr: 1, mt: 0.5, color: 'primary.main' }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {project.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                          {getStatusIcon(project.progress, project.isOverBudget)}
                          <Typography variant="caption" color="text.secondary">
                            {project.categoryCount} categories
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {project.progress}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(project.progress, 100)}
                        color={getProgressColor(project.progress, project.isOverBudget)}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Spent / Budget
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(project.totalSpent, project.currency)} / {formatCurrency(project.totalBudget, project.currency)}
                        </Typography>
                      </Box>
                      {project.isOverBudget && (
                        <Chip 
                          label="Over Budget" 
                          size="small" 
                          color="error" 
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        )}

        {projects.length > 0 && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Showing {projects.length} of your active projects
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectBudgetOverviewWidget;
