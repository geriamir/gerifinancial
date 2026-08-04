import React, { useState, useRef } from 'react';
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
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  BeachAccess as VacationIcon,
  Home as HomeIcon,
  TrendingUp as InvestmentIcon,
  AutoAwesome as DraftIcon,
  DeleteOutline as RemoveIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useNavigate } from 'react-router-dom';
import { ProjectCreationData, ProjectBudget, ProjectType, DraftedCategoryBudget } from '../../../types/projects';
import { useProject } from '../../../contexts/ProjectContext';
import { projectsApi } from '../../../services/api/projects';

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
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const [description, setDescription] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftLines, setDraftLines] = useState<DraftedCategoryBudget[]>([]);
  const [draftWarnings, setDraftWarnings] = useState<string[]>([]);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  /**
   * Fills the form from a description, leaving anything the drafter could not
   * work out for the user to complete. Nothing is created until they submit, so
   * a bad draft costs them an edit rather than a project they have to delete.
   */
  const handleDraft = async () => {
    if (!description.trim() || isDrafting) return;

    setIsDrafting(true);
    setDraftMessage(null);
    try {
      const draft = await projectsApi.draftProject(description.trim());

      if (!draft) {
        setDraftMessage("Couldn't draft this one - fill in the form below instead.");
        return;
      }

      setFormData(prev => {
        const startDate = draft.startDate ? new Date(draft.startDate) : prev.startDate;
        const endDate = draft.endDate ? new Date(draft.endDate) : prev.endDate;
        return {
          ...prev,
          name: draft.name || prev.name,
          type: draft.type || prev.type,
          currency: draft.currency || prev.currency,
          startDate,
          endDate
        };
      });
      setDraftLines(draft.categoryBudgets);
      setDraftWarnings(draft.warnings);
      setErrors({});
      if (draft.categoryBudgets.length === 0) {
        setDraftMessage('Drafted the outline, but none of the spending matched your categories.');
      }
    } catch (error) {
      setDraftMessage("Couldn't draft this one - fill in the form below instead.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleLineAmountChange = (index: number) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const amount = Number(event.target.value);
    setDraftLines(prev => prev.map((line, i) => (
      i === index ? { ...line, budgetedAmount: Number.isFinite(amount) && amount > 0 ? amount : 0 } : line
    )));
  };

  const handleRemoveLine = (index: number) => () => {
    setDraftLines(prev => prev.filter((_, i) => i !== index));
  };

  // Focus the description when the dialog opens: it is the top of the form and
  // the quickest way in. It deliberately gives up if the cursor is already in a
  // field - this used to fire on a timer and land mid-sentence, selecting what
  // had been typed so far so the next keystroke wiped it.
  const focusDescription = () => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    descriptionRef.current?.focus();
  };

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
      
      const project = await createProject({
        ...formData,
        currency: formData.currency,
        categoryBudgets: draftLines.map((line) => ({ ...line, currency: formData.currency }))
      });
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
      setDescription('');
      setDraftLines([]);
      setDraftWarnings([]);
      setDraftMessage(null);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      TransitionProps={{
        onEntered: () => {
          // Focus after the dialog transition completes
          setTimeout(focusDescription, 50);
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
          {/* Describe it and let the drafter fill the form in */}
          <Box>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Describe your project (optional)"
              placeholder="Renovating the kitchen from March, budget around 80,000"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting || isDrafting}
              inputProps={{ maxLength: 1000 }}
              inputRef={descriptionRef}
              helperText="Or skip this and fill in the form yourself"
            />
            <Box display="flex" justifyContent="flex-end" mt={1}>
              <Button
                onClick={handleDraft}
                disabled={!description.trim() || isDrafting || isSubmitting}
                startIcon={isDrafting ? <CircularProgress size={16} /> : <DraftIcon />}
                size="small"
              >
                {isDrafting ? 'Drafting...' : 'Draft with AI'}
              </Button>
            </Box>
            {draftMessage && (
              <Alert severity="info" sx={{ mt: 1 }}>{draftMessage}</Alert>
            )}
          </Box>

          <Divider />

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
                      borderColor: formData.type === option.value ? option.color : 'divider',
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

          {/* Drafted budget lines */}
          {draftLines.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Budget ({draftLines.length} {draftLines.length === 1 ? 'line' : 'lines'})
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                {draftLines.map((line, index) => (
                  <Box
                    key={`${line.categoryId}-${line.subCategoryId}-${index}`}
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >
                    <Box flex={1} minWidth={0}>
                      <Typography variant="body2" noWrap>
                        {line.categoryName} › {line.subCategoryName}
                      </Typography>
                      {line.description && (
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {line.description}
                        </Typography>
                      )}
                    </Box>
                    <TextField
                      size="small"
                      type="number"
                      value={line.budgetedAmount}
                      onChange={handleLineAmountChange(index)}
                      disabled={isSubmitting}
                      sx={{ width: 130 }}
                      inputProps={{ min: 0, 'aria-label': `Budget for ${line.subCategoryName}` }}
                    />
                    <IconButton
                      onClick={handleRemoveLine(index)}
                      disabled={isSubmitting}
                      size="small"
                      aria-label={`Remove ${line.subCategoryName}`}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                These are estimates - edit anything that looks wrong, or remove it.
              </Typography>
            </Box>
          )}

          {draftWarnings.length > 0 && (
            <Alert severity="warning">
              <Typography variant="body2" component="div">
                Left out of the budget:
                <ul style={{ margin: '4px 0 0', paddingInlineStart: 20 }}>
                  {draftWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </Typography>
            </Alert>
          )}

          {/* Info Alert */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>What happens next?</strong><br />
              {draftLines.length > 0
                ? <>• The budget above is created with the project — edit amounts any time from the project page<br /></>
                : <>• A starting budget is added where one exists for this project type — edit it from the project page<br /></>}
              • You can add more budget categories and funding sources after creation<br />
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
