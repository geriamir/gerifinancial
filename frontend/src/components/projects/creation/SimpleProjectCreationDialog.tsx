import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  BeachAccess as VacationIcon,
  Home as HomeIcon,
  TrendingUp as InvestmentIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useNavigate } from 'react-router-dom';
import { ProjectCreationData, ProjectBudget, ProjectType } from '../../../types/projects';
import { useProject } from '../../../contexts/ProjectContext';

interface SimpleProjectCreationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: ProjectBudget) => void;
}

const PROJECT_TYPE_OPTIONS = [
  {
    value: 'vacation' as ProjectType,
    label: 'Vacation',
    description: 'Plan and budget for your vacation expenses',
    icon: VacationIcon,
    color: '#FF6B6B'
  },
  {
    value: 'home_renovation' as ProjectType,
    label: 'Home Renovation',
    description: 'Track expenses for home improvement projects',
    icon: HomeIcon,
    color: '#4ECDC4'
  },
  {
    value: 'investment' as ProjectType,
    label: 'Investment',
    description: 'Track investment-related expenses and goals',
    icon: InvestmentIcon,
    color: '#45B7D1'
  }
];

const SimpleProjectCreationDialog: React.FC<SimpleProjectCreationDialogProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const { createProject } = useProject();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<ProjectCreationData>({
    name: '',
    type: 'vacation',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    currency: 'ILS'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const projectNameRef = useRef<HTMLInputElement>(null);

  // Focus on project name when dialog opens
  useEffect(() => {
    if (open) {
      // Longer delay to ensure dialog focus trap is established first
      const timer = setTimeout(() => {
        if (projectNameRef.current) {
          projectNameRef.current.focus();
          projectNameRef.current.select(); // Also select the text if any
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleFieldChange = (field: keyof ProjectCreationData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const value = event.target ? event.target.value : event;
    
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // If changing project type, auto-update end date based on new project type duration
      if (field === 'type') {
        let defaultDurationDays = 7; // Default 1 week
        
        switch (value) {
          case 'vacation':
            defaultDurationDays = 7; // 1 week vacation
            break;
          case 'home_renovation':
            defaultDurationDays = 30; // 1 month renovation
            break;
          case 'investment':
            defaultDurationDays = 90; // 3 months investment project
            break;
          default:
            defaultDurationDays = 7;
        }
        
        const newEndDate = new Date(prev.startDate);
        newEndDate.setDate(newEndDate.getDate() + defaultDurationDays);
        newData.endDate = newEndDate;
      }
      
      return newData;
    });
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate') => (date: Date | null) => {
    if (date) {
      setFormData(prev => {
        const newData = { ...prev, [field]: date };
        
        // If changing start date, auto-update end date based on project type
        if (field === 'startDate') {
          let defaultDurationDays = 7; // Default 1 week
          
          // Set different default durations based on project type
          switch (prev.type) {
            case 'vacation':
              defaultDurationDays = 7; // 1 week vacation
              break;
            case 'home_renovation':
              defaultDurationDays = 30; // 1 month renovation
              break;
            case 'investment':
              defaultDurationDays = 90; // 3 months investment project
              break;
            default:
              defaultDurationDays = 7;
          }
          
          const newEndDate = new Date(date);
          newEndDate.setDate(newEndDate.getDate() + defaultDurationDays);
          
          // Only update end date if it's currently before the new start date
          if (prev.endDate <= date) {
            newData.endDate = newEndDate;
          }
        }
        
        return newData;
      });
      
      // Clear error for this field
      if (errors[field]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Project name must be less than 100 characters';
    }
    
    if (!formData.type) {
      newErrors.type = 'Project type is required';
    }
    
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    } else if (formData.startDate && formData.endDate <= formData.startDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    
    if (!formData.currency) {
      newErrors.currency = 'Currency is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      const project = await createProject(formData);
      onSuccess(project);
      handleClose();
      
      // Small delay to ensure context is updated before navigation
      setTimeout(() => {
        navigate(`/projects/${project._id}`);
      }, 100);
    } catch (error) {
      console.error('Failed to create project:', error);
      // Error is handled by context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        name: '',
        type: 'vacation',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currency: 'ILS'
      });
      setErrors({});
      onClose();
    }
  };

  const selectedProjectType = PROJECT_TYPE_OPTIONS.find(option => option.value === formData.type);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      TransitionProps={{
        onEntered: () => {
          // Focus after the dialog transition completes
          setTimeout(() => {
            if (projectNameRef.current) {
              projectNameRef.current.focus();
              projectNameRef.current.select();
            }
          }, 50);
        }
      }}
      PaperProps={{
        sx: {
          minHeight: '600px'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Create New Project
          </Typography>
          <IconButton
            onClick={handleClose}
            disabled={isSubmitting}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Box display="flex" flexDirection="column" gap={3} mt={1}>
          {/* Project Name */}
          <TextField
            fullWidth
            label="Project Name"
            value={formData.name}
            onChange={handleFieldChange('name')}
            error={!!errors.name}
            helperText={errors.name || 'Give your project a clear, descriptive name'}
            disabled={isSubmitting}
            inputProps={{ maxLength: 100 }}
            inputRef={projectNameRef}
            required
          />

          {/* Project Type Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Project Type *
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {PROJECT_TYPE_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                return (
                  <Card
                    key={option.value}
                    sx={{
                      cursor: 'pointer',
                      border: formData.type === option.value ? 2 : 1,
                      borderColor: formData.type === option.value ? option.color : 'grey.300',
                      '&:hover': {
                        borderColor: option.color,
                        boxShadow: 1
                      }
                    }}
                    onClick={() => handleFieldChange('type')({ target: { value: option.value } })}
                  >
                    <CardContent sx={{ py: 2 }}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <IconComponent sx={{ color: option.color, fontSize: 28 }} />
                        <Box flex={1}>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {option.label}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {option.description}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
            {errors.type && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {errors.type}
              </Typography>
            )}
          </Box>

          {/* Date Range */}
          <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
            <DatePicker
              label="Start Date"
              value={formData.startDate}
              onChange={handleDateChange('startDate')}
              disabled={isSubmitting}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.startDate,
                  helperText: errors.startDate || 'When will this project begin?',
                  required: true
                }
              }}
            />

            <DatePicker
              label="End Date"
              value={formData.endDate}
              onChange={handleDateChange('endDate')}
              disabled={isSubmitting}
              minDate={formData.startDate || undefined}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.endDate,
                  helperText: errors.endDate || 'When should this project be completed?',
                  required: true
                }
              }}
            />
          </Box>

          {/* Currency */}
          <FormControl 
            fullWidth 
            disabled={isSubmitting}
            error={!!errors.currency}
            required
          >
            <InputLabel>Currency</InputLabel>
            <Select
              value={formData.currency}
              onChange={handleFieldChange('currency')}
              label="Currency"
            >
              <MenuItem value="ILS">ILS (₪)</MenuItem>
              <MenuItem value="USD">USD ($)</MenuItem>
              <MenuItem value="EUR">EUR (€)</MenuItem>
              <MenuItem value="GBP">GBP (£)</MenuItem>
            </Select>
            <FormHelperText>
              {errors.currency || 'The primary currency for this project'}
            </FormHelperText>
          </FormControl>

          {/* Info Alert */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>What happens next?</strong><br />
              • Your project will be created with template budget categories for {selectedProjectType?.label}<br />
              • You can add funding sources and edit budget allocations after creation<br />
              • A project tag will be created for tracking related transactions
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={handleClose}
          disabled={isSubmitting}
          size="large"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isSubmitting}
          endIcon={<SaveIcon />}
          size="large"
        >
          {isSubmitting ? 'Creating Project...' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SimpleProjectCreationDialog;
