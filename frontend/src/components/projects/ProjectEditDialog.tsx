import React, { useState, useEffect } from 'react';
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
  Tabs,
  Tab,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ProjectBudget, FundingSource } from '../../types/projects';
import { useProject } from '../../contexts/ProjectContext';

interface ProjectEditDialogProps {
  open: boolean;
  project: ProjectBudget;
  onClose: () => void;
  onSuccess: (project: ProjectBudget) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`project-edit-tabpanel-${index}`}
      aria-labelledby={`project-edit-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const FUNDING_SOURCE_TYPES = [
  { value: 'ongoing_funds', label: 'Ongoing Funds' },
  { value: 'loan', label: 'Loan' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' }
];

const ProjectEditDialog: React.FC<ProjectEditDialogProps> = ({
  open,
  project,
  onClose,
  onSuccess
}) => {
  const { updateProject } = useProject();
  
  const [activeTab, setActiveTab] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Form data state
  const [formData, setFormData] = useState({
    name: '',
    startDate: new Date(),
    endDate: new Date(),
    status: 'planning' as ProjectBudget['status'],
    priority: 'medium' as ProjectBudget['priority'],
    notes: ''
  });
  
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([]);

  // Initialize form data when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        startDate: new Date(project.startDate),
        endDate: new Date(project.endDate),
        status: project.status,
        priority: project.priority || 'medium',
        notes: project.notes || ''
      });
      setFundingSources(project.fundingSources || []);
    }
  }, [project]);

  const handleFieldChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const value = event.target ? event.target.value : event;
    
    setFormData(prev => ({ ...prev, [field]: value }));
    
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
      setFormData(prev => ({ ...prev, [field]: date }));
      
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

  const handleAddFundingSource = () => {
    const newSource: FundingSource = {
      type: 'ongoing_funds',
      description: '',
      expectedAmount: 0,
      availableAmount: 0,
      currency: project.currency
    };
    setFundingSources(prev => [...prev, newSource]);
  };

  const handleFundingSourceChange = (index: number, field: keyof FundingSource, value: any) => {
    setFundingSources(prev => 
      prev.map((source, i) => 
        i === index ? { ...source, [field]: value } : source
      )
    );
  };

  const handleRemoveFundingSource = (index: number) => {
    setFundingSources(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Project name is required';
    }
    
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    } else if (formData.startDate && formData.endDate <= formData.startDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    
    // Validate funding sources
    fundingSources.forEach((source, index) => {
      if (!source.description?.trim()) {
        newErrors[`funding_${index}_description`] = 'Description is required';
      }
      if (source.expectedAmount < 0) {
        newErrors[`funding_${index}_expected`] = 'Expected amount must be positive';
      }
      if (source.availableAmount < 0) {
        newErrors[`funding_${index}_available`] = 'Available amount must be positive';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      
      const updateData = {
        ...formData,
        fundingSources: fundingSources.filter(source => 
          source.description?.trim() || source.expectedAmount > 0
        )
      };
      
      const updatedProject = await updateProject(project._id, updateData);
      onSuccess(updatedProject);
      handleClose();
    } catch (error) {
      console.error('Failed to update project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setActiveTab(0);
      setErrors({});
      onClose();
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '700px'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Edit Project: {project?.name}
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
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="project edit tabs">
            <Tab label="Basic Details" />
            <Tab label="Funding Sources" />
            <Tab label="Settings" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <Box display="flex" flexDirection="column" gap={3}>
            {/* Project Name */}
            <TextField
              fullWidth
              label="Project Name"
              value={formData.name}
              onChange={handleFieldChange('name')}
              error={!!errors.name}
              helperText={errors.name}
              disabled={isSubmitting}
              required
            />


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
                    helperText: errors.startDate,
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
                    helperText: errors.endDate,
                    required: true
                  }
                }}
              />
            </Box>

            {/* Status */}
            <FormControl fullWidth disabled={isSubmitting}>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={handleFieldChange('status')}
                label="Status"
              >
                <MenuItem value="planning">Planning</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
              <FormHelperText>Current status of the project</FormHelperText>
            </FormControl>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">Funding Sources</Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddFundingSource}
                variant="outlined"
                disabled={isSubmitting}
              >
                Add Funding Source
              </Button>
            </Box>

            {fundingSources.length === 0 ? (
              <Alert severity="info">
                No funding sources defined. Click "Add Funding Source" to add the first one.
              </Alert>
            ) : (
              <Box display="flex" flexDirection="column" gap={2}>
                {fundingSources.map((source, index) => (
                  <Card key={index} variant="outlined">
                    <CardContent>
                      <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          Funding Source #{index + 1}
                        </Typography>
                        <IconButton
                          onClick={() => handleRemoveFundingSource(index)}
                          disabled={isSubmitting}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>

                      <Box display="flex" flexDirection="column" gap={2}>
                        {/* Type and Description */}
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                          <FormControl sx={{ minWidth: 150 }} disabled={isSubmitting}>
                            <InputLabel>Type</InputLabel>
                            <Select
                              value={source.type}
                              onChange={(e) => handleFundingSourceChange(index, 'type', e.target.value)}
                              label="Type"
                            >
                              {FUNDING_SOURCE_TYPES.map(option => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>

                          <TextField
                            fullWidth
                            label="Description"
                            value={source.description}
                            onChange={(e) => handleFundingSourceChange(index, 'description', e.target.value)}
                            error={!!errors[`funding_${index}_description`]}
                            helperText={errors[`funding_${index}_description`]}
                            disabled={isSubmitting}
                            required
                          />
                        </Box>

                        {/* Amounts */}
                        <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }}>
                          <TextField
                            fullWidth
                            label="Expected Amount"
                            type="number"
                            value={source.expectedAmount}
                            onChange={(e) => handleFundingSourceChange(index, 'expectedAmount', Number(e.target.value))}
                            error={!!errors[`funding_${index}_expected`]}
                            helperText={errors[`funding_${index}_expected`]}
                            disabled={isSubmitting}
                            InputProps={{ inputProps: { min: 0 } }}
                          />

                          <TextField
                            fullWidth
                            label="Available Amount"
                            type="number"
                            value={source.availableAmount}
                            onChange={(e) => handleFundingSourceChange(index, 'availableAmount', Number(e.target.value))}
                            error={!!errors[`funding_${index}_available`]}
                            helperText={errors[`funding_${index}_available`]}
                            disabled={isSubmitting}
                            InputProps={{ inputProps: { min: 0 } }}
                          />
                        </Box>

                        {/* Optional Limit */}
                        <TextField
                          fullWidth
                          label="Limit (Optional)"
                          type="number"
                          value={source.limit || ''}
                          onChange={(e) => handleFundingSourceChange(index, 'limit', e.target.value ? Number(e.target.value) : undefined)}
                          disabled={isSubmitting}
                          helperText="Maximum amount available from this source"
                          InputProps={{ inputProps: { min: 0 } }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Box display="flex" flexDirection="column" gap={3}>
            {/* Priority */}
            <FormControl fullWidth disabled={isSubmitting}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={handleFieldChange('priority')}
                label="Priority"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
              <FormHelperText>Project priority level</FormHelperText>
            </FormControl>

            {/* Notes */}
            <TextField
              fullWidth
              label="Notes"
              value={formData.notes}
              onChange={handleFieldChange('notes')}
              multiline
              rows={4}
              disabled={isSubmitting}
              helperText="Additional notes or comments about the project"
            />
          </Box>
        </TabPanel>
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
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectEditDialog;
