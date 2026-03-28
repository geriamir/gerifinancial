import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { Add as AddIcon, Delete } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyDisplay } from '../../utils/formatters';
import type { ProjectBudget } from '../../types/projects';
import SimpleProjectCreationDialog from '../projects/creation/SimpleProjectCreationDialog';
import { useProject } from '../../contexts/ProjectContext';

interface ProjectBudgetsListProps {
  projectBudgets: ProjectBudget[];
  loading?: boolean;
  onNewProject?: () => void;
  onProjectCreated?: (project: any) => void;
}

const ProjectBudgetsList: React.FC<ProjectBudgetsListProps> = ({
  projectBudgets,
  loading = false,
  onNewProject,
  onProjectCreated
}) => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectBudget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { deleteProject } = useProject();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'planning': return 'warning';
      case 'on-hold': return 'error';
      default: return 'default';
    }
  };

  const handleNewProject = () => {
    console.log('New project clicked - opening wizard'); // Debug log
    if (onNewProject) {
      console.log('Using onNewProject prop'); // Debug log
      onNewProject();
    } else {
      console.log('Opening wizard directly'); // Debug log
      setIsWizardOpen(true);
    }
  };

  const handleProjectCreated = (project: any) => {
    setIsWizardOpen(false);
    if (onProjectCreated) {
      onProjectCreated(project);
    }
  };

  const handleWizardClose = () => {
    setIsWizardOpen(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: ProjectBudget) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete._id);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!projectBudgets || projectBudgets.length === 0) {
    return (
      <>
        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Projects</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                size="small"
                disabled={loading}
                onClick={handleNewProject}
              >
                Create Your First Project
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              No projects yet. Create your first project to start tracking your budget goals.
            </Typography>
          </CardContent>
        </Card>

        {/* Project Creation Dialog */}
        <SimpleProjectCreationDialog
          open={isWizardOpen}
          onClose={handleWizardClose}
          onSuccess={handleProjectCreated}
        />
      </>
    );
  }

  return (
    <>
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Active Projects</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              size="small"
              disabled={loading}
              onClick={handleNewProject}
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
                borderColor="divider"
                borderRadius={1}
                mb={1}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main'
                  }
                }}
                onClick={() => navigate(`/projects/${project._id}`)}
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
                <Box textAlign="right" display="flex" alignItems="center" gap={1}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {project.progress.toFixed(1)}% complete
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={project.progress}
                      sx={{ width: 100, mt: 0.5 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatCurrencyDisplay(project.remainingBudget)} remaining
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => handleDeleteClick(e, project)}
                    title="Delete project"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
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

      {/* Project Creation Dialog */}
      <SimpleProjectCreationDialog
        open={isWizardOpen}
        onClose={handleWizardClose}
        onSuccess={handleProjectCreated}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setProjectToDelete(null); }}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &quot;<strong>{projectToDelete?.name}</strong>&quot;? This will remove the project and its budget allocations. Tagged transactions will not be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setProjectToDelete(null); }} disabled={isDeleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteProject} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProjectBudgetsList;
